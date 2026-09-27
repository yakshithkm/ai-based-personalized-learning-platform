const mongoose = require('mongoose');

// Persistent, server-authoritative gamification state for one user. One
// document per user. Every counter here is only ever advanced from
// gamificationService.processEvent() - never written to directly from a
// controller - so it always reflects real, validated learning events.
const gamificationProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    totalXp: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },
    currentLevelXp: { type: Number, default: 0, min: 0 },
    xpForNextLevel: { type: Number, default: 250, min: 1 },

    dailyXp: { type: Number, default: 0, min: 0 },
    dailyXpDate: { type: String, default: null }, // local calendar day, e.g. "2026-09-24"
    weeklyXp: { type: Number, default: 0, min: 0 },
    weeklyXpWeekStart: { type: String, default: null },

    currentStreak: { type: Number, default: 0, min: 0 },
    longestStreak: { type: Number, default: 0, min: 0 },
    lastActiveDate: { type: String, default: null }, // local calendar day of last qualifying activity
    streakShields: { type: Number, default: 0, min: 0 },
    streakShieldsEarnedAtStreak: { type: Number, default: 0, min: 0 }, // last streak length a shield was awarded for

    totalQuestionsAnswered: { type: Number, default: 0, min: 0 },
    totalQuestionsCorrect: { type: Number, default: 0, min: 0 },
    totalLearningContentCompleted: { type: Number, default: 0, min: 0 },
    totalExamsCompleted: { type: Number, default: 0, min: 0 },
    totalFlashcardsReviewed: { type: Number, default: 0, min: 0 },
    totalMistakesReviewed: { type: Number, default: 0, min: 0 },
    totalStudyTasksCompleted: { type: Number, default: 0, min: 0 },
    bestExamScorePercent: { type: Number, default: 0, min: 0, max: 100 },

    // Personal bests (section 27) - simple map of metric -> value, extendable
    // without a schema migration for each new record type.
    personalBests: {
      highestExamScorePercent: { type: Number, default: 0 },
      bestAccuracyPercent: { type: Number, default: 0 },
      longestStreak: { type: Number, default: 0 },
      mostXpInADay: { type: Number, default: 0 },
    },

    // Section 41/42: one-time historical backfill so an existing user's (or
    // seeded demo account's) prior Attempt/LearningContentProgress/
    // ExamSession history is reflected in their gamification profile instead
    // of starting them at Level 1 / 0 XP. See services/gamification/
    // backfillService.js. `StartedAt` acts as a short-lived lock so two
    // concurrent requests can't both run it; `CompletedAt` makes it
    // permanently idempotent once done.
    historicalBackfillStartedAt: { type: Date, default: null },
    historicalBackfillCompletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GamificationProfile', gamificationProfileSchema);