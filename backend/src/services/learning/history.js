const LearningRecommendation = require('../../models/LearningRecommendation');
const QuestionRecommendationLog = require('../../models/QuestionRecommendationLog');
const { RECOMMENDATION_REUSE_DAYS } = require('./constants');
const { dayKey } = require('./learnerProfile');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Persists the recommendations that were actually shown. While an episode is open the same
 * document is refreshed (stable _id, no duplicates - enforced by the partial unique index);
 * stale never-engaged episodes are closed after RECOMMENDATION_REUSE_DAYS so repeated
 * recommendations over time are visible in history.
 * Returns Map<dedupeKey, recommendationDoc>.
 */
const recordServed = async (userId, items, now = new Date()) => {
  if (!items.length) return new Map();

  await LearningRecommendation.updateMany(
    {
      user: userId,
      open: true,
      status: 'active',
      recommendedAt: { $lt: new Date(now.getTime() - RECOMMENDATION_REUSE_DAYS * DAY_MS) },
    },
    { $set: { open: false, status: 'expired' } }
  );

  const today = dayKey(now);
  const ops = items.map((item) => ({
    updateOne: {
      filter: { user: userId, dedupeKey: item.dedupeKey, open: true },
      update: {
        $set: {
          content: item.content || null,
          kind: item.kind,
          section: item.section || '',
          recommendationReason: item.recommendationReason,
          reason: item.reason,
          priority: item.priority,
          score: item.score,
          stage: item.stage || '',
          contentGap: Boolean(item.contentGap),
          target: item.target,
          signals: item.signals || {},
          lastServedAt: now,
        },
        $setOnInsert: { recommendedAt: now, status: 'active', before: item.before || {} },
        $inc: { impressions: 1 },
        $addToSet: { servedDays: today },
      },
      upsert: true,
    },
  }));

  try {
    await LearningRecommendation.bulkWrite(ops, { ordered: false });
  } catch (error) {
    // A concurrent request may have created the same open episode first (E11000 on the
    // partial unique index). That's fine - the document we want exists; just read it below.
    const onlyDuplicateKeys =
      error?.code === 11000 || (error?.writeErrors || []).every((e) => e?.err?.code === 11000 || e?.code === 11000);
    if (!onlyDuplicateKeys) throw error;
  }

  const docs = await LearningRecommendation.find({
    user: userId,
    open: true,
    dedupeKey: { $in: items.map((i) => i.dedupeKey) },
  }).lean();
  return new Map(docs.map((doc) => [doc.dedupeKey, doc]));
};

// --- question-engine history (replaces the old in-memory Map) --------------------------------
const getQuestionHistory = async (userId, limit = 120) => {
  const rows = await QuestionRecommendationLog.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('question topic subtopic difficulty recommendationReason createdAt')
    .lean();
  // Oldest -> newest, matching the shape/ordering the freshness scoring already expects.
  return rows.reverse().map((row) => ({
    questionId: String(row.question),
    topic: row.topic,
    subtopic: row.subtopic || 'General',
    difficulty: row.difficulty || 'Medium',
    recommendationReason: row.recommendationReason,
    createdAt: row.createdAt,
  }));
};

const logQuestionRecommendations = async (userId, questions, now = new Date()) => {
  if (!questions.length) return;
  await QuestionRecommendationLog.insertMany(
    questions.map((q) => ({
      user: userId,
      question: q._id,
      topic: q.topic,
      subtopic: q.subtopic || 'General',
      difficulty: q.difficulty || 'Medium',
      recommendationReason: q.recommendationReason || 'fallback',
      createdAt: now,
    })),
    { ordered: false }
  );
};

module.exports = { recordServed, getQuestionHistory, logQuestionRecommendations };