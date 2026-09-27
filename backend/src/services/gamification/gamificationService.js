const GamificationProfile = require('../../models/GamificationProfile');
const GamificationEvent = require('../../models/GamificationEvent');
const UserAchievement = require('../../models/UserAchievement');
const {
  XP_AWARDS,
  SPEED_BONUS_THRESHOLD_SEC,
  SPEED_BONUS_XP,
  levelForTotalXp,
  STREAK_MILESTONES,
  STREAK_SHIELD_EARN_INTERVAL_DAYS,
  STREAK_SHIELD_MAX,
  ACHIEVEMENTS,
} = require('./config');

const MONGO_DUPLICATE_KEY_ERROR = 11000;

// Same local-calendar-day convention used across the app (see
// analysisService.dayKey) - deliberately not toISOString(), which rolls the
// date back a day for any timezone ahead of UTC.
const dayKey = (date = new Date()) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const daysBetween = (fromKey, toKey) => {
  if (!fromKey) return null;
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
};

// Events that count as "meaningful learning activity" for streak/daily-
// activity purposes (section 10). Deliberately excludes plain logins/page
// views - only real learning actions extend a streak.
const STREAK_ELIGIBLE_EVENTS = new Set([
  'PRACTICE_ANSWER',
  'LEARNING_COMPLETED',
  'RECOMMENDATION_COMPLETED',
  'EXAM_COMPLETED',
  'FLASHCARD_SESSION_COMPLETED',
  'MISTAKE_REVIEWED',
  'STUDY_TASK_COMPLETED',
]);

const ensureProfile = async (userId) => {
  const profile = await GamificationProfile.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId } },
    { new: true, upsert: true }
  );
  return profile;
};

// Recomputes level/currentLevelXp/xpForNextLevel from totalXp and persists
// them. Kept as a separate step (rather than trusting incrementally-tracked
// level fields) so the level is always a pure, verifiable function of
// totalXp - it can never drift out of sync.
const recomputeLevel = async (userId) => {
  const profile = await GamificationProfile.findOne({ user: userId });
  const { level, currentLevelXp, xpForNextLevel } = levelForTotalXp(profile.totalXp);
  const previousLevel = profile.level;
  profile.level = level;
  profile.currentLevelXp = currentLevelXp;
  profile.xpForNextLevel = xpForNextLevel;
  await profile.save();
  return { profile, previousLevel, leveledUp: level > previousLevel };
};

// Advances dailyXp/weeklyXp for a fresh XP award. Uses a conditional atomic
// $inc first (matched against today's/this week's bucket key), falling back
// to a $set only when the bucket has actually rolled over - this avoids the
// classic lost-update race a plain read-then-write would have under
// concurrent requests for the same user (e.g. two quick attempts, or an
// exam's base award and its score bonus landing back-to-back): two
// overlapping reads of the same stale dailyXp value would otherwise let one
// write clobber the other's increment. totalXp itself never had this
// problem (it's always a bare $inc); this brings dailyXp/weeklyXp to the
// same standard - they're currently display-only stats, but should still be
// correct.
const rollDailyWeeklyXp = async (userId, xpAmount, now) => {
  const today = dayKey(now);
  // ISO week start (Monday) as a stable weekly bucket key.
  const d = new Date(now);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - dow);
  const weekKey = dayKey(weekStart);

  const dailyBump = await GamificationProfile.updateOne(
    { user: userId, dailyXpDate: today },
    { $inc: { dailyXp: xpAmount } }
  );
  if (dailyBump.matchedCount === 0) {
    // Either the very first award ever, or the day just rolled over -
    // either way there's nothing to add to, so this bucket starts fresh.
    // A second concurrent rollover for the same new day can still race
    // here (both take this branch and both $set the same starting value),
    // but that's a single missed increment at the rarest possible moment
    // (the first event of a new day) rather than the constant, everyday
    // risk the old read-then-write had.
    await GamificationProfile.updateOne(
      { user: userId },
      { $set: { dailyXp: xpAmount, dailyXpDate: today } }
    );
  }

  const weeklyBump = await GamificationProfile.updateOne(
    { user: userId, weeklyXpWeekStart: weekKey },
    { $inc: { weeklyXp: xpAmount } }
  );
  if (weeklyBump.matchedCount === 0) {
    await GamificationProfile.updateOne(
      { user: userId },
      { $set: { weeklyXp: xpAmount, weeklyXpWeekStart: weekKey } }
    );
  }

  const profile = await GamificationProfile.findOne({ user: userId }).select('dailyXp').lean();
  await GamificationProfile.updateOne(
    { user: userId },
    { $max: { 'personalBests.mostXpInADay': profile?.dailyXp || xpAmount } }
  );
};

