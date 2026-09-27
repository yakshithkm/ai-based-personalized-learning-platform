const Attempt = require('../../models/Attempt');
const LearningContentProgress = require('../../models/LearningContentProgress');
const ExamSession = require('../../models/ExamSession');
const GamificationProfile = require('../../models/GamificationProfile');
const { processHistoricalEvent, dayKey, evaluateAchievements, recomputeLevel, buildStatsSnapshot } = require('./gamificationService');

// Section 25 / examController parity: never grant XP for a submission the
// proctoring system forced.
const DISQUALIFYING_EXAM_REASONS = new Set(['MAX_VIOLATIONS', 'PRESENCE_LIMIT']);

// A backfill lock older than this is treated as abandoned (e.g. the process
// crashed mid-run) and is safe to retry, rather than leaving a user
// permanently un-backfilled.
const STALE_LOCK_MS = 10 * 60 * 1000;

// If two requests for the same never-backfilled user race (e.g. the header
// and a page's own data both load at once), the loser must not just return
// whatever's on the profile right now - that's mid-backfill and will look
// like the user has 0 XP/Level 1 to whichever caller lost the race, and
// unlike a page's own data fetch, the header only fetches once per session,
// so a stale read here can stick for the rest of it. Instead the loser polls
// briefly for the winner to finish, so every caller ends up with the same,
// complete result.
const WAIT_FOR_WINNER_TIMEOUT_MS = 20 * 1000;
const WAIT_FOR_WINNER_POLL_MS = 200;

const waitForBackfillToComplete = async (userId) => {
  const deadline = Date.now() + WAIT_FOR_WINNER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    const profile = await GamificationProfile.findOne({ user: userId }).select('historicalBackfillCompletedAt').lean();
    if (profile?.historicalBackfillCompletedAt) {
      return { ran: false, alreadyBackfilled: true };
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, WAIT_FOR_WINNER_POLL_MS));
  }
  // The winner is taking unusually long (or crashed after claiming the lock
  // but before the stale-lock window elapsed) - give up waiting rather than
  // hang the request forever. The next call in ~10 minutes will retry it.
  return { ran: false, alreadyBackfilled: false, inProgress: true, timedOutWaiting: true };
};

// Pure day-gap streak reconstruction over a sorted, deduplicated list of
// "YYYY-MM-DD" activity days. Mirrors gamificationService's day-gap streak
// logic exactly, but never touches the database - this lets the result be
// safely MERGED into a profile afterwards (see backfillUserGamification)
// instead of mutating currentStreak/lastActiveDate once per historical
// record, which could otherwise clobber a streak the user is actively
// maintaining right now if their history doesn't reach all the way to today.
const reconstructStreakFromDays = (sortedDayKeys) => {
  let currentStreak = 0;
  let longestStreak = 0;
  let lastDay = null;

  for (const day of sortedDayKeys) {
    if (lastDay === null) {
      currentStreak = 1;
    } else {
      const [ly, lm, ld] = lastDay.split('-').map(Number);
      const [cy, cm, cd] = day.split('-').map(Number);
      const gap = Math.round((Date.UTC(cy, cm - 1, cd) - Date.UTC(ly, lm - 1, ld)) / (24 * 60 * 60 * 1000));
      currentStreak = gap === 1 ? currentStreak + 1 : 1;
    }
    longestStreak = Math.max(longestStreak, currentStreak);
    lastDay = day;
  }

  return { currentStreak, longestStreak, lastActiveDate: lastDay };
};

