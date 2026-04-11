const Attempt = require('../models/Attempt');
const Question = require('../models/Question');
const ExamSession = require('../models/ExamSession');
const { normalizeExamType, getAllowedSubjectsForExam, normalizeSubjectName } = require('../config/examSubjectMap');

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

const CANDIDATE_POOL_MULTIPLIER = 6;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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

const scoreQuestionForSelection = ({ question, weights, recentQuestionIds }) => {
  const difficultyWeight = Number(weights[question.difficulty] || 0);
  const recentPenalty = recentQuestionIds.has(String(question._id)) ? 0.22 : 0;
  const noveltyBoost = Math.random() * 0.12;
  return difficultyWeight + noveltyBoost - recentPenalty;
};

const pickQuestionsForSubject = ({ questions, count, weights, recentQuestionIds }) => {
  const ranked = [...questions]
    .map((question) => ({
      question,
      score: scoreQuestionForSelection({ question, weights, recentQuestionIds }),
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.question);

  return ranked.slice(0, count);
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
    currentQuestionIndex: session.currentQuestionIndex,
    timeLeftSec: getTimeLeftSec(session),
    scoringRules: SCORE_RULES,
    behavior: {
      hintsEnabled: false,
      explanationsEnabled: false,
      resultsVisibleBeforeSubmit: false,
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
  };
};

const autoExpireIfNeeded = async (session) => {
  if (!session || session.status !== 'active') return session;
  if (new Date(session.expiresAt).getTime() > Date.now()) return session;

  session.status = 'expired';
  session.submittedAt = new Date();
  await session.save();
  return session;
};

const createExamSession = async ({ user, mode, examType, sectionSubject, strictNavigation = false }) => {
  const resolvedExam = normalizeExamType(examType || user?.targetExam || user?.exam);
  const normalizedSection = normalizeSubjectName(sectionSubject);

  validateSessionModeRequest({
    mode,
    examType: resolvedExam,
    sectionSubject: normalizedSection,
  });

  if (mode === 'section-wise') {
    const allowed = getAllowedSubjectsForExam(resolvedExam);
    if (!allowed.includes(normalizedSection)) {
      throw new Error(`${normalizedSection} is not valid for ${resolvedExam}`);
    }
  }

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
  const selectedQuestions = [];

  for (const [subject, count] of Object.entries(distribution)) {
    const poolLimit = Math.max(count * CANDIDATE_POOL_MULTIPLIER, 120);
    const accuracy = Number(subjectAccuracy.get(subject) || 60);
    const weights = getDifficultyWeights(accuracy);

    const pool = await Question.find({
      examType: resolvedExam,
      subject,
    })
      .limit(poolLimit)
      .select('subject topic subtopic difficulty conceptTested')
      .lean();

    if (pool.length < count) {
      throw new Error(
        `Insufficient ${subject} questions for ${resolvedExam} ${mode} test. Required ${count}, found ${pool.length}.`
      );
    }

    const picked = pickQuestionsForSubject({
      questions: shuffle(pool),
      count,
      weights,
      recentQuestionIds,
    });

    selectedQuestions.push(...picked);
  }

  const shuffledSessionQuestions = shuffle(selectedQuestions).slice(0, questionCount);

  const session = await ExamSession.create({
    user: user._id,
    examType: resolvedExam,
    mode,
    sectionSubject: mode === 'section-wise' ? normalizedSection : null,
    strictNavigation: Boolean(strictNavigation),
    status: 'active',
    questionCount,
    timeLimitSec,
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + timeLimitSec * 1000),
    questionOrder: shuffledSessionQuestions.map((question) => ({
      question: question._id,
      subject: question.subject,
      topic: question.topic,
      subtopic: question.subtopic || 'General',
      difficulty: question.difficulty,
      conceptTested: question.conceptTested || `${question.topic} Core Concept`,
    })),
    responses: [],
    currentQuestionIndex: 0,
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

const submitAnswer = async ({ userId, sessionId, questionIndex, selectedAnswerIndex, timeTakenSec = 0 }) => {
  const session = await ExamSession.findOne({ _id: sessionId, user: userId });
  if (!session) {
    const error = new Error('Exam session not found');
    error.statusCode = 404;
    throw error;
  }

  await autoExpireIfNeeded(session);

  if (session.status !== 'active') {
    const error = new Error('Exam session is not active');
    error.statusCode = 400;
    throw error;
  }

  const resolvedIndex = Number(questionIndex);
  if (!Number.isInteger(resolvedIndex) || resolvedIndex < 0 || resolvedIndex >= session.questionCount) {
    const error = new Error('Invalid questionIndex');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isInteger(Number(selectedAnswerIndex)) || Number(selectedAnswerIndex) < 0 || Number(selectedAnswerIndex) > 3) {
    const error = new Error('selectedAnswerIndex must be 0..3');
    error.statusCode = 400;
    throw error;
  }

  if (session.strictNavigation && resolvedIndex !== session.currentQuestionIndex) {
    const error = new Error('Strict navigation enabled: answer the current question only');
    error.statusCode = 400;
    throw error;
  }

  const responseIdx = (session.responses || []).findIndex((entry) => entry.questionIndex === resolvedIndex);
  const payload = {
    questionIndex: resolvedIndex,
    question: session.questionOrder[resolvedIndex].question,
    selectedAnswerIndex: Number(selectedAnswerIndex),
    timeTakenSec: Math.max(0, Number(timeTakenSec || 0)),
    answeredAt: new Date(),
  };

  if (responseIdx >= 0) {
    session.responses[responseIdx] = payload;
  } else {
    session.responses.push(payload);
  }

  if (session.strictNavigation) {
    session.currentQuestionIndex = Math.min(session.currentQuestionIndex + 1, session.questionCount - 1);
  }

  await session.save();
  return serializeSessionState(session);
};

const computePercentileAndRank = ({ examType, score, maxScore }) => {
  const candidatePool = {
    NEET: 2400000,
    JEE: 1200000,
    CET: 350000,
  };

  const normalized = clamp(score / Math.max(maxScore, 1), -0.25, 1);
  const percentile = clamp(50 + normalized * 46, 1, 99.9);
  const totalCandidates = candidatePool[examType] || 500000;
  const estimatedRank = Math.max(1, Math.round(((100 - percentile) / 100) * totalCandidates));

  return {
    percentileEstimate: Number(percentile.toFixed(2)),
    rankRange: {
      low: Math.max(1, Math.round(estimatedRank * 0.88)),
      high: Math.max(1, Math.round(estimatedRank * 1.12)),
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
  const session = await ExamSession.findOne({ _id: sessionId, user: userId });
  if (!session) {
    const error = new Error('Exam session not found');
    error.statusCode = 404;
    throw error;
  }

  if (session.status === 'submitted' && session.resultSummary) {
    return session.resultSummary;
  }

  await autoExpireIfNeeded(session);

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

  const resultSummary = {
    sessionId: String(session._id),
    submittedAt: new Date(),
    scoreSummary,
    postTestAnalysis: {
      strongSubjects: analysis.strongSubjects,
      weakSubjects: analysis.weakSubjects,
      timeSpentPerSubject: analysis.timeSpentPerSubject,
      accuracyPerSubject: analysis.accuracyPerSubject,
      topMistakes: analysis.topMistakes,
      improvementProjection: analysis.improvementProjection,
    },
    adaptiveFollowUp: analysis.adaptiveFollowUp,
  };

  session.status = getTimeLeftSec(session) === 0 ? 'expired' : 'submitted';
  session.submittedAt = new Date();
  session.resultSummary = resultSummary;
  await session.save();

  return resultSummary;
};

module.exports = {
  SCORE_RULES,
  createExamSession,
  getExamSessionState,
  submitAnswer,
  submitExamSession,
};
