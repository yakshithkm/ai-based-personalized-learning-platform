const Performance = require('../../models/Performance');
const Attempt = require('../../models/Attempt');
const Mistake = require('../../models/Mistake');
const Question = require('../../models/Question');
const LearningContentProgress = require('../../models/LearningContentProgress');
const LearningRecommendation = require('../../models/LearningRecommendation');
const { rebuildPerformanceForUser } = require('../performanceService');
const { getAllowedSubjectsForExam } = require('../../config/examSubjectMap');
const {
  MIN_ATTEMPTS_FULL_CONFIDENCE,
  BASELINE_ATTEMPTS_NEEDED,
} = require('./constants');

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_ATTEMPT_WINDOW = 200;
const RECENT_TOPIC_WINDOW = 10;

const norm = (value) => String(value || '').trim().toLowerCase();
const topicKey = (subject, topic) => `${subject}::${norm(topic)}`;
const conceptKey = (subject, topic, concept) => `${subject}::${norm(topic)}::${norm(concept)}`;
const confidence = (attempts) => Math.min(1, Number(attempts || 0) / MIN_ATTEMPTS_FULL_CONFIDENCE);

// Local-calendar day key (NOT toISOString - that rolls dates back for UTC+ zones such as IST).
const dayKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const daysBetween = (from, to) => {
  if (!from) return null;
  return Math.max(0, Math.floor((new Date(to).getTime() - new Date(from).getTime()) / DAY_MS));
};

// Learning level. Reuses the existing masteryScore (accuracy*0.75 + attempts bonus) with the
// requested 40/60/80 bands, plus an accuracy guard so that volume alone can never lift a
// student with poor accuracy out of the "low" band, and a 'high' level requires real accuracy.
const classifyLevel = ({ attempts = 0, accuracy = 0, mastery = 0 }) => {
  if (!attempts) return 'new';
  if (attempts >= 5 && accuracy < 50) return 'low';
  if (mastery < 40) return 'low';
  if (mastery < 60) return 'developing';
  if (mastery >= 80 && accuracy >= 80 && attempts >= 5) return 'high';
  return 'proficient';
};

const isPseudoTopic = (topic) => /full syllabus|mixed/i.test(String(topic || ''));

// --- syllabus catalog (topic weightage / previous-year importance) -------------------------
const catalogCache = new Map();
const CATALOG_TTL_MS = 5 * 60 * 1000;

const loadSyllabus = async (examType) => {
  const subjects = getAllowedSubjectsForExam(examType);
  const rows = await Question.aggregate([
    { $match: { examType, subject: { $in: subjects } } },
    {
      $group: {
        _id: { subject: '$subject', topic: '$topic' },
        questions: { $sum: 1 },
        high: { $sum: { $cond: [{ $eq: ['$weightage', 'High'] }, 1, 0] } },
        low: { $sum: { $cond: [{ $eq: ['$weightage', 'Low'] }, 1, 0] } },
        pyq: { $sum: { $cond: [{ $eq: ['$yearTag', 'Previous Year'] }, 1, 0] } },
      },
    },
  ]);

  return rows
    .map((row) => {
      const n = Math.max(row.questions, 1);
      const medium = row.questions - row.high - row.low;
      const score = (row.high * 1 + medium * 0.6 + row.low * 0.3) / n;
      return {
        subject: row._id.subject,
        topic: row._id.topic,
        questions: row.questions,
        weightage: score >= 0.8 ? 'High' : score >= 0.45 ? 'Medium' : 'Low',
        weightageScore: Number(score.toFixed(2)),
        pyqShare: Number((row.pyq / n).toFixed(2)),
      };
    })
    .sort((a, b) => b.weightageScore - a.weightageScore || b.questions - a.questions);
};

const getSyllabusCatalog = async (examType) => {
  // No caching under test: fixtures are created/deleted between tests.
  if (process.env.NODE_ENV === 'test') return loadSyllabus(examType);

  const cached = catalogCache.get(examType);
  if (cached && Date.now() - cached.at < CATALOG_TTL_MS) return cached.rows;
  const rows = await loadSyllabus(examType);
  catalogCache.set(examType, { at: Date.now(), rows });
  return rows;
};

// --- helpers -------------------------------------------------------------------------------
const pct = (correct, total) => (total ? Number(((correct / total) * 100).toFixed(1)) : null);