// Runs once per user, ever: walks their existing Attempt / completed
// LearningContentProgress / submitted ExamSession history through the same
// event pipeline live actions use (so XP amounts, dedupe, and achievement
// thresholds are all computed identically - this is not a separate,
// approximate XP economy), then reconciles the resulting streak against
// whatever's already on the profile. Idempotent: safe to call on every
// summary request, a login, or from a bulk script - a completed run is a
// permanent no-op, and a concurrent run for the same user is a no-op too.
const backfillUserGamification = async (userId) => {
  const profile = await GamificationProfile.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId } },
    { new: true, upsert: true }
  );

  if (profile.historicalBackfillCompletedAt) {
    return { ran: false, alreadyBackfilled: true };
  }

  const lockIsStale =
    !profile.historicalBackfillStartedAt ||
    Date.now() - new Date(profile.historicalBackfillStartedAt).getTime() > STALE_LOCK_MS;
  if (!lockIsStale) {
    return waitForBackfillToComplete(userId);
  }

  // Claim the lock atomically - if two requests race here, only one's
  // updateOne actually matches (the filter re-checks both conditions), so
  // only one proceeds to do the work.
  const claim = await GamificationProfile.updateOne(
    {
      user: userId,
      historicalBackfillCompletedAt: null,
      $or: [
        { historicalBackfillStartedAt: null },
        { historicalBackfillStartedAt: { $lt: new Date(Date.now() - STALE_LOCK_MS) } },
      ],
    },
    { $set: { historicalBackfillStartedAt: new Date() } }
  );
  if (claim.modifiedCount === 0) {
    return waitForBackfillToComplete(userId);
  }

  const activityDays = new Set();
  let processedCount = 0;

  // --- Practice attempts ---
  // difficulty is denormalised directly onto Attempt, so no Question lookup
  // is needed. Historical per-topic accuracy AT THE MOMENT of each past
  // attempt isn't cheaply reconstructible, so weak-topic bonuses are
  // conservatively never applied retroactively - this only affects the size
  // of the historical XP grant, never counters, achievements, or streak.
  const attempts = await Attempt.find({ user: userId })
    .sort({ createdAt: 1 })
    .select('_id isCorrect timeTakenSec difficulty createdAt')
    .lean();
  for (const attempt of attempts) {
    // eslint-disable-next-line no-await-in-loop
    await processHistoricalEvent({
      userId,
      eventType: 'PRACTICE_ANSWER',
      sourceId: attempt._id,
      occurredAt: attempt.createdAt,
      metadata: {
        isCorrect: attempt.isCorrect,
        timeTakenSec: attempt.timeTakenSec,
        difficulty: attempt.difficulty,
        isWeakTopic: false,
      },
    });
    activityDays.add(dayKey(attempt.createdAt));
    processedCount += 1;
  }

  // --- Completed learning content / recommendations ---
  const completedLearning = await LearningContentProgress.find({
    user: userId,
    status: 'completed',
    completedAt: { $ne: null },
  })
    .select('_id completedAt')
    .lean();
  for (const row of completedLearning) {
    // eslint-disable-next-line no-await-in-loop
    await processHistoricalEvent({
      userId,
      eventType: 'LEARNING_COMPLETED',
      sourceId: row._id,
      occurredAt: row.completedAt,
      metadata: {},
    });
    activityDays.add(dayKey(row.completedAt));
    processedCount += 1;
  }

  // --- Submitted exams (proctoring-violation auto-submits excluded, same
  // rule as the live path in examController.finalizeExamSession).
  // Filtered on resultSummary existing rather than status === 'submitted':
  // a time-expired exam finalizes with status 'expired' (still fully
  // scored, and the live path DOES award XP for it - only MAX_VIOLATIONS/
  // PRESENCE_LIMIT are excluded there). A session merely abandoned by
  // inactivity is also marked 'expired' elsewhere in examSimulationService,
  // but never gets a resultSummary - so this filter correctly includes the
  // former and excludes the latter, matching the live gate exactly.
  const exams = await ExamSession.find({ user: userId, resultSummary: { $ne: null } })
    .select('_id submittedAt resultSummary autoSubmitReason')
    .lean();
  for (const exam of exams) {
    if (DISQUALIFYING_EXAM_REASONS.has(exam.autoSubmitReason)) continue;
    const maxScore = Number(exam.resultSummary?.scoreSummary?.maxScore || 0);
    const totalScore = Number(exam.resultSummary?.scoreSummary?.totalScore || 0);
    const scorePercent = maxScore > 0 ? Math.max(0, (totalScore / maxScore) * 100) : 0;
    const occurredAt = exam.submittedAt || new Date();
    // eslint-disable-next-line no-await-in-loop
    await processHistoricalEvent({
      userId,
      eventType: 'EXAM_COMPLETED',
      sourceId: exam._id,
      occurredAt,
      metadata: { scorePercent },
    });
    activityDays.add(dayKey(occurredAt));
    processedCount += 1;
  }

  // --- Merge the pure historical streak reconstruction into the profile ---
  const sortedDays = Array.from(activityDays).sort();
  const historical = reconstructStreakFromDays(sortedDays);

  const current = await GamificationProfile.findOne({ user: userId });
  const update = {
    $max: {
      longestStreak: historical.longestStreak,
      'personalBests.longestStreak': historical.longestStreak,
    },
    $set: { historicalBackfillCompletedAt: new Date() },
  };
  // Only adopt the historical current-streak/lastActiveDate if nothing more
  // recent has already happened live - a bulk backfill must never regress a
  // streak the user is actively maintaining today.
  if (!current.lastActiveDate || (historical.lastActiveDate && historical.lastActiveDate >= current.lastActiveDate)) {
    update.$set.currentStreak = historical.currentStreak;
    update.$set.lastActiveDate = historical.lastActiveDate;
  }
  await GamificationProfile.updateOne({ user: userId }, update);

  // A streak-length achievement (e.g. "3-Day Learner") can only be judged
  // correctly now that the FULL historical streak has been merged in -
  // question/lesson/exam-count achievements were already caught per-event
  // above, as each historical record streamed through processHistoricalEvent.
  // Checking it here, immediately, means it's recorded with its real
  // historical unlock date and never surfaces later attached to whatever
  // unrelated live action a user happens to take next.
  const mergedProfile = await GamificationProfile.findOne({ user: userId });
  const historicalUnlockAt = historical.lastActiveDate
    ? new Date(`${historical.lastActiveDate}T12:00:00.000Z`)
    : new Date();
  const lateAchievements = await evaluateAchievements(userId, buildStatsSnapshot(mergedProfile), historicalUnlockAt);
  if (lateAchievements.length) {
    await recomputeLevel(userId);
  }

  return {
    ran: true,
    alreadyBackfilled: false,
    processedCount,
    historicalStreak: historical,
    lateAchievements: lateAchievements.map((a) => a.id),
  };
};

module.exports = { backfillUserGamification, reconstructStreakFromDays };