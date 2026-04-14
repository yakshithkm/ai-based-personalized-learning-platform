const Attempt = require('../models/Attempt');
const Question = require('../models/Question');
const ExamSession = require('../models/ExamSession');
const { normalizeExamType, getAllowedSubjectsForExam, normalizeSubjectName } = require('../config/examSubjectMap');
const { getExamConfig } = require('../config/examConfig');

const MOCK_BLUEPRINTS = {
  NEET: {
    questionCount: 180,
    timeLimitSec: 10800,
    distribution: {
      Physics: 45,
      Chemistry: 45,
      Biology: 90,
    },
  },
  CET: {
    questionCount: 180,
    timeLimitSec: 10800,
    distribution: {
      Physics: 45,
      Chemistry: 45,
      Mathematics: 45,
      Biology: 45,
    },
  },
  JEE: {
    questionCount: 180,
    timeLimitSec: 10800,
    distribution: {
      Physics: 60,
      Chemistry: 60,
      Mathematics: 60,
    },
  },
};

const SECTION_TEST_SIZE = 45;
const SECTION_TIME_LIMIT_SEC = 2700;
const SCORE_RULES = {
  correct: 4,
  wrong: -1,
  unattempted: 0,
};

const YEAR_TAG_PRIORITY = {
  'Previous Year': 1.35,
  Conceptual: 1.12,
  Mock: 1,
};

const WEIGHTAGE_PRIORITY = {
  High: 1.15,
  Medium: 1,
  Low: 0.92,
};

const MIN_QUESTION_FRACTION = 0.3;
const INACTIVITY_EXPIRE_WINDOW_MS = 15 * 60 * 1000;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const logExamIntegrity = (event, payload = {}) => {
  console.warn(`[exam-integrity] ${event}`, payload);
};

const buildHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const shuffle = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const getTimeLeftSec = (session) => {
  const remaining = Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000);
  return Math.max(0, remaining);
};

const getDifficultyWeights = (accuracy) => {
  if (accuracy < 50) {
    return { Easy: 0.56, Medium: 0.34, Hard: 0.1 };
  }
  if (accuracy > 75) {
    return { Easy: 0.2, Medium: 0.45, Hard: 0.35 };
  }
  return { Easy: 0.28, Medium: 0.52, Hard: 0.2 };
};

const mapLegacyDifficultyLevel = (difficulty, explicitLevel) => {
  if (explicitLevel) return explicitLevel;
  if (difficulty === 'Easy') return 'Easy';
  if (difficulty === 'Hard') return 'Tough';
  return 'Moderate';
};

const getDifficultyLevelWeights = (accuracy) => {
  if (accuracy < 50) {
    return { Easy: 0.54, Moderate: 0.34, Tough: 0.12 };
  }
  if (accuracy > 75) {
    return { Easy: 0.22, Moderate: 0.46, Tough: 0.32 };
  }
  return { Easy: 0.28, Moderate: 0.5, Tough: 0.22 };
};

const getSubjectAccuracyMap = async (userId) => {
  const subjectStats = await Attempt.aggregate([
    { $match: { user: userId } },
    {
      $group: {
        _id: '$subject',
        attempts: { $sum: 1 },
        correct: {
          $sum: {
            $cond: [{ $eq: ['$isCorrect', true] }, 1, 0],
          },
        },
      },
    },
  ]);

  const accuracyMap = new Map();
  subjectStats.forEach((row) => {
    const accuracy = row.attempts ? (row.correct / row.attempts) * 100 : 0;
    accuracyMap.set(row._id, accuracy);
  });
  return accuracyMap;
};

const scoreQuestionForSelection = ({ question, weights, levelWeights, recentQuestionIds }) => {
  const difficultyWeight = Number(weights[question.difficulty] || 0);
  const level = mapLegacyDifficultyLevel(question.difficulty, question.difficultyLevel);
  const levelWeight = Number(levelWeights[level] || 0);
  const pyqBoost = Number(YEAR_TAG_PRIORITY[question.yearTag] || 1);
  const weightageBoost = Number(WEIGHTAGE_PRIORITY[question.weightage] || 1);
  const recentPenalty = recentQuestionIds.has(String(question._id)) ? 0.22 : 0;
  const noveltyBoost = Math.random() * 0.12;
  return (difficultyWeight + levelWeight + noveltyBoost) * pyqBoost * weightageBoost - recentPenalty;
};

