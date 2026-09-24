const mongoose = require('mongoose');
const LearningContent = require('../../models/LearningContent');
const LearningContentProgress = require('../../models/LearningContentProgress');
const LearningRecommendation = require('../../models/LearningRecommendation');
const { HttpError } = require('./errors');
const { captureBefore, evaluateEffectiveness } = require('./effectiveness');
const { serializeContent, serializeProgress, serializeRecommendation } = require('./serializers');
const { DIFFICULTY_FEEDBACK, DEFAULT_PRACTICE_COUNT } = require('./constants');

const MAX_DELTA_SEC = 60 * 60; // a single progress ping can add at most an hour
const MAX_TOTAL_SEC = 24 * 60 * 60;

const loadOwned = async (userId, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new HttpError(400, 'Invalid recommendation id');
  const rec = await LearningRecommendation.findOne({ _id: id, user: userId });
  if (!rec) throw new HttpError(404, 'Recommendation not found');
  return rec;
};

const loadActiveContent = async (rec) => {
  if (!rec.content) return null;
  const content = await LearningContent.findOne({ _id: rec.content, isActive: true }).lean();
  if (!content) {
    // Disabled or deleted since it was recommended: close the episode instead of serving it.
    if (rec.open) {
      rec.open = false;
      rec.status = 'expired';
      await rec.save();
    }
    throw new HttpError(410, 'This learning resource is no longer available');
  }
  return content;
};

const cleanDelta = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), MAX_DELTA_SEC);
};

const snapshotFields = (content) => ({
  subject: content.subject,
  topic: content.topic,
  contentType: content.contentType,
  contentDifficulty: content.difficulty,
  learningStage: content.learningStage,
});

const practiceInfo = (rec) => ({
  available: true,
  count: DEFAULT_PRACTICE_COUNT,
  route: `/practice?mode=content-practice&rec=${rec._id}&count=${DEFAULT_PRACTICE_COUNT}`,
});

