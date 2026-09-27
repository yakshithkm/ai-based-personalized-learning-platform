const { getProfileSummary } = require('../services/gamification/gamificationService');
const { backfillUserGamification } = require('../services/gamification/backfillService');
const GamificationEvent = require('../models/GamificationEvent');
const UserAchievement = require('../models/UserAchievement');
const { ACHIEVEMENTS } = require('../services/gamification/config');

// Runs the one-time historical backfill (see backfillService.js) before
// reading a user's gamification data, so an existing account's - or a seeded
// demo account's - prior Attempt/LearningContentProgress/ExamSession history
// is reflected instead of showing Level 1 / 0 XP forever. Kept out of the
// live XP-award path (processEvent) entirely so answering a practice
// question never pays this one-time cost; it only runs from these read
// endpoints, and is a permanent no-op after the first successful run.
// Best-effort: a failure here must never break the summary/profile response.
const ensureBackfilled = async (userId) => {
  try {
    await backfillUserGamification(userId);
  } catch (error) {
    // Swallowed on purpose - see comment above.
  }
};

// GET /api/gamification/summary
// One efficient, aggregated payload for the dashboard/header - avoids every
// widget independently hitting the API (section 33/48).
const getSummary = async (req, res, next) => {
  try {
    await ensureBackfilled(req.user._id);
    const summary = await getProfileSummary(req.user._id);
    return res.json(summary);
  } catch (error) {
    return next(error);
  }
};

// GET /api/gamification/profile
const getProfile = async (req, res, next) => {
  try {
    await ensureBackfilled(req.user._id);
    const summary = await getProfileSummary(req.user._id);
    return res.json(summary.profile);
  } catch (error) {
    return next(error);
  }
};

// GET /api/gamification/achievements
const getAchievements = async (req, res, next) => {
  try {
    await ensureBackfilled(req.user._id);
    const unlocked = await UserAchievement.find({ user: req.user._id }).lean();
    const unlockedMap = new Map(unlocked.map((row) => [row.achievementId, row]));
    const achievements = ACHIEVEMENTS.map((a) => ({
      id: a.id,
      label: a.label,
      description: a.description,
      category: a.category,
      xp: a.xp,
      unlocked: unlockedMap.has(a.id),
      unlockedAt: unlockedMap.get(a.id)?.createdAt || null,
    }));
    return res.json({ achievements });
  } catch (error) {
    return next(error);
  }
};

// GET /api/gamification/history
const getHistory = async (req, res, next) => {
  try {
    await ensureBackfilled(req.user._id);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const events = await GamificationEvent.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('eventType xpAwarded label createdAt')
      .lean();
    return res.json({ events });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getSummary,
  getProfile,
  getAchievements,
  getHistory,
};