const pickQuestionsForSubject = ({ questions, count, weights, levelWeights, recentQuestionIds }) => {
  const groupedByTopic = questions.reduce((acc, question) => {
    const topicKey = question.topic || 'General';
    if (!acc.has(topicKey)) {
      acc.set(topicKey, []);
    }
    acc.get(topicKey).push(question);
    return acc;
  }, new Map());

  const topicRows = Array.from(groupedByTopic.entries()).map(([topic, items]) => ({ topic, items, quota: 0 }));
  const totalPool = Math.max(questions.length, 1);
  topicRows.forEach((row) => {
    row.quota = Math.max(1, Math.floor((row.items.length / totalPool) * count));
  });

  let allocated = topicRows.reduce((sum, row) => sum + row.quota, 0);
  while (allocated > count) {
    const candidate = topicRows.find((row) => row.quota > 1);
    if (!candidate) break;
    candidate.quota -= 1;
    allocated -= 1;
  }

  while (allocated < count) {
    const candidate = topicRows
      .slice()
      .sort((a, b) => b.items.length - a.items.length)
      .find((row) => row.quota < row.items.length);
    if (!candidate) break;
    candidate.quota += 1;
    allocated += 1;
  }

  const selected = [];
  const selectedIds = new Set();

  topicRows.forEach((row) => {
    const ranked = [...row.items]
      .map((question) => ({
        question,
        score: scoreQuestionForSelection({
          question,
          weights,
          levelWeights,
          recentQuestionIds,
        }),
      }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.question)
      .slice(0, row.quota);

    ranked.forEach((question) => {
      const id = String(question._id);
      if (!selectedIds.has(id) && selected.length < count) {
        selected.push(question);
        selectedIds.add(id);
      }
    });
  });

  if (selected.length < count) {
    const fill = questions
      .filter((question) => !selectedIds.has(String(question._id)))
      .map((question) => ({
        question,
        score: scoreQuestionForSelection({
          question,
          weights,
          levelWeights,
          recentQuestionIds,
        }),
      }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.question)
      .slice(0, count - selected.length);

    selected.push(...fill);
  }

  return selected.slice(0, count);
};

const summarizeBlueprintDiagnostics = ({ distribution, selectedQuestions }) => {
  const subjectCounts = selectedQuestions.reduce((acc, question) => {
    acc[question.subject] = (acc[question.subject] || 0) + 1;
    return acc;
  }, {});

  const yearTagMix = selectedQuestions.reduce((acc, question) => {
    const key = question.yearTag || 'Mock';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const difficultyMix = selectedQuestions.reduce((acc, question) => {
    const key = question.difficulty || 'Medium';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const difficultyLevelMix = selectedQuestions.reduce((acc, question) => {
    const key = mapLegacyDifficultyLevel(question.difficulty, question.difficultyLevel);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const totalQuestions = Math.max(selectedQuestions.length, 1);
  const topicCoverageBySubject = Object.keys(distribution).reduce((acc, subject) => {
    const byTopic = selectedQuestions
      .filter((question) => question.subject === subject)
      .reduce((topicAcc, question) => {
        const key = question.topic || 'General';
        topicAcc[key] = (topicAcc[key] || 0) + 1;
        return topicAcc;
      }, {});

    const subjectTotal = Math.max(Object.values(byTopic).reduce((sum, val) => sum + val, 0), 1);
    acc[subject] = Object.keys(byTopic)
      .sort((a, b) => byTopic[b] - byTopic[a])
      .map((topic) => ({
        topic,
        count: byTopic[topic],
        actualSharePct: Number(((byTopic[topic] / subjectTotal) * 100).toFixed(1)),
      }));

    return acc;
  }, {});

  return {
    subjectTargets: distribution,
    selectedSubjectCounts: subjectCounts,
    subjectSharePct: Object.keys(subjectCounts).reduce((acc, subject) => {
      acc[subject] = Number(((subjectCounts[subject] / totalQuestions) * 100).toFixed(1));
      return acc;
    }, {}),
    topicCoverageBySubject,
    pyqCount: yearTagMix['Previous Year'] || 0,
    pyqSharePct: Number((((yearTagMix['Previous Year'] || 0) / totalQuestions) * 100).toFixed(1)),
    yearTagMix,
    difficultyMix,
    difficultyLevelMix,
  };
};

const allocateScaledDistribution = ({ distribution, availableBySubject }) => {
  const requestedCounts = { ...distribution };
  const subjects = Object.keys(requestedCounts);
  const expectedTotal = subjects.reduce((sum, subject) => sum + Number(requestedCounts[subject] || 0), 0);
  const totalAvailable = subjects.reduce((sum, subject) => sum + Number(availableBySubject[subject] || 0), 0);

  if (!expectedTotal || subjects.length === 0) {
    return {
      requestedCounts,
      scaledCounts: requestedCounts,
      scalingApplied: false,
      expectedTotal,
      scaledTotal: expectedTotal,
    };
  }

  const globalScale = clamp(totalAvailable / expectedTotal, 0, 1);
  const scaledTotal = Math.max(1, Math.floor(expectedTotal * globalScale));
  const requestedRatios = subjects.map((subject) => ({
    subject,
    ratio: Number(requestedCounts[subject] || 0) / expectedTotal,
  }));

  const scaledCounts = {};
  const remainders = [];
  let allocated = 0;

  requestedRatios.forEach(({ subject, ratio }) => {
    const capped = Math.min(
      Number(availableBySubject[subject] || 0),
      Math.floor(scaledTotal * ratio)
    );
    scaledCounts[subject] = Math.max(0, capped);
    allocated += scaledCounts[subject];
    remainders.push({
      subject,
      remainder: scaledTotal * ratio - Math.floor(scaledTotal * ratio),
    });
  });

  while (allocated < scaledTotal) {
    const candidate = remainders
      .slice()
      .sort((a, b) => b.remainder - a.remainder)
      .find(({ subject }) => scaledCounts[subject] < Number(availableBySubject[subject] || 0));

    if (!candidate) break;
    scaledCounts[candidate.subject] += 1;
    allocated += 1;
  }

  return {
    requestedCounts,
    scaledCounts,
    scalingApplied: scaledTotal < expectedTotal,
    expectedTotal,
    scaledTotal,
  };
};

const fillFromRankedPool = ({
  pool,
  needed,
  selectedIds,
  weights,
  levelWeights,
  recentQuestionIds,
}) => {
  if (needed <= 0 || !pool.length) return [];

  return pool
    .filter((question) => !selectedIds.has(String(question._id)))
    .map((question) => ({
      question,
      score: scoreQuestionForSelection({
        question,
        weights,
        levelWeights,
        recentQuestionIds,
      }),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, needed)
    .map((entry) => entry.question);
};

const enforcePyqRange = ({ selected, allCandidates, count, pyqShareRange }) => {
  if (!pyqShareRange) {
    return {
      selected,
      relaxed: false,
      target: {
        minCount: 0,
        maxCount: count,
      },
      actual: {
        count: selected.filter((question) => question.yearTag === 'Previous Year').length,
      },
    };
  }

  const minPyq = Math.ceil(count * Number(pyqShareRange.min || 0));
  const maxPyq = Math.floor(count * Number(pyqShareRange.max || 1));

  const selectedById = new Map(selected.map((question) => [String(question._id), question]));
  const selectedPyq = selected.filter((question) => question.yearTag === 'Previous Year');
  const selectedNonPyq = selected.filter((question) => question.yearTag !== 'Previous Year');

  if (selectedPyq.length < minPyq) {
    const availablePyq = allCandidates
      .filter((question) => question.yearTag === 'Previous Year')
      .filter((question) => !selectedById.has(String(question._id)));

    let need = minPyq - selectedPyq.length;
    while (need > 0 && availablePyq.length && selectedNonPyq.length) {
      const inQuestion = availablePyq.shift();
      const outQuestion = selectedNonPyq.shift();
      selectedById.delete(String(outQuestion._id));
      selectedById.set(String(inQuestion._id), inQuestion);
      need -= 1;
    }
  }

  const afterFirstPass = Array.from(selectedById.values());
  const pyqAfterFirst = afterFirstPass.filter((question) => question.yearTag === 'Previous Year');
  if (pyqAfterFirst.length > maxPyq) {
    const pyqPool = [...pyqAfterFirst];
    const nonPyqPool = allCandidates
      .filter((question) => question.yearTag !== 'Previous Year')
      .filter((question) => !selectedById.has(String(question._id)));

    let reduce = pyqAfterFirst.length - maxPyq;
    while (reduce > 0 && pyqPool.length && nonPyqPool.length) {
      const outQuestion = pyqPool.shift();
      const inQuestion = nonPyqPool.shift();
      selectedById.delete(String(outQuestion._id));
      selectedById.set(String(inQuestion._id), inQuestion);
      reduce -= 1;
    }
  }

  const finalSelected = Array.from(selectedById.values()).slice(0, count);
  const finalPyqCount = finalSelected.filter((question) => question.yearTag === 'Previous Year').length;

  return {
    selected: finalSelected,
    relaxed: finalPyqCount < minPyq || finalPyqCount > maxPyq,
    target: {
      minCount: minPyq,
      maxCount: maxPyq,
    },
    actual: {
      count: finalPyqCount,
    },
  };
};

const validateBlueprintHard = ({ distribution, selectedQuestions, examType }) => {
  const examConfig = getExamConfig(examType);
  const diagnostics = summarizeBlueprintDiagnostics({ distribution, selectedQuestions });

  const subjectMatch = Object.entries(distribution).every(
    ([subject, target]) => Number(diagnostics.selectedSubjectCounts[subject] || 0) === Number(target)
  );

  const topicSpreadOk = Object.entries(diagnostics.topicCoverageBySubject || {}).every(([, rows]) => {
    const highest = (rows || [])[0];
    if (!highest) return true;
    return Number(highest.actualSharePct || 0) / 100 <= Number(examConfig.topicSkewMaxShare || 0.55);
  });

  const pyqShare = Number(diagnostics.pyqSharePct || 0) / 100;
  const pyqRange = examConfig.pyqShareRange || { min: 0, max: 1 };
  const pyqRangeOk = pyqShare >= pyqRange.min && pyqShare <= pyqRange.max;

  return {
    ok: subjectMatch && topicSpreadOk && pyqRangeOk,
    diagnostics,
    checks: {
      subjectMatch,
      topicSpreadOk,
      pyqRangeOk,
    },
  };
};

const buildDistributionForSession = ({ mode, examType, sectionSubject }) => {
  if (mode === 'full-length') {
    const config = MOCK_BLUEPRINTS[examType];
    if (!config) {
      throw new Error('Unsupported exam type for full-length simulation');
    }
    return {
      questionCount: config.questionCount,
      timeLimitSec: config.timeLimitSec,
      distribution: config.distribution,
    };
  }

  return {
    questionCount: SECTION_TEST_SIZE,
    timeLimitSec: SECTION_TIME_LIMIT_SEC,
    distribution: {
      [sectionSubject]: SECTION_TEST_SIZE,
    },
  };
};

const validateSessionModeRequest = ({ mode, examType, sectionSubject }) => {
  if (!['full-length', 'section-wise'].includes(mode)) {
    throw new Error('Invalid mode. Allowed values: full-length, section-wise');
  }

  if (!MOCK_BLUEPRINTS[examType]) {
    throw new Error('Unsupported exam type for simulation');
  }

  if (mode === 'section-wise' && !sectionSubject) {
    throw new Error('sectionSubject is required for section-wise mode');
  }
};

const publicQuestion = (snapshot, questionDoc) => ({
  _id: String(snapshot.question),
  subject: snapshot.subject,
  topic: snapshot.topic,
  subtopic: snapshot.subtopic || 'General',
  difficulty: snapshot.difficulty,
  difficultyLevel: snapshot.difficultyLevel || mapLegacyDifficultyLevel(snapshot.difficulty, null),
  yearTag: snapshot.yearTag || 'Mock',
  weightage: snapshot.weightage || 'Medium',
  isPreviousYear: snapshot.yearTag === 'Previous Year',
  conceptTested: snapshot.conceptTested,
  text: questionDoc?.text || '',
  options: questionDoc?.options || [],
});

const buildPalette = (session) => {
  const answered = new Set(
    (session.responses || [])
      .filter((entry) => Number.isInteger(entry.selectedAnswerIndex))
      .map((entry) => Number(entry.questionIndex))
  );

  return session.questionOrder.map((_, index) => ({
    index,
    status: answered.has(index) ? 'answered' : 'unanswered',
    current: index === session.currentQuestionIndex,
  }));
};

const serializeSessionState = async (session) => {
  const ids = session.questionOrder.map((entry) => entry.question);
  const docs = await Question.find({ _id: { $in: ids } }).select('text options').lean();
  const docMap = new Map(docs.map((doc) => [String(doc._id), doc]));

  return {
    sessionId: String(session._id),
    examType: session.examType,
    mode: session.mode,
    sectionSubject: session.sectionSubject || null,
    strictNavigation: Boolean(session.strictNavigation),
    status: session.status,
    questionCount: session.questionCount,
    timeLimitSec: session.timeLimitSec,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    submittedAt: session.submittedAt,
    serverNow: new Date(),
    currentQuestionIndex: session.currentQuestionIndex,
    timeLeftSec: getTimeLeftSec(session),
    scoringRules: SCORE_RULES,
    behavior: {
      hintsEnabled: false,
      explanationsEnabled: false,
      resultsVisibleBeforeSubmit: false,
      modeExplanation:
        'Exam mode simulates real test pressure: timer, no hints/explanations, and results only after final submission.',
    },
    questions: session.questionOrder.map((entry) =>
      publicQuestion(entry, docMap.get(String(entry.question)))
    ),
    responses: (session.responses || []).map((entry) => ({
      questionIndex: entry.questionIndex,
      selectedAnswerIndex: Number.isInteger(entry.selectedAnswerIndex)
        ? entry.selectedAnswerIndex
        : null,
      timeTakenSec: Number(entry.timeTakenSec || 0),
      answeredAt: entry.answeredAt,
    })),
    palette: buildPalette(session),
    generationNotice: (session.blueprintDiagnostics?.warnings || []).length
      ? 'Limited question availability detected. Generated a slightly adjusted mock test.'
      : null,
    blueprintDiagnostics: session.blueprintDiagnostics || null,
    resultSummary: session.resultSummary || null,
  };
};

const autoExpireIfNeeded = async (session) => {
  if (!session || session.status !== 'active') return session;
  const nowMs = Date.now();
  const expiresAtMs = new Date(session.expiresAt).getTime();
  const inactivityMs = nowMs - new Date(session.lastActivityAt || session.updatedAt || session.startedAt).getTime();
  const expiredByTimer = expiresAtMs <= nowMs;
  const expiredByInactivity = inactivityMs >= INACTIVITY_EXPIRE_WINDOW_MS;

  if (!expiredByTimer && !expiredByInactivity) return session;

  session.status = 'expired';
  session.submittedAt = new Date();
  session.isSubmitting = false;
  session.lastActivityAt = new Date();
  session.version = Number(session.version || 0) + 1;
  await session.save();
  if (expiredByInactivity) {
    logExamIntegrity('session-auto-expired-inactivity', {
      sessionId: String(session._id),
      userId: String(session.user),
      inactivityMs,
      windowMs: INACTIVITY_EXPIRE_WINDOW_MS,
    });
  }
  return session;
};

const createExamSession = async ({ user, mode, examType, sectionSubject, strictNavigation = false }) => {
  const activeSession = await ExamSession.findOne({ user: user._id, status: 'active' }).sort({ createdAt: -1 });
  if (activeSession) {
    const refreshed = await autoExpireIfNeeded(activeSession);
    if (refreshed.status === 'active') {
      logExamIntegrity('answer-rejected', {
        reason: 'active-session-exists',
        userId: String(user._id),
        sessionId: String(refreshed._id),
      });
      throw buildHttpError('An active exam session already exists for this user.', 409);
    }
  }

  const resolvedExam = normalizeExamType(examType || user?.targetExam || user?.exam);
  const allowedSubjects = getAllowedSubjectsForExam(resolvedExam);
  const requestedSection = normalizeSubjectName(sectionSubject);
  let normalizedSection = requestedSection;
  const generationWarnings = [];

  if (mode === 'section-wise' && (!normalizedSection || !allowedSubjects.includes(normalizedSection))) {
    normalizedSection = allowedSubjects[0] || 'Physics';
    generationWarnings.push(
      `Ignored invalid section subject and defaulted to ${normalizedSection} for ${resolvedExam}.`
    );
  }

  validateSessionModeRequest({
    mode,
    examType: resolvedExam,
    sectionSubject: normalizedSection,
  });

  const { questionCount, timeLimitSec, distribution } = buildDistributionForSession({
    mode,
    examType: resolvedExam,
    sectionSubject: normalizedSection,
  });

  const recentAttempts = await Attempt.find({ user: user._id })
    .sort({ createdAt: -1 })
    .limit(120)
    .select('question')
    .lean();
  const recentQuestionIds = new Set(recentAttempts.map((entry) => String(entry.question)));

  const subjectAccuracy = await getSubjectAccuracyMap(user._id);
  const examConfig = getExamConfig(resolvedExam);
  const availabilityRows = await Promise.all(
    Object.keys(distribution).map(async (subject) => ({
      subject,
      available: await Question.countDocuments({ examType: resolvedExam, subject }),
    }))
  );

  const availableBySubject = availabilityRows.reduce((acc, row) => {
    acc[row.subject] = Number(row.available || 0);
    return acc;
  }, {});

  const scalePlan = allocateScaledDistribution({
    distribution,
    availableBySubject,
  });

  if (scalePlan.scalingApplied) {
    generationWarnings.push('Limited subject pools detected. Blueprint was scaled proportionally.');
  }

  Object.entries(distribution).forEach(([subject, target]) => {
    const available = Number(availableBySubject[subject] || 0);
    if (available < target) {
      const warning = `Subject shortage for ${subject}: required ${target}, available ${available}.`;
      generationWarnings.push(warning);
      console.warn('[exam-blueprint] shortage', {
        examType: resolvedExam,
        mode,
        subject,
        required: target,
        available,
      });
    }
  });

  const selectedQuestions = [];
  const selectedIds = new Set();
  const fallbackUsage = {
    sameSubjectRelaxed: 0,
    relatedTopics: 0,
    anyAvailable: 0,
  };
  let pyqRelaxed = false;
  let pyqTargetMeta = null;

  for (const [subject, scaledCount] of Object.entries(scalePlan.scaledCounts)) {
    if (!scaledCount) continue;

    const accuracy = Number(subjectAccuracy.get(subject) || 60);
    const weights = getDifficultyWeights(accuracy);
    const levelWeights = getDifficultyLevelWeights(accuracy);

    const pool = await Question.find({
      examType: resolvedExam,
      subject,
    })
      .select('subject topic subtopic difficulty difficultyLevel conceptTested yearTag weightage')
      .lean();

    const pickedPrimary = pickQuestionsForSubject({
      questions: shuffle(pool),
      count: Math.min(scaledCount, pool.length),
      weights,
      levelWeights,
      recentQuestionIds,
    });

    const pyqAdjustedResult = enforcePyqRange({
      selected: pickedPrimary,
      allCandidates: pool,
      count: pickedPrimary.length,
      pyqShareRange: examConfig.pyqShareRange,
    });

    if (pyqAdjustedResult.relaxed) {
      pyqRelaxed = true;
      generationWarnings.push(`PYQ mix deviated for ${subject} due to limited PYQ availability.`);
    }

    if (!pyqTargetMeta) {
      pyqTargetMeta = pyqAdjustedResult.target;
    }

    const subjectSelected = [];
    pyqAdjustedResult.selected.forEach((question) => {
      const id = String(question._id);
      if (!selectedIds.has(id)) {
        selectedIds.add(id);
        subjectSelected.push(question);
      }
    });

    let remaining = scaledCount - subjectSelected.length;

    if (remaining > 0) {
      const sameSubjectFallback = fillFromRankedPool({
        pool,
        needed: remaining,
        selectedIds,
        weights,
        levelWeights,
        recentQuestionIds,
      });

      sameSubjectFallback.forEach((question) => {
        const id = String(question._id);
        if (!selectedIds.has(id) && remaining > 0) {
          selectedIds.add(id);
          subjectSelected.push(question);
          remaining -= 1;
          fallbackUsage.sameSubjectRelaxed += 1;
        }
      });
    }

    if (remaining > 0) {
      const preferredTopics = [...new Set(pool.map((question) => question.topic).filter(Boolean))].slice(0, 8);
      const relatedPool = preferredTopics.length
        ? await Question.find({
            examType: resolvedExam,
            subject: { $in: allowedSubjects.filter((item) => item !== subject) },
            topic: { $in: preferredTopics },
            _id: { $nin: Array.from(selectedIds) },
          })
            .select('subject topic subtopic difficulty difficultyLevel conceptTested yearTag weightage')
            .lean()
        : [];

      const relatedFallback = fillFromRankedPool({
        pool: relatedPool,
        needed: remaining,
        selectedIds,
        weights,
        levelWeights,
        recentQuestionIds,
      });

      relatedFallback.forEach((question) => {
        const id = String(question._id);
        if (!selectedIds.has(id) && remaining > 0) {
          selectedIds.add(id);
          subjectSelected.push(question);
          remaining -= 1;
          fallbackUsage.relatedTopics += 1;
        }
      });
    }

    if (remaining > 0) {
      const anyPool = await Question.find({
        examType: resolvedExam,
        _id: { $nin: Array.from(selectedIds) },
      })
        .select('subject topic subtopic difficulty difficultyLevel conceptTested yearTag weightage')
        .lean();

      const anyFallback = fillFromRankedPool({
        pool: anyPool,
        needed: remaining,
        selectedIds,
        weights,
        levelWeights,
        recentQuestionIds,
      });

      anyFallback.forEach((question) => {
        const id = String(question._id);
        if (!selectedIds.has(id) && remaining > 0) {
          selectedIds.add(id);
          subjectSelected.push(question);
          remaining -= 1;
          fallbackUsage.anyAvailable += 1;
        }
      });
    }

    if (remaining > 0) {
      generationWarnings.push(
        `Could not fully fill scaled ${subject} target by ${remaining} questions after fallback stages.`
      );
    }

    selectedQuestions.push(...subjectSelected);
  }

  const shuffledSessionQuestions = shuffle(selectedQuestions);
  const expectedTotal = Number(questionCount || 0);
  const actualQuestionCount = shuffledSessionQuestions.length;
  const minimumAllowedCount = Math.ceil(expectedTotal * MIN_QUESTION_FRACTION);

  if (actualQuestionCount < minimumAllowedCount) {
    const error = new Error(
      `Not enough questions to generate a meaningful exam. Expected at least ${minimumAllowedCount}, got ${actualQuestionCount}.`
    );
    error.statusCode = 400;
    throw error;
  }

  const hardValidation = validateBlueprintHard({
    distribution: scalePlan.scaledCounts,
    selectedQuestions: shuffledSessionQuestions,
    examType: resolvedExam,
  });

  const requestedCounts = { ...distribution };
  const actualCounts = hardValidation.diagnostics.selectedSubjectCounts || {};
  const deficits = Object.keys(requestedCounts).reduce((acc, subject) => {
    const deficit = Math.max(0, Number(requestedCounts[subject] || 0) - Number(actualCounts[subject] || 0));
    if (deficit > 0) {
      acc[subject] = deficit;
    }
    return acc;
  }, {});

  const pyqActualCount = Number(hardValidation.diagnostics.pyqCount || 0);
  const pyqActualPct = Number(hardValidation.diagnostics.pyqSharePct || 0);
  const pyqTarget = {
    minPct: Number(((examConfig.pyqShareRange?.min || 0) * 100).toFixed(1)),
    maxPct: Number(((examConfig.pyqShareRange?.max || 1) * 100).toFixed(1)),
    minCount: pyqTargetMeta?.minCount ?? Math.ceil(actualQuestionCount * Number(examConfig.pyqShareRange?.min || 0)),
    maxCount: pyqTargetMeta?.maxCount ?? Math.floor(actualQuestionCount * Number(examConfig.pyqShareRange?.max || 1)),
  };

  const pyqWithinRange = pyqActualPct >= pyqTarget.minPct && pyqActualPct <= pyqTarget.maxPct;
  if (!pyqWithinRange) {
    generationWarnings.push('PYQ distribution target could not be fully met; used best possible mix.');
  }

  if (fallbackUsage.sameSubjectRelaxed || fallbackUsage.relatedTopics || fallbackUsage.anyAvailable) {
    console.info('[exam-blueprint] fallback-usage', {
      examType: resolvedExam,
      mode,
      fallbackUsage,
    });
  }

  if (scalePlan.scalingApplied) {
    console.info('[exam-blueprint] scaling-applied', {
      examType: resolvedExam,
      mode,
      requestedCounts,
      scaledCounts: scalePlan.scaledCounts,
      expectedTotal: scalePlan.expectedTotal,
      scaledTotal: scalePlan.scaledTotal,
    });
  }

  const blueprintDiagnostics = {
    ...hardValidation.diagnostics,
    subjectTargets: scalePlan.scaledCounts,
    hardValidationChecks: {
      subjectMatch: true,
      topicSpreadOk: hardValidation.checks.topicSpreadOk,
      pyqRangeOk: pyqWithinRange,
    },
    requestedCounts,
    actualCounts,
    deficits,
    scalingApplied: Boolean(scalePlan.scalingApplied),
    scaledCounts: scalePlan.scaledCounts,
    expectedTotal,
    actualTotal: actualQuestionCount,
    pyqTarget,
    pyqActual: {
      count: pyqActualCount,
      sharePct: pyqActualPct,
      withinRange: pyqWithinRange,
      relaxed: pyqRelaxed || !pyqWithinRange,
    },
    fallbackUsage,
    warnings: generationWarnings,
    generationAttempts: 1,
  };

  if (generationWarnings.length) {
    console.warn('[exam-blueprint] warnings', {
      examType: resolvedExam,
      mode,
      warnings: generationWarnings,
    });
  }

  const adjustedTimeLimitSec = Math.max(
    600,
    Math.round(timeLimitSec * (actualQuestionCount / Math.max(questionCount, 1)))
  );

  const session = await ExamSession.create({
    user: user._id,
    examType: resolvedExam,
    mode,
    sectionSubject: mode === 'section-wise' ? normalizedSection : null,
    strictNavigation: Boolean(strictNavigation),
    status: 'active',
    questionCount: actualQuestionCount,
    timeLimitSec: adjustedTimeLimitSec,
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + adjustedTimeLimitSec * 1000),
    lastActivityAt: new Date(),
    isSubmitting: false,
    version: 0,
    lastAnsweredIndex: -1,
    questionOrder: shuffledSessionQuestions.map((question) => ({
      question: question._id,
      subject: question.subject,
      topic: question.topic,
      subtopic: question.subtopic || 'General',
      difficulty: question.difficulty,
      difficultyLevel: mapLegacyDifficultyLevel(question.difficulty, question.difficultyLevel),
      yearTag: question.yearTag || 'Mock',
      weightage: question.weightage || 'Medium',
      conceptTested: question.conceptTested || `${question.topic} Core Concept`,
    })),
    responses: [],
    currentQuestionIndex: 0,
    blueprintDiagnostics,
    resultSummary: null,
  });

  return serializeSessionState(session);
};

const getExamSessionState = async ({ userId, sessionId }) => {
  const session = await ExamSession.findOne({ _id: sessionId, user: userId });
  if (!session) {
    const error = new Error('Exam session not found');
    error.statusCode = 404;
    throw error;
  }

  const refreshed = await autoExpireIfNeeded(session);
  return serializeSessionState(refreshed);
};

const getLatestActiveExamSessionState = async ({ userId }) => {
  const session = await ExamSession.findOne({ user: userId, status: 'active' }).sort({ createdAt: -1 });
  if (!session) {
    return null;
  }

  const refreshed = await autoExpireIfNeeded(session);
  if (refreshed.status !== 'active') {
    return null;
  }

  return serializeSessionState(refreshed);
};

const submitAnswer = async ({ userId, sessionId, questionIndex, selectedAnswerIndex, timeTakenSec = 0 }) => {
  const session = await ExamSession.findOne({ _id: sessionId, user: userId });
  if (!session) {
    const error = new Error('Exam session not found');
    error.statusCode = 404;
    throw error;
  }

  await autoExpireIfNeeded(session);

  if (session.status === 'submitted') {
    logExamIntegrity('answer-rejected', {
      reason: 'submitted-session',
      sessionId,
      userId: String(userId),
    });
    throw buildHttpError('Exam session already submitted', 400);
  }

  if (session.status === 'expired') {
    logExamIntegrity('answer-rejected', {
      reason: 'expired-session',
      sessionId,
      userId: String(userId),
    });
    throw buildHttpError('Exam session expired', 400);
  }

  if (session.isSubmitting) {
    logExamIntegrity('answer-rejected', {
      reason: 'submit-lock-active',
      sessionId,
      userId: String(userId),
    });
    throw buildHttpError('Session submission in progress', 409);
  }

  if (session.status !== 'active') {
    const error = new Error('Exam session is not active');
    error.statusCode = 400;
    throw error;
  }

  const resolvedIndex = Number(questionIndex);
  if (!Number.isInteger(resolvedIndex) || resolvedIndex < 0 || resolvedIndex >= session.questionCount) {
    logExamIntegrity('answer-rejected', {
      reason: 'invalid-question-index',
      sessionId,
      userId: String(userId),
      questionIndex,
    });
    throw buildHttpError('Invalid questionIndex', 400);
  }

  if (!Number.isInteger(Number(selectedAnswerIndex)) || Number(selectedAnswerIndex) < 0 || Number(selectedAnswerIndex) > 3) {
    logExamIntegrity('answer-rejected', {
      reason: 'invalid-answer-index',
      sessionId,
      userId: String(userId),
      selectedAnswerIndex,
    });
    throw buildHttpError('selectedAnswerIndex must be 0..3', 400);
  }

  if (!session.questionOrder[resolvedIndex]?.question) {
    logExamIntegrity('answer-rejected', {
      reason: 'question-id-missing',
      sessionId,
      userId: String(userId),
      questionIndex: resolvedIndex,
    });
    throw buildHttpError('Question not found in session', 400);
  }

  const persistedLastAnswered = Number(session.lastAnsweredIndex);
  const lastAnsweredIndex = Number.isInteger(persistedLastAnswered) ? persistedLastAnswered : -1;
  const maxAllowedIndex = lastAnsweredIndex + 1;
  if (session.strictNavigation && resolvedIndex > maxAllowedIndex) {
    logExamIntegrity('out-of-order-attempt', {
      sessionId,
      userId: String(userId),
      questionIndex: resolvedIndex,
      maxAllowedIndex,
      lastAnsweredIndex,
    });
    throw buildHttpError('Strict navigation enabled: cannot skip ahead', 400);
  }

  const responseIdx = (session.responses || []).findIndex((entry) => entry.questionIndex === resolvedIndex);
  if (responseIdx >= 0) {
    logExamIntegrity('answer-rejected', {
      reason: 'duplicate-question-submission',
      sessionId,
      userId: String(userId),
      questionIndex: resolvedIndex,
    });
    throw buildHttpError('Duplicate answer submission for question', 409);
  }

  const payload = {
    questionIndex: resolvedIndex,
    question: session.questionOrder[resolvedIndex].question,
    selectedAnswerIndex: Number(selectedAnswerIndex),
    timeTakenSec: Math.max(0, Number(timeTakenSec || 0)),
    answeredAt: new Date(),
  };

  const nextResponses = [...(session.responses || []), payload];
  const nextLastAnsweredIndex = Math.max(lastAnsweredIndex, resolvedIndex);
  const nextCurrentQuestionIndex = Math.min(nextLastAnsweredIndex + 1, session.questionCount - 1);

  const updated = await ExamSession.findOneAndUpdate(
    {
      _id: sessionId,
      user: userId,
      status: 'active',
      isSubmitting: { $ne: true },
      version: Number(session.version || 0),
      'responses.questionIndex': { $ne: resolvedIndex },
    },
    {
      $set: {
        responses: nextResponses,
        lastAnsweredIndex: nextLastAnsweredIndex,
        currentQuestionIndex: nextCurrentQuestionIndex,
        lastActivityAt: new Date(),
      },
      $inc: { version: 1 },
    },
    { new: true }
  );

  if (!updated) {
    const latest = await ExamSession.findOne({ _id: sessionId, user: userId });
    if (latest?.isSubmitting) {
      logExamIntegrity('answer-rejected', {
        reason: 'submit-lock-active',
        sessionId,
        userId: String(userId),
      });
      throw buildHttpError('Session submission in progress', 409);
    }
    if (latest?.status && latest.status !== 'active') {
      logExamIntegrity('answer-rejected', {
        reason: `status-${latest.status}`,
        sessionId,
        userId: String(userId),
      });
      throw buildHttpError(`Exam session ${latest.status}`, 400);
    }
    if ((latest?.responses || []).some((entry) => entry.questionIndex === resolvedIndex)) {
      logExamIntegrity('answer-rejected', {
        reason: 'duplicate-question-submission',
        sessionId,
        userId: String(userId),
        questionIndex: resolvedIndex,
      });
      throw buildHttpError('Duplicate answer submission for question', 409);
    }
    logExamIntegrity('multi-tab-conflict', {
      sessionId,
      userId: String(userId),
      questionIndex: resolvedIndex,
      expectedVersion: Number(session.version || 0),
      actualVersion: Number(latest?.version || 0),
    });
    throw buildHttpError('Stale session update rejected', 409);
  }

  return serializeSessionState(updated);
};

const computePercentileAndRank = ({ examType, score, maxScore }) => {
  const examConfig = getExamConfig(examType);

  const normalized = clamp(score / Math.max(maxScore, 1), -0.25, 1);
  const percentile = clamp(50 + normalized * 46, 1, 99.9);
  const totalCandidates = Number(examConfig.totalCandidates || 500000);
  const estimatedRank = Math.max(1, Math.round(totalCandidates * (1 - percentile / 100)));

  return {
    percentileEstimate: Number(percentile.toFixed(2)),
    totalCandidates,
    estimatedRank,
    rankRange: {
      low: Math.max(1, Math.round(estimatedRank * 0.88)),
      high: Math.max(1, Math.round(estimatedRank * 1.12)),
    },
  };
};

const buildScoreInterpretation = ({ scoreSummary, postTestAnalysis, blueprintDiagnostics, attempted, questionCount }) => {
  const percentile = Number(scoreSummary.percentileEstimate || 0);
  let scoreBand = 'average';
  let message = 'This score is around average for current exam trends.';

  if (percentile >= 85) {
    scoreBand = 'above-average';
    message = 'This score is above average and competitive for many exam cohorts.';
  } else if (percentile <= 35) {
    scoreBand = 'needs-attention';
    message = 'This score is below average right now, but targeted correction can improve rank quickly.';
  }

  const strongest = postTestAnalysis.strongSubjects?.[0]?.subject || 'N/A';
  const weakest = postTestAnalysis.weakSubjects?.[0]?.subject || 'N/A';
  const attemptedRatio = Number(attempted || 0) / Math.max(Number(questionCount || 1), 1);
  const pyqShare = Number(blueprintDiagnostics?.pyqSharePct || 0);

  let confidenceLevel = 'medium';
  if (attemptedRatio >= 0.6 && Number.isFinite(pyqShare)) {
    confidenceLevel = 'high';
  } else if (attemptedRatio < 0.35) {
    confidenceLevel = 'low';
  }

  const whyThisRank =
    `Rank is estimated from percentile ${percentile.toFixed(2)} and ${scoreSummary.totalCandidates} simulated candidates ` +
    `using rank = totalCandidates * (1 - percentile/100).`;

  const howScoreCompares =
    `Raw score ${scoreSummary.rawScore} is normalized to ${scoreSummary.normalizedScore} after adjusting for ` +
    `difficulty mix and subject-accuracy spread.`;

  return {
    scoreBand,
    message,
    rankMessage: `Likely rank range: ${scoreSummary.rankRange.low} - ${scoreSummary.rankRange.high}`,
    strengthWeaknessMessage: `You are currently stronger in ${strongest} and weaker in ${weakest}.`,
    whyThisRank,
    howScoreCompares,
    confidenceLevel,
    confidenceReason:
      'This estimate is based on your accuracy, attempted-question coverage, and simulated exam distribution.',
  };
};

const computeScoreNormalization = ({ rawScore, maxScore, blueprintDiagnostics, subjectBreakdown }) => {
  const difficultyMix = blueprintDiagnostics?.difficultyMix || {};
  const total = Math.max(
    Number(difficultyMix.Easy || 0) + Number(difficultyMix.Medium || 0) + Number(difficultyMix.Hard || 0),
    1
  );

  const easyShare = Number(difficultyMix.Easy || 0) / total;
  const hardShare = Number(difficultyMix.Hard || 0) / total;
  const difficultyFactor = clamp(1 + (hardShare - easyShare) * 0.12, 0.9, 1.12);

  const accuracies = (subjectBreakdown || [])
    .filter((row) => row.attempted > 0)
    .map((row) => Number(row.accuracy || 0) / 100);
  const mean = accuracies.length
    ? accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length
    : 0;
  const variance = accuracies.length
    ? accuracies.reduce((sum, value) => sum + (value - mean) ** 2, 0) / accuracies.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const consistencyFactor = clamp(1 + (0.35 - stdDev) * 0.08, 0.92, 1.08);

  const normalized = clamp(
    rawScore * difficultyFactor * consistencyFactor,
    -0.25 * Math.max(maxScore, 1),
    1.05 * Math.max(maxScore, 1)
  );

  return {
    rawScore,
    normalizedScore: Number(normalized.toFixed(2)),
    factors: {
      difficultyFactor: Number(difficultyFactor.toFixed(4)),
      consistencyFactor: Number(consistencyFactor.toFixed(4)),
      accuracyStdDev: Number(stdDev.toFixed(4)),
    },
  };
};

const buildPostTestAnalysis = ({
  questionOrder,
  questionDocMap,
  responses,
  scoreSummary,
}) => {
  const responseMap = new Map(responses.map((entry) => [entry.questionIndex, entry]));
  const bySubject = new Map();
  const mistakeConceptMap = new Map();

  let attempted = 0;

  questionOrder.forEach((snapshot, index) => {
    const subject = snapshot.subject;
    if (!bySubject.has(subject)) {
      bySubject.set(subject, {
        subject,
        total: 0,
        attempted: 0,
        correct: 0,
        wrong: 0,
        timeSpentSec: 0,
      });
    }

    const subjectRef = bySubject.get(subject);
    subjectRef.total += 1;

    const response = responseMap.get(index);
    if (!response || !Number.isInteger(response.selectedAnswerIndex)) {
      return;
    }

    const doc = questionDocMap.get(String(snapshot.question));
    const isCorrect = response.selectedAnswerIndex === doc.correctAnswerIndex;

    attempted += 1;
    subjectRef.attempted += 1;
    subjectRef.timeSpentSec += Number(response.timeTakenSec || 0);

    if (isCorrect) {
      subjectRef.correct += 1;
      return;
    }

    subjectRef.wrong += 1;
    const conceptKey = `${subject}::${snapshot.conceptTested || snapshot.topic}`;
    if (!mistakeConceptMap.has(conceptKey)) {
      mistakeConceptMap.set(conceptKey, {
        subject,
        concept: snapshot.conceptTested || snapshot.topic,
        topic: snapshot.topic,
        count: 0,
      });
    }
    mistakeConceptMap.get(conceptKey).count += 1;
  });

  const subjectBreakdown = Array.from(bySubject.values()).map((row) => {
    const accuracy = row.attempted ? (row.correct / row.attempted) * 100 : 0;
    const avgTimePerAttemptSec = row.attempted ? row.timeSpentSec / row.attempted : 0;
    return {
      ...row,
      accuracy: Number(accuracy.toFixed(2)),
      avgTimePerAttemptSec: Number(avgTimePerAttemptSec.toFixed(2)),
    };
  });

  const weakSubjects = [...subjectBreakdown]
    .filter((row) => row.attempted > 0)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 2)
    .map((row) => ({ subject: row.subject, accuracy: row.accuracy }));

  const strongSubjects = [...subjectBreakdown]
    .filter((row) => row.attempted > 0)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 2)
    .map((row) => ({ subject: row.subject, accuracy: row.accuracy }));

  const topMistakes = Array.from(mistakeConceptMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const highestTimeSubject = [...subjectBreakdown]
    .filter((row) => row.attempted > 0)
    .sort((a, b) => b.avgTimePerAttemptSec - a.avgTimePerAttemptSec)[0] || null;

  const highestMistake = topMistakes[0] || null;
  const projectedGain = Number((scoreSummary.wrong * 5).toFixed(0));

  const improvementProjection = highestMistake
    ? {
        fixTarget: `${highestMistake.subject} - ${highestMistake.concept}`,
        gainIfFixed: Math.max(5, highestMistake.count * 5),
        message: `If you fix ${highestMistake.subject} - ${highestMistake.concept}, your score can improve by ${Math.max(5, highestMistake.count * 5)} marks.`,
      }
    : {
        fixTarget: highestTimeSubject ? `${highestTimeSubject.subject} pacing` : 'accuracy consistency',
        gainIfFixed: projectedGain,
        message: `If you improve conversion on wrong attempts, your score can improve by ${projectedGain} marks.`,
      };

  const adaptivePlan = {
    weakSubjects: weakSubjects.map((row) => row.subject),
    repeatedMistakes: topMistakes.map((row) => `${row.subject}: ${row.concept}`),
    slowAreas: [...subjectBreakdown]
      .filter((row) => row.attempted > 0 && row.avgTimePerAttemptSec > 80)
      .map((row) => row.subject),
    nextPracticePlan: [
      ...weakSubjects.map((row) => ({
        type: 'weak-subject',
        label: `Rebuild ${row.subject} fundamentals`,
        reason: `Accuracy is ${row.accuracy.toFixed(1)}% in this test.`,
      })),
      ...topMistakes.slice(0, 2).map((item) => ({
        type: 'mistake-pattern',
        label: `Fix repeated concept: ${item.concept}`,
        reason: `${item.count} wrong answers came from this concept pattern.`,
      })),
      ...(highestTimeSubject
        ? [
            {
              type: 'speed-control',
              label: `Timed drills for ${highestTimeSubject.subject}`,
              reason: `Average time per attempted question was ${highestTimeSubject.avgTimePerAttemptSec.toFixed(1)}s.`,
            },
          ]
        : []),
    ].slice(0, 5),
  };

  return {
    attempted,
    strongSubjects,
    weakSubjects,
    subjectBreakdown,
    topMistakes,
    timeSpentPerSubject: subjectBreakdown.map((row) => ({
      subject: row.subject,
      timeSpentSec: row.timeSpentSec,
      avgTimePerAttemptSec: row.avgTimePerAttemptSec,
    })),
    accuracyPerSubject: subjectBreakdown.map((row) => ({
      subject: row.subject,
      accuracy: row.accuracy,
      attempted: row.attempted,
      total: row.total,
    })),
    improvementProjection,
    adaptiveFollowUp: adaptivePlan,
  };
};

const submitExamSession = async ({ userId, sessionId }) => {
  let session = await ExamSession.findOne({ _id: sessionId, user: userId });
  if (!session) {
    const error = new Error('Exam session not found');
    error.statusCode = 404;
    throw error;
  }

  if (session.status === 'submitted' && session.resultSummary) {
    return session.resultSummary;
  }

  await autoExpireIfNeeded(session);

  const lockAcquired = await ExamSession.updateOne(
    {
      _id: sessionId,
      user: userId,
      status: { $ne: 'submitted' },
      isSubmitting: { $ne: true },
    },
    {
      $set: {
        isSubmitting: true,
        lastActivityAt: new Date(),
      },
      $inc: { version: 1 },
    }
  );

  if (!lockAcquired.modifiedCount) {
    const latest = await ExamSession.findOne({ _id: sessionId, user: userId });
    if (latest?.status === 'submitted' && latest.resultSummary) {
      return latest.resultSummary;
    }
    if (latest?.isSubmitting) {
      logExamIntegrity('answer-rejected', {
        reason: 'submit-lock-active',
        sessionId,
        userId: String(userId),
      });
      throw buildHttpError('Session submission in progress', 409);
    }
    throw buildHttpError('Unable to acquire submit lock', 409);
  }

  session = await ExamSession.findOne({ _id: sessionId, user: userId });

  const questionIds = session.questionOrder.map((entry) => entry.question);
  const questions = await Question.find({ _id: { $in: questionIds } })
    .select('subject topic conceptTested correctAnswerIndex')
    .lean();
  const questionDocMap = new Map(questions.map((q) => [String(q._id), q]));

  const responseMap = new Map((session.responses || []).map((entry) => [entry.questionIndex, entry]));

  let correct = 0;
  let wrong = 0;
  let unattempted = 0;

  session.questionOrder.forEach((entry, index) => {
    const response = responseMap.get(index);
    if (!response || !Number.isInteger(response.selectedAnswerIndex)) {
      unattempted += 1;
      return;
    }

    const questionDoc = questionDocMap.get(String(entry.question));
    if (!questionDoc) {
      unattempted += 1;
      return;
    }

    if (response.selectedAnswerIndex === questionDoc.correctAnswerIndex) {
      correct += 1;
    } else {
      wrong += 1;
    }
  });

  const totalScore =
    correct * SCORE_RULES.correct +
    wrong * SCORE_RULES.wrong +
    unattempted * SCORE_RULES.unattempted;

  const maxScore = session.questionCount * SCORE_RULES.correct;
  const percentileAndRank = computePercentileAndRank({
    examType: session.examType,
    score: totalScore,
    maxScore,
  });

  const scoreSummary = {
    examType: session.examType,
    mode: session.mode,
    sectionSubject: session.sectionSubject || null,
    scoring: SCORE_RULES,
    correct,
    wrong,
    unattempted,
    totalScore,
    maxScore,
    ...percentileAndRank,
  };

  const analysis = buildPostTestAnalysis({
    questionOrder: session.questionOrder,
    questionDocMap,
    responses: session.responses || [],
    scoreSummary,
  });

  const normalizedScoreSummary = {
    ...scoreSummary,
    ...computeScoreNormalization({
      rawScore: scoreSummary.totalScore,
      maxScore: scoreSummary.maxScore,
      blueprintDiagnostics: session.blueprintDiagnostics || null,
      subjectBreakdown: analysis.subjectBreakdown,
    }),
  };

  const resultSummary = {
    sessionId: String(session._id),
    submittedAt: new Date(),
    scoreSummary: normalizedScoreSummary,
    postTestAnalysis: {
      strongSubjects: analysis.strongSubjects,
      weakSubjects: analysis.weakSubjects,
      timeSpentPerSubject: analysis.timeSpentPerSubject,
      accuracyPerSubject: analysis.accuracyPerSubject,
      topMistakes: analysis.topMistakes,
      improvementProjection: analysis.improvementProjection,
    },
    scoreInterpretation: buildScoreInterpretation({
      scoreSummary: normalizedScoreSummary,
      postTestAnalysis: {
        strongSubjects: analysis.strongSubjects,
        weakSubjects: analysis.weakSubjects,
      },
      blueprintDiagnostics: session.blueprintDiagnostics || null,
      attempted: analysis.attempted,
      questionCount: session.questionCount,
    }),
    blueprintDiagnostics: session.blueprintDiagnostics || null,
    adaptiveFollowUp: analysis.adaptiveFollowUp,
  };

  try {
    session.status = getTimeLeftSec(session) === 0 ? 'expired' : 'submitted';
    session.submittedAt = new Date();
    session.resultSummary = resultSummary;
    session.isSubmitting = false;
    session.lastActivityAt = new Date();
    session.version = Number(session.version || 0) + 1;
    await session.save();

    return resultSummary;
  } catch (error) {
    await ExamSession.updateOne(
      { _id: sessionId, user: userId },
      {
        $set: {
          isSubmitting: false,
          lastActivityAt: new Date(),
        },
        $inc: { version: 1 },
      }
    );
    throw error;
  }
};

module.exports = {
  SCORE_RULES,
  createExamSession,
  getExamSessionState,
  getLatestActiveExamSessionState,
  submitAnswer,
  submitExamSession,
};