const buildWindowStats = (attempts, now) => {
  // attempts are newest-first.
  const byTopic = new Map();
  const byConcept = new Map();

  const push = (map, key, attempt) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(attempt);
  };

  attempts.forEach((attempt) => {
    push(byTopic, topicKey(attempt.subject, attempt.topic), attempt);
    const concept = attempt.conceptTested || `${attempt.topic} Core Concept`;
    push(byConcept, conceptKey(attempt.subject, attempt.topic, concept), attempt);
  });

  const summarize = (list) => {
    const recent = list.slice(0, RECENT_TOPIC_WINDOW);
    const older = list.slice(RECENT_TOPIC_WINDOW);
    const recentAccuracy = pct(recent.filter((a) => a.isCorrect).length, recent.length);
    const historicalAccuracy = older.length >= 5 ? pct(older.filter((a) => a.isCorrect).length, older.length) : null;
    let trend = 'stable';
    if (recentAccuracy !== null && historicalAccuracy !== null) {
      if (recentAccuracy - historicalAccuracy >= 8) trend = 'improving';
      else if (recentAccuracy - historicalAccuracy <= -8) trend = 'declining';
    }
    const slowCorrect = list.filter(
      (a) => a.isCorrect && Number(a.timeTakenSec || 0) > Number(a.expectedSolvingTimeSec || 60) * 1.25
    ).length;
    const fastWrong = list.filter((a) => !a.isCorrect && String(a.responsePace || '') === 'fast').length;
    return {
      windowAttempts: list.length,
      recentAccuracy,
      historicalAccuracy,
      trend,
      slowCorrectRate: pct(slowCorrect, list.length) ?? 0,
      fastWrongRate: pct(fastWrong, list.length) ?? 0,
      lastPracticedAt: list[0]?.createdAt || null,
      daysSincePractice: list[0] ? daysBetween(list[0].createdAt, now) : null,
    };
  };

  const topicWindow = new Map();
  byTopic.forEach((list, key) => topicWindow.set(key, summarize(list)));
  const conceptWindow = new Map();
  byConcept.forEach((list, key) => conceptWindow.set(key, summarize(list)));
  return { topicWindow, conceptWindow };
};

const buildFeedbackProfile = (progressDocs) => {
  const withDifficulty = progressDocs
    .filter((p) => p.difficultyFeedback)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, 6);
  const tooHard = withDifficulty.filter((p) => p.difficultyFeedback === 'too-difficult').length;
  const tooEasy = withDifficulty.filter((p) => p.difficultyFeedback === 'too-easy').length;
  let difficultyBias = 0;
  if (withDifficulty.length >= 2) {
    if (tooHard >= 2 && tooHard / withDifficulty.length >= 0.5) difficultyBias = -1;
    else if (tooEasy >= 2 && tooEasy / withDifficulty.length >= 0.5) difficultyBias = 1;
  }

  // Content-type affinity: helpful-rate of that type relative to neutral (0.5), scaled by
  // how many samples we have. Range -1..+1.
  const byType = new Map();
  progressDocs.forEach((p) => {
    if (p.helpful === null || p.helpful === undefined || !p.contentType) return;
    const ref = byType.get(p.contentType) || { yes: 0, total: 0 };
    ref.total += 1;
    if (p.helpful) ref.yes += 1;
    byType.set(p.contentType, ref);
  });
  const typeAffinity = {};
  byType.forEach((ref, type) => {
    if (ref.total < 2) return;
    typeAffinity[type] = Number((((ref.yes / ref.total) - 0.5) * 2 * Math.min(1, ref.total / 4)).toFixed(2));
  });

  return { difficultyBias, typeAffinity, samples: withDifficulty.length };
};