// Updates streak counters at most once per calendar day, awards the
// DAILY_ACTIVITY + STREAK_DAY XP events (idempotent via the same
// GamificationEvent dedupe mechanism), and spends/earns streak shields.
// Returns { streakExtended, currentStreak, longestStreak, milestoneHit }.
const updateStreak = async (userId, now) => {
  const today = dayKey(now);
  const profile = await GamificationProfile.findOne({ user: userId });

  if (profile.lastActiveDate === today) {
    return {
      streakExtended: false,
      currentStreak: profile.currentStreak,
      longestStreak: profile.longestStreak,
      milestoneHit: null,
    };
  }

  const gap = daysBetween(profile.lastActiveDate, today);
  let nextStreak;
  let shieldConsumed = false;

  if (profile.lastActiveDate === null) {
    nextStreak = 1;
  } else if (gap === 1) {
    nextStreak = profile.currentStreak + 1;
  } else if (gap === 2 && profile.streakShields > 0) {
    // Exactly one day was missed and a shield is available - protect it.
    nextStreak = profile.currentStreak + 1;
    shieldConsumed = true;
  } else {
    nextStreak = 1;
  }

  const longestStreak = Math.max(profile.longestStreak, nextStreak);

  // Earn a new shield every STREAK_SHIELD_EARN_INTERVAL_DAYS of streak,
  // capped at STREAK_SHIELD_MAX, and never for the same streak length twice.
  let shieldsEarned = 0;
  if (
    nextStreak > 0 &&
    nextStreak % STREAK_SHIELD_EARN_INTERVAL_DAYS === 0 &&
    nextStreak > profile.streakShieldsEarnedAtStreak &&
    profile.streakShields < STREAK_SHIELD_MAX
  ) {
    shieldsEarned = 1;
  }

  await GamificationProfile.updateOne(
    { user: userId },
    {
      $set: {
        currentStreak: nextStreak,
        longestStreak,
        lastActiveDate: today,
        ...(shieldsEarned ? { streakShieldsEarnedAtStreak: nextStreak } : {}),
      },
      $inc: {
        streakShields: shieldsEarned - (shieldConsumed ? 1 : 0),
      },
      $max: { 'personalBests.longestStreak': longestStreak },
    }
  );

  const milestoneHit = STREAK_MILESTONES.includes(nextStreak) ? nextStreak : null;

  // Best-effort XP for the day's activity + maintaining the streak. These
  // go through the same dedupe path as any other event so a page refresh
  // can never double-award them.
  await awardEvent({
    userId,
    eventType: 'DAILY_ACTIVITY',
    dedupeKey: `DAILY_ACTIVITY:${today}`,
    xpAwarded: XP_AWARDS.DAILY_ACTIVITY,
    label: 'Daily activity',
    now,
  });
  if (nextStreak > 1 || shieldConsumed) {
    await awardEvent({
      userId,
      eventType: 'STREAK_DAY',
      dedupeKey: `STREAK_DAY:${today}`,
      xpAwarded: XP_AWARDS.STREAK_DAY,
      label: `Streak maintained (${nextStreak} days)`,
      now,
    });
  }

  return { streakExtended: true, currentStreak: nextStreak, longestStreak, milestoneHit, shieldConsumed };
};

// Low-level: tries to insert a GamificationEvent (the idempotency gate) and,
// only if that succeeds, applies the XP to the profile. Returns
// { awarded: boolean, xpAwarded }.
const awardEvent = async ({ userId, eventType, dedupeKey, xpAwarded, label, sourceId, metadata, now }) => {
  if (!xpAwarded) {
    // Some events (e.g. level-catalog achievements) are XP-free; still log
    // them for the history feed if a dedupeKey was given, but skip the
    // profile write entirely.
    return { awarded: false, xpAwarded: 0 };
  }

  const occurredAt = now || new Date();
  try {
    const doc = new GamificationEvent({
      user: userId,
      eventType,
      dedupeKey,
      sourceId: sourceId ?? null,
      xpAwarded,
      label: label || eventType,
      metadata: metadata || {},
    });
    // createdAt is set explicitly (rather than left to mongoose's default
    // "now") so a backfilled historical event keeps its real date instead
    // of showing up as if it happened the day the migration ran - the XP
    // history feed (section 31) stays honest either way.
    doc.createdAt = occurredAt;
    doc.updatedAt = occurredAt;
    await doc.save({ timestamps: false });
  } catch (error) {
    if (error && error.code === MONGO_DUPLICATE_KEY_ERROR) {
      // Already awarded for this exact source - not an error, just a no-op.
      return { awarded: false, xpAwarded: 0 };
    }
    throw error;
  }

  await GamificationProfile.updateOne({ user: userId }, { $inc: { totalXp: xpAwarded } });
  await rollDailyWeeklyXp(userId, xpAwarded, occurredAt);

  return { awarded: true, xpAwarded };
};