// Atomic upsert: avoids the find-then-create race where two nearly-simultaneous /start (or
// /skip) calls for the same (user, content) both see "no progress yet" and both try to insert
// one, which trips the unique index (E11000) on the second insert. findOneAndUpdate with
// upsert lets MongoDB itself dedupe concurrent requests instead of racing in application code.
const upsertProgressShell = async (userId, content) =>
  LearningContentProgress.findOneAndUpdate(
    { user: userId, content: content._id },
    { $setOnInsert: { user: userId, content: content._id, ...snapshotFields(content) } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

/** Start (or reopen) a recommendation: marks click+start, creates/reopens progress, returns content. */
const startRecommendation = async (user, id, now = new Date()) => {
  const rec = await loadOwned(user._id, id);
  if (['completed'].includes(rec.status) === false && !rec.open) {
    throw new HttpError(409, 'This recommendation is no longer active');
  }
  const content = await loadActiveContent(rec);

  if (!rec.startedAt) {
    rec.before = await captureBefore(user._id, rec.target, now);
    rec.startedAt = now;
  }
  rec.clickedAt = rec.clickedAt || now;
  if (rec.status === 'active') rec.status = 'started';
  await rec.save();

  let progress = null;
  if (content) {
    progress = await upsertProgressShell(user._id, content);
    if (progress.status !== 'completed') {
      progress.status = 'in-progress';
      progress.skipped = false;
    }
    progress.startedAt = progress.startedAt || now;
    progress.lastAccessedAt = now;
    await progress.save();
  }

  return {
    recommendation: serializeRecommendation(rec),
    content: serializeContent(content, { includeBody: true }),
    progress: serializeProgress(progress),
    practice: practiceInfo(rec),
  };
};

const requireProgress = async (userId, rec) => {
  if (!rec.content) throw new HttpError(400, 'This recommendation has no learning content to track');
  const progress = await LearningContentProgress.findOne({ user: userId, content: rec.content });
  if (!progress) throw new HttpError(409, 'Start this recommendation before reporting progress');
  return progress;
};

const updateProgress = async (user, id, { progressPercent, timeSpentSec }, now = new Date()) => {
  const rec = await loadOwned(user._id, id);
  const progress = await requireProgress(user._id, rec);

  const pct = Number(progressPercent);
  if (progressPercent !== undefined && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
    throw new HttpError(400, 'progressPercent must be a number between 0 and 100');
  }
  if (timeSpentSec !== undefined && (!Number.isFinite(Number(timeSpentSec)) || Number(timeSpentSec) < 0)) {
    throw new HttpError(400, 'timeSpentSec must be a non-negative number');
  }
  if (progressPercent === undefined && timeSpentSec === undefined) {
    throw new HttpError(400, 'progressPercent or timeSpentSec is required');
  }

  if (progress.status !== 'completed') {
    if (progressPercent !== undefined) {
      // Monotonic, and 100% is only reached through /complete.
      progress.progressPercent = Math.max(progress.progressPercent, Math.min(Math.round(pct), 99));
    }
    if (progress.status === 'not-started' || progress.status === 'skipped') progress.status = 'in-progress';
  }
  const delta = cleanDelta(timeSpentSec);
  progress.timeSpentSec = Math.min(progress.timeSpentSec + delta, MAX_TOTAL_SEC);
  progress.lastAccessedAt = now;
  await progress.save();

  rec.timeSpentSec = progress.timeSpentSec;
  await rec.save();
  return { recommendation: serializeRecommendation(rec), progress: serializeProgress(progress) };
};

const completeRecommendation = async (user, id, { timeSpentSec } = {}, now = new Date()) => {
  const rec = await loadOwned(user._id, id);
  if (!rec.content) throw new HttpError(400, 'This recommendation has no learning content to complete');
  const progress = await requireProgress(user._id, rec);

  if (rec.status === 'completed' && progress.status === 'completed') {
    return {
      recommendation: serializeRecommendation(rec),
      progress: serializeProgress(progress),
      practice: practiceInfo(rec),
      alreadyCompleted: true,
    };
  }

  progress.status = 'completed';
  progress.progressPercent = 100;
  progress.completedAt = progress.completedAt || now;
  progress.skipped = false;
  progress.lastAccessedAt = now;
  progress.timeSpentSec = Math.min(progress.timeSpentSec + cleanDelta(timeSpentSec), MAX_TOTAL_SEC);
  await progress.save();

  rec.status = 'completed';
  rec.open = false;
  rec.completedAt = progress.completedAt;
  rec.startedAt = rec.startedAt || progress.startedAt || now;
  rec.timeSpentSec = progress.timeSpentSec;
  await rec.save();

  return {
    recommendation: serializeRecommendation(rec),
    progress: serializeProgress(progress),
    practice: practiceInfo(rec),
    effectiveness: await evaluateEffectiveness(rec.toObject(), { now, persist: false }),
  };
};

const skipRecommendation = async (user, id, now = new Date()) => {
  const rec = await loadOwned(user._id, id);
  if (rec.status === 'completed') throw new HttpError(409, 'A completed recommendation cannot be skipped');

  if (rec.content) {
    const content = await LearningContent.findById(rec.content).lean();
    if (content) {
      const progress = await upsertProgressShell(user._id, content);
      if (progress.status !== 'completed') {
        progress.status = 'skipped';
        progress.skipped = true;
        progress.lastAccessedAt = now;
        await progress.save();
      }
    }
  }

  rec.status = 'dismissed';
  rec.open = false;
  rec.dismissedAt = now;
  await rec.save();
  return { recommendation: serializeRecommendation(rec) };
};

const saveFeedback = async (user, id, body = {}, now = new Date()) => {
  const rec = await loadOwned(user._id, id);
  const { helpful, difficulty, rating } = body;

  if (helpful === undefined && difficulty === undefined && rating === undefined) {
    throw new HttpError(400, 'Provide helpful, difficulty or rating');
  }
  if (helpful !== undefined && typeof helpful !== 'boolean') throw new HttpError(400, 'helpful must be true or false');
  if (difficulty !== undefined && !DIFFICULTY_FEEDBACK.includes(difficulty)) {
    throw new HttpError(400, `difficulty must be one of ${DIFFICULTY_FEEDBACK.join(', ')}`);
  }
  if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new HttpError(400, 'rating must be an integer between 1 and 5');
  }

  if (helpful !== undefined) rec.feedback.helpful = helpful;
  if (difficulty !== undefined) rec.feedback.difficulty = difficulty;
  if (rating !== undefined) rec.feedback.rating = rating;
  rec.feedback.at = now;
  await rec.save();

  let progress = null;
  if (rec.content) {
    progress = await LearningContentProgress.findOne({ user: user._id, content: rec.content });
    if (progress) {
      if (helpful !== undefined) progress.helpful = helpful;
      if (difficulty !== undefined) progress.difficultyFeedback = difficulty;
      if (rating !== undefined) progress.rating = rating;
      await progress.save();
    }
  }
  return { recommendation: serializeRecommendation(rec), progress: serializeProgress(progress) };
};

module.exports = {
  loadOwned,
  startRecommendation,
  updateProgress,
  completeRecommendation,
  skipRecommendation,
  saveFeedback,
};