const parseDayKey = (key) => {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Per-content history from the last 30 days of recommendations. Everything is measured
// against EARLIER days only, so re-loading the page on the same day never changes a score.
const buildHistoryMap = (recs, now) => {
  const today = dayKey(now);
  const byContent = new Map();
  recs.forEach((rec) => {
    if (!rec.content) return;
    const id = String(rec.content);
    const ref = byContent.get(id) || { ignoredDays: 0, engaged: false, earlierServings: 0, lastEarlierServedAt: null };
    const engaged = Boolean(rec.clickedAt || rec.startedAt || rec.completedAt);
    ref.engaged = ref.engaged || engaged;
    const earlier = (rec.servedDays || []).filter((day) => day !== today);
    ref.earlierServings += earlier.length;
    if (!engaged) ref.ignoredDays += earlier.length; // shown on earlier days, never opened
    earlier.forEach((day) => {
      const at = parseDayKey(day);
      if (!ref.lastEarlierServedAt || at > ref.lastEarlierServedAt) ref.lastEarlierServedAt = at;
    });
    byContent.set(id, ref);
  });
  return byContent;
};

/**
 * Collects every signal the learning engine needs about one student, once, with bounded
 * queries: cached Performance summary (rebuilt only if stale), a 200-attempt window, one
 * mistake aggregation, progress rows, 30 days of recommendation history and the syllabus.
 */
const buildLearnerProfile = async (user, { now = new Date() } = {}) => {
  const userId = user._id;
  const targetExam = user.targetExam;

  const [attemptCount, cachedPerf] = await Promise.all([
    Attempt.countDocuments({ user: userId }),
    Performance.findOne({ user: userId }).lean(),
  ]);

  let perf = cachedPerf;
  if (attemptCount > 0 && (!perf || Number(perf.totalAttempts || 0) !== attemptCount)) {
    const rebuilt = await rebuildPerformanceForUser(userId);
    perf = rebuilt.toObject();
  }
  perf = perf || {};

  const since = new Date(now.getTime() - 30 * DAY_MS);
  const [recentAttempts, mistakeRows, progressDocs, recentRecs, syllabus] = await Promise.all([
    attemptCount
      ? Attempt.find({ user: userId })
          .sort({ createdAt: -1 })
          .limit(RECENT_ATTEMPT_WINDOW)
          .select('subject topic conceptTested isCorrect responsePace timeTakenSec expectedSolvingTimeSec createdAt')
          .lean()
      : [],
    Mistake.aggregate([
      { $match: { user: userId, resolved: false } },
      {
        $group: {
          _id: { subject: '$subject', topic: '$topic', concept: '$conceptTested' },
          open: { $sum: 1 },
          due: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ['$nextReviewAt', null] }, { $lte: ['$nextReviewAt', now] }] },
                1,
                0,
              ],
            },
          },
          retries: { $sum: '$retryCount' },
          lastAt: { $max: '$createdAt' },
        },
      },
    ]),
    LearningContentProgress.find({ user: userId }).sort({ lastAccessedAt: -1 }).limit(500).lean(),
    LearningRecommendation.find({ user: userId, recommendedAt: { $gte: since } })
      .select('content servedDays clickedAt startedAt completedAt lastServedAt recommendedAt')
      .limit(400)
      .lean(),
    getSyllabusCatalog(targetExam),
  ]);

  const { topicWindow, conceptWindow } = buildWindowStats(recentAttempts, now);

  // Mistakes indexed by topic and by concept.
  const mistakesByTopic = new Map();
  const mistakesByConcept = new Map();
  mistakeRows.forEach((row) => {
    const tk = topicKey(row._id.subject, row._id.topic);
    const t = mistakesByTopic.get(tk) || { open: 0, due: 0, retries: 0 };
    t.open += row.open;
    t.due += row.due;
    t.retries += row.retries;
    mistakesByTopic.set(tk, t);
    mistakesByConcept.set(conceptKey(row._id.subject, row._id.topic, row._id.concept), {
      open: row.open,
      due: row.due,
      retries: row.retries,
      subject: row._id.subject,
      topic: row._id.topic,
      concept: row._id.concept,
    });
  });

  // --- topic level (aggregate subtopic rows of the cached Performance summary) ---
  const topics = new Map();
  (perf.topicStats || []).forEach((row) => {
    const key = topicKey(row.subject, row.topic);
    const ref = topics.get(key) || {
      subject: row.subject,
      topic: row.topic,
      attempts: 0,
      correct: 0,
      accSum: 0,
      masterySum: 0,
      timeSum: 0,
      focusSum: 0,
      currentDifficulty: row.currentDifficulty || 'Medium',
    };
    const n = Number(row.attempts || 0);
    ref.attempts += n;
    ref.correct += Number(row.correct || 0);
    ref.accSum += Number(row.accuracy || 0) * n;
    ref.masterySum += Number(row.masteryScore || 0) * n;
    ref.timeSum += Number(row.avgTimeTakenSec || 0) * n;
    ref.focusSum += Number(row.focusScore || 0) * n;
    topics.set(key, ref);
  });

  topics.forEach((ref, key) => {
    const n = Math.max(ref.attempts, 1);
    const win = topicWindow.get(key) || {};
    const mistakes = mistakesByTopic.get(key) || { open: 0, due: 0, retries: 0 };
    ref.accuracy = Number((ref.accSum / n).toFixed(1));
    ref.mastery = Number((ref.masterySum / n).toFixed(1));
    ref.avgTime = Number((ref.timeSum / n).toFixed(1));
    ref.focusScore = Number((ref.focusSum / n).toFixed(1));
    ref.recentAccuracy = win.recentAccuracy ?? null;
    ref.historicalAccuracy = win.historicalAccuracy ?? null;
    ref.trend = win.trend || 'stable';
    ref.slowCorrectRate = win.slowCorrectRate ?? 0;
    ref.fastWrongRate = win.fastWrongRate ?? 0;
    ref.lastPracticedAt = win.lastPracticedAt || null;
    ref.daysSincePractice = win.daysSincePractice ?? null;
    ref.openMistakes = mistakes.open;
    ref.dueMistakes = mistakes.due;
    ref.level = classifyLevel({ attempts: ref.attempts, accuracy: ref.accuracy, mastery: ref.mastery });
    delete ref.accSum;
    delete ref.masterySum;
    delete ref.timeSum;
    delete ref.focusSum;
  });

  // --- concept level ---
  const concepts = new Map();
  (perf.conceptStats || []).forEach((row) => {
    const key = conceptKey(row.subject, row.topic, row.concept);
    const win = conceptWindow.get(key) || {};
    const mistakes = mistakesByConcept.get(key) || { open: 0, due: 0, retries: 0 };
    concepts.set(key, {
      subject: row.subject,
      topic: row.topic,
      concept: row.concept,
      attempts: row.attempts,
      accuracy: row.accuracy,
      mastery: row.masteryScore,
      avgTime: row.avgTimeTakenSec,
      mistakeFrequency: row.mistakeFrequency,
      slowCorrectRate: row.slowCorrectRate,
      recentAccuracy: win.recentAccuracy ?? null,
      trend: win.trend || 'stable',
      openMistakes: mistakes.open,
      dueMistakes: mistakes.due,
      level: classifyLevel({ attempts: row.attempts, accuracy: row.accuracy, mastery: row.masteryScore }),
    });
  });
  // Concepts that only exist as (open) mistakes with no matching performance row yet.
  mistakesByConcept.forEach((m, key) => {
    if (!concepts.has(key)) {
      concepts.set(key, {
        subject: m.subject,
        topic: m.topic,
        concept: m.concept,
        attempts: 0,
        accuracy: 0,
        mastery: 0,
        avgTime: 0,
        mistakeFrequency: 0,
        slowCorrectRate: 0,
        recentAccuracy: null,
        trend: 'stable',
        openMistakes: m.open,
        dueMistakes: m.due,
        level: 'new',
      });
    }
  });

  // Progress lookups.
  const progressByContent = new Map(progressDocs.map((p) => [String(p.content), p]));
  const completedStagesByTopic = new Map();
  progressDocs.forEach((p) => {
    if (p.status !== 'completed' || !p.learningStage) return;
    const key = topicKey(p.subject, p.topic);
    if (!completedStagesByTopic.has(key)) completedStagesByTopic.set(key, new Set());
    completedStagesByTopic.get(key).add(p.learningStage);
  });

  const totalAttempts = attemptCount;
  const dataConfidence = totalAttempts < BASELINE_ATTEMPTS_NEEDED ? 'low' : totalAttempts < 30 ? 'medium' : 'high';

  return {
    userId,
    targetExam,
    now,
    totalAttempts,
    overallAccuracy: Number(perf.overallAccuracy || 0),
    avgTime: Number(perf.averageTimeTakenSec || 0),
    accuracyTrend: perf.accuracyTrend || 'stable',
    dataConfidence,
    subjectStats: perf.subjectStats || [],
    weakTopicPriority: perf.weakTopicPriority || [],
    weakConceptPriority: perf.weakConceptPriority || [],
    topics,
    concepts,
    progressByContent,
    completedStagesByTopic,
    feedback: buildFeedbackProfile(progressDocs),
    history: buildHistoryMap(recentRecs, now),
    syllabus,
  };
};

// --- lookups used by ranking / needs ---------------------------------------------------------
const getTopicStat = (profile, subject, topic) => profile.topics.get(topicKey(subject, topic)) || null;
const getConceptStat = (profile, subject, topic, concept) =>
  concept ? profile.concepts.get(conceptKey(subject, topic, concept)) || null : null;

// Resolve a prerequisite *name* (topic or concept, same subject) to the student's stats.
const resolveNamedStat = (profile, subject, name) => {
  const wanted = norm(name);
  if (!wanted) return null;
  for (const stat of profile.topics.values()) {
    if (stat.subject === subject && norm(stat.topic) === wanted) return stat;
  }
  for (const stat of profile.concepts.values()) {
    if (stat.subject === subject && norm(stat.concept) === wanted && stat.attempts > 0) return stat;
  }
  return null;
};

module.exports = {
  buildLearnerProfile,
  classifyLevel,
  getSyllabusCatalog,
  getTopicStat,
  getConceptStat,
  resolveNamedStat,
  confidence,
  isPseudoTopic,
  topicKey,
  conceptKey,
  norm,
  dayKey,
  daysBetween,
};