const computeXpForPracticeAnswer = ({ isCorrect, timeTakenSec, difficulty, isWeakTopic }) => {
  let xp = XP_AWARDS.PRACTICE_ANSWER;
  if (isCorrect) {
    xp = XP_AWARDS.PRACTICE_ANSWER_CORRECT;
    if (isWeakTopic) xp = XP_AWARDS.PRACTICE_ANSWER_CORRECT_WEAK_TOPIC;
    else if (difficulty === 'Hard') xp = XP_AWARDS.PRACTICE_ANSWER_CORRECT_HARD;
    if (Number(timeTakenSec || 0) <= SPEED_BONUS_THRESHOLD_SEC) xp += SPEED_BONUS_XP;
  }
  return xp;
};

const examScoreBonus = (percent) => {
  if (percent >= 95) return XP_AWARDS.EXAM_SCORE_95;
  if (percent >= 90) return XP_AWARDS.EXAM_SCORE_90;
  if (percent >= 80) return XP_AWARDS.EXAM_SCORE_80;
  return 0;
};

// Evaluates the full achievement catalog against a stats snapshot, persists
// any newly-earned ones (idempotent via the unique (user, achievementId)
// index), and returns the list actually unlocked THIS call.
const evaluateAchievements = async (userId, statsSnapshot, now) => {
  const occurredAt = now || new Date();
  const alreadyUnlocked = await UserAchievement.find({ user: userId }).select('achievementId').lean();
  const unlockedIds = new Set(alreadyUnlocked.map((a) => a.achievementId));

  const newlyUnlocked = [];
  for (const achievement of ACHIEVEMENTS) {
    if (unlockedIds.has(achievement.id)) continue;
    let earned = false;
    try {
      earned = Boolean(achievement.check(statsSnapshot));
    } catch (error) {
      earned = false;
    }
    if (!earned) continue;

    try {
      const doc = new UserAchievement({
        user: userId,
        achievementId: achievement.id,
        xpAwarded: achievement.xp || 0,
      });
      // Same reasoning as GamificationEvent above - a backfilled achievement
      // keeps the date it was actually earned, not the migration's run date.
      doc.createdAt = occurredAt;
      doc.updatedAt = occurredAt;
      await doc.save({ timestamps: false });
    } catch (error) {
      if (error && error.code === MONGO_DUPLICATE_KEY_ERROR) continue; // race-safe
      throw error;
    }

    if (achievement.xp) {
      await GamificationProfile.updateOne({ user: userId }, { $inc: { totalXp: achievement.xp } });
      await rollDailyWeeklyXp(userId, achievement.xp, occurredAt);
    }

    newlyUnlocked.push(achievement);
  }

  return newlyUnlocked;
};

const buildStatsSnapshot = (profile) => ({
  totalQuestionsAnswered: profile.totalQuestionsAnswered,
  totalQuestionsCorrect: profile.totalQuestionsCorrect,
  overallAccuracy: profile.totalQuestionsAnswered
    ? Math.round((profile.totalQuestionsCorrect / profile.totalQuestionsAnswered) * 1000) / 10
    : 0,
  totalLearningContentCompleted: profile.totalLearningContentCompleted,
  totalExamsCompleted: profile.totalExamsCompleted,
  totalFlashcardsReviewed: profile.totalFlashcardsReviewed,
  totalMistakesReviewed: profile.totalMistakesReviewed,
  bestExamScorePercent: profile.bestExamScorePercent,
  currentStreak: profile.currentStreak,
  longestStreak: profile.longestStreak,
  level: profile.level,
});

// Shared implementation behind processEvent (live) and processHistoricalEvent
// (used only by the one-time backfill migration - see backfillService.js).
// includeStreak is false for backfill: historical streak reconstruction is
// done separately, in bulk, from the full activity-day history rather than
// one day-gap check per historical record (see backfillService for why -
// mutating the shared streak fields record-by-record in chronological order
// could otherwise clobber a streak the user is actively maintaining today).
// occurredAt lets a historical record keep its real date instead of being
// stamped with "now" (the day the migration happens to run).
const runPipeline = async ({ userId, eventType, sourceId, metadata = {}, occurredAt, includeStreak }) => {
  if (!userId || !eventType) {
    throw new Error('processEvent requires userId and eventType');
  }
  await ensureProfile(userId);
  const now = occurredAt ? new Date(occurredAt) : new Date();

  let xpAwarded = 0;
  let dedupeKey = sourceId ? `${eventType}:${sourceId}` : null;
  const counterInc = {};
  let bonusXp = 0;
  let bonusLabel = null;

  switch (eventType) {
    case 'PRACTICE_ANSWER': {
      xpAwarded = computeXpForPracticeAnswer(metadata);
      counterInc.totalQuestionsAnswered = 1;
      if (metadata.isCorrect) counterInc.totalQuestionsCorrect = 1;
      break;
    }
    case 'LEARNING_COMPLETED':
    case 'RECOMMENDATION_COMPLETED': {
      xpAwarded = XP_AWARDS[eventType];
      counterInc.totalLearningContentCompleted = 1;
      break;
    }
    case 'FLASHCARD_SESSION_COMPLETED': {
      xpAwarded = 15;
      counterInc.totalFlashcardsReviewed = Number(metadata.cardsReviewed || 1);
      break;
    }
    case 'MISTAKE_REVIEWED': {
      xpAwarded = 8;
      counterInc.totalMistakesReviewed = 1;
      break;
    }
    case 'MISTAKE_CORRECTED': {
      xpAwarded = 15;
      break;
    }
    case 'STUDY_TASK_COMPLETED': {
      xpAwarded = 20;
      counterInc.totalStudyTasksCompleted = 1;
      break;
    }
    case 'EXAM_COMPLETED': {
      xpAwarded = XP_AWARDS.EXAM_COMPLETED;
      counterInc.totalExamsCompleted = 1;
      const percent = Number(metadata.scorePercent || 0);
      bonusXp = examScoreBonus(percent);
      if (bonusXp) bonusLabel = `Exam score bonus (${percent.toFixed(0)}%)`;
      break;
    }
    default: {
      xpAwarded = XP_AWARDS[eventType] || 0;
      break;
    }
  }

  // Every XP-awarding event MUST have a real sourceId to dedupe against -
  // the `${eventType}:${now.getTime()}` fallback below only exists for
  // zero-XP/informational calls. Without this guard, a future caller that
  // forgets to pass sourceId would silently get a dedupeKey that (almost)
  // never collides with itself, defeating the entire anti-farming design
  // for that event type - fail loudly here instead of shipping a quiet XP
  // farm.
  if (xpAwarded > 0 && !sourceId) {
    throw new Error(`processEvent: eventType "${eventType}" awards XP but was called without a sourceId`);
  }

  const result = await awardEvent({
    userId,
    eventType,
    dedupeKey: dedupeKey || `${eventType}:${now.getTime()}`,
    xpAwarded,
    label: metadata.label,
    sourceId,
    metadata,
    now,
  });

  // Bonus (e.g. exam score bonus) is a distinct, separately-dedupable event
  // so it can never be double-granted independent of the base award.
  let bonusResult = { awarded: false, xpAwarded: 0 };
  if (bonusXp && sourceId) {
    bonusResult = await awardEvent({
      userId,
      eventType: `${eventType}_BONUS`,
      dedupeKey: `${eventType}_BONUS:${sourceId}`,
      xpAwarded: bonusXp,
      label: bonusLabel,
      sourceId,
      metadata,
      now,
    });
  }

  // Only touch counters / personal bests / streak if the base event was
  // actually new (not a duplicate resubmission).
  if (result.awarded && Object.keys(counterInc).length) {
    await GamificationProfile.updateOne({ user: userId }, { $inc: counterInc });
  }

  if (result.awarded && eventType === 'EXAM_COMPLETED') {
    const percent = Number(metadata.scorePercent || 0);
    await GamificationProfile.updateOne(
      { user: userId },
      {
        $max: {
          bestExamScorePercent: percent,
          'personalBests.highestExamScorePercent': percent,
        },
      }
    );
  }

  let streakInfo = null;
  if (result.awarded && includeStreak && STREAK_ELIGIBLE_EVENTS.has(eventType)) {
    streakInfo = await updateStreak(userId, now);
  }

  const { profile, previousLevel, leveledUp } = await recomputeLevel(userId);

  const statsSnapshot = buildStatsSnapshot(profile);
  const newAchievements = result.awarded ? await evaluateAchievements(userId, statsSnapshot, now) : [];

  // Level may have shifted again if achievements granted bonus XP - refetch,
  // and fold that second check into `leveledUp` too. Without this, an event
  // that doesn't cross a level boundary on its own but whose achievement
  // bonus XP does would silently update the number without ever firing the
  // level-up modal (previousLevel/leveledUp would still reflect only the
  // first, pre-achievement check).
  let final = profile;
  let leveledUpFinal = leveledUp;
  if (newAchievements.length) {
    const second = await recomputeLevel(userId);
    final = second.profile;
    leveledUpFinal = leveledUpFinal || second.leveledUp;
  }

  return {
    xpAwarded: result.xpAwarded + bonusResult.xpAwarded,
    duplicate: !result.awarded,
    totalXp: final.totalXp,
    level: final.level,
    currentLevelXp: final.currentLevelXp,
    xpForNextLevel: final.xpForNextLevel,
    previousLevel,
    leveledUp: leveledUpFinal,
    streak: streakInfo,
    newAchievements: newAchievements.map((a) => ({
      id: a.id,
      label: a.label,
      description: a.description,
      category: a.category,
      xp: a.xp,
    })),
  };
};

// Live entry point every controller should call. Handles the full pipeline:
// idempotent XP award -> counter increments -> streak update (for eligible
// events) -> level recompute -> achievement evaluation.
//
// eventType: one of the events in services/gamification/config.js / the
//   list in the design doc (PRACTICE_ANSWER, PRACTICE_ANSWER_CORRECT,
//   LEARNING_COMPLETED, EXAM_COMPLETED, ...).
// sourceId: the real record this event is about (attempt id, recommendation
//   id, exam session id, ...) - used to build the dedupe key.
// metadata: event-specific extra context (difficulty, isWeakTopic, scorePercent, ...).
const processEvent = (params) => runPipeline({ ...params, includeStreak: true });

// Backfill-only entry point (see backfillService.js). Identical to
// processEvent except it never touches the live streak fields directly -
// callers pass historical `occurredAt` timestamps and are responsible for
// reconstructing/merging streak state themselves once all records are
// processed.
const processHistoricalEvent = (params) => runPipeline({ ...params, includeStreak: false });

const getProfileSummary = async (userId) => {
  const profile = await ensureProfile(userId);
  const statsSnapshot = buildStatsSnapshot(profile);

  const unlockedRows = await UserAchievement.find({ user: userId }).sort({ createdAt: -1 }).lean();
  const unlockedIds = new Set(unlockedRows.map((r) => r.achievementId));
  const catalogById = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

  const recentAchievements = unlockedRows.slice(0, 10).map((row) => {
    const def = catalogById.get(row.achievementId);
    return {
      id: row.achievementId,
      label: def?.label || row.achievementId,
      description: def?.description || '',
      category: def?.category || 'general',
      xp: row.xpAwarded,
      unlockedAt: row.createdAt,
    };
  });

  const nextAchievements = ACHIEVEMENTS.filter((a) => !unlockedIds.has(a.id)).slice(0, 6).map((a) => ({
    id: a.id,
    label: a.label,
    description: a.description,
    category: a.category,
    xp: a.xp,
  }));

  const recentXpEvents = await GamificationEvent.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(25)
    .select('eventType xpAwarded label createdAt')
    .lean();

  const today = dayKey();
  return {
    profile: {
      level: profile.level,
      totalXp: profile.totalXp,
      currentLevelXp: profile.currentLevelXp,
      xpForNextLevel: profile.xpForNextLevel,
      progressPercent: profile.xpForNextLevel
        ? Math.min(100, Math.round((profile.currentLevelXp / profile.xpForNextLevel) * 100))
        : 100,
      currentStreak: profile.currentStreak,
      longestStreak: profile.longestStreak,
      streakShields: profile.streakShields,
      dailyXp: profile.dailyXpDate === today ? profile.dailyXp : 0,
      weeklyXp: profile.weeklyXp,
    },
    personalBests: profile.personalBests,
    recentAchievements,
    nextAchievements,
    achievementsUnlockedCount: unlockedRows.length,
    achievementsTotalCount: ACHIEVEMENTS.length,
    recentXpEvents,
    stats: statsSnapshot,
  };
};

module.exports = {
  processEvent,
  processHistoricalEvent,
  getProfileSummary,
  ensureProfile,
  dayKey,
  // Also used directly by backfillService: after merging a user's
  // reconstructed historical streak into their profile, it re-evaluates
  // achievements once against the final post-merge stats, since a streak-
  // length achievement can only be judged once ALL history is in (unlike
  // question/lesson/exam-count achievements, which are already correctly
  // checked as each historical event streams through processHistoricalEvent).
  evaluateAchievements,
  recomputeLevel,
  buildStatsSnapshot,
  // exported for tests
  _internal: { updateStreak, recomputeLevel, evaluateAchievements, buildStatsSnapshot },
};