// Centralized gamification configuration - XP values, level curve, and the
// achievement catalog. Kept as code (not DB-seeded) to match this codebase's
// existing pattern for small, stable enumerations (see examSubjectMap.js,
// learning/constants.js) - easy to read, easy to tune, no seeding step needed.

// --- XP AWARDS -------------------------------------------------------------
// Every event type below maps to a fixed XP amount. Server-authoritative:
// the frontend never sends an XP number, it only ever reports that an event
// happened, and gamificationService looks the award up from here.
const XP_AWARDS = {
  PRACTICE_ANSWER: 5,
  PRACTICE_ANSWER_CORRECT: 10,
  PRACTICE_ANSWER_CORRECT_WEAK_TOPIC: 15,
  PRACTICE_ANSWER_CORRECT_HARD: 20,
  LEARNING_COMPLETED: 20,
  RECOMMENDATION_COMPLETED: 20,
  EXAM_COMPLETED: 50,
  EXAM_SCORE_80: 50,
  EXAM_SCORE_90: 75,
  EXAM_SCORE_95: 100,
  DAILY_ACTIVITY: 5,
  STREAK_DAY: 10,
};

// Speed bonus for a correct practice answer, folded into
// PRACTICE_ANSWER_CORRECT when the attempt was fast - mirrors the
// pre-existing (ephemeral) pointsForAttempt() bonus so totals don't feel
// like they regressed for users used to the old number.
const SPEED_BONUS_THRESHOLD_SEC = 35;
const SPEED_BONUS_XP = 3;

// --- LEVEL CURVE -------------------------------------------------------------
// XP required for next level = 250 + ((currentLevel - 1) * 100)
// Level 1: 0, Level 2: 250, Level 3: 600, Level 4: 1050, Level 5: 1600 ...
const BASE_LEVEL_XP = 250;
const LEVEL_XP_STEP = 100;

const xpForLevel = (level) => {
  // Total cumulative XP needed to REACH `level` (level 1 = 0).
  if (level <= 1) return 0;
  let total = 0;
  for (let lvl = 1; lvl < level; lvl += 1) {
    total += BASE_LEVEL_XP + (lvl - 1) * LEVEL_XP_STEP;
  }
  return total;
};

const xpToNextLevelFrom = (level) => BASE_LEVEL_XP + (level - 1) * LEVEL_XP_STEP;

const levelForTotalXp = (totalXp) => {
  let level = 1;
  let xpConsumed = 0;
  // Levels are unbounded but XP growth means this loop is short in practice
  // (a few hundred iterations even at very high XP).
  while (xpConsumed + xpToNextLevelFrom(level) <= totalXp) {
    xpConsumed += xpToNextLevelFrom(level);
    level += 1;
  }
  return {
    level,
    currentLevelXp: totalXp - xpConsumed,
    xpForNextLevel: xpToNextLevelFrom(level),
  };
};

// --- STREAK MILESTONES -------------------------------------------------------
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365];

// Streak shields: earned every 7-day streak milestone, capped so they can't
// be farmed indefinitely.
const STREAK_SHIELD_EARN_INTERVAL_DAYS = 7;
const STREAK_SHIELD_MAX = 3;

// --- ACHIEVEMENT CATALOG -----------------------------------------------------
// Each achievement is evaluated against the caller-supplied `stats` object
// (see achievementService.evaluateAchievements). `check` must be a pure
// function of real, persisted data - never randomness, never client input.
const ACHIEVEMENTS = [
  // Practice volume
  { id: 'first-step', category: 'practice', label: 'First Step', description: 'Answer your first question.', xp: 10, check: (s) => s.totalQuestionsAnswered >= 1 },
  { id: 'getting-started', category: 'practice', label: 'Getting Started', description: 'Answer 25 questions.', xp: 20, check: (s) => s.totalQuestionsAnswered >= 25 },
  { id: 'question-crusher', category: 'practice', label: 'Question Crusher', description: 'Answer 100 questions.', xp: 40, check: (s) => s.totalQuestionsAnswered >= 100 },
  { id: 'practice-pro', category: 'practice', label: 'Practice Pro', description: 'Answer 500 questions.', xp: 80, check: (s) => s.totalQuestionsAnswered >= 500 },
  { id: 'master-solver', category: 'practice', label: 'Master Solver', description: 'Answer 1000 questions.', xp: 150, check: (s) => s.totalQuestionsAnswered >= 1000 },

  // Accuracy
  { id: 'sharpshooter', category: 'accuracy', label: 'Sharpshooter', description: 'Maintain 80%+ accuracy across 20+ attempts.', xp: 40, check: (s) => s.totalQuestionsAnswered >= 20 && s.overallAccuracy >= 80 },
  { id: 'precision', category: 'accuracy', label: 'Precision', description: 'Maintain 90%+ accuracy across 50+ attempts.', xp: 60, check: (s) => s.totalQuestionsAnswered >= 50 && s.overallAccuracy >= 90 },

  // Streaks
  { id: 'streak-3', category: 'streak', label: '3-Day Learner', description: 'Practice 3 days in a row.', xp: 15, check: (s) => s.longestStreak >= 3 },
  { id: 'streak-7', category: 'streak', label: '7-Day Streak', description: 'Practice 7 days in a row.', xp: 30, check: (s) => s.longestStreak >= 7 },
  { id: 'streak-14', category: 'streak', label: '14-Day Streak', description: 'Practice 14 days in a row.', xp: 50, check: (s) => s.longestStreak >= 14 },
  { id: 'streak-30', category: 'streak', label: '30-Day Streak', description: 'Practice 30 days in a row.', xp: 100, check: (s) => s.longestStreak >= 30 },
  { id: 'streak-60', category: 'streak', label: '60-Day Streak', description: 'Practice 60 days in a row.', xp: 150, check: (s) => s.longestStreak >= 60 },
  { id: 'streak-100', category: 'streak', label: '100-Day Streak', description: 'Practice 100 days in a row.', xp: 250, check: (s) => s.longestStreak >= 100 },

  // Learning content
  { id: 'first-lesson', category: 'learning', label: 'First Lesson', description: 'Complete your first learning item.', xp: 15, check: (s) => s.totalLearningContentCompleted >= 1 },
  { id: 'knowledge-builder', category: 'learning', label: 'Knowledge Builder', description: 'Complete 10 learning items.', xp: 40, check: (s) => s.totalLearningContentCompleted >= 10 },
  { id: 'deep-learner', category: 'learning', label: 'Deep Learner', description: 'Complete 50 learning items.', xp: 80, check: (s) => s.totalLearningContentCompleted >= 50 },

  // Exams
  { id: 'first-exam', category: 'exam', label: 'First Exam', description: 'Complete your first exam simulation.', xp: 20, check: (s) => s.totalExamsCompleted >= 1 },
  { id: 'exam-ready', category: 'exam', label: 'Exam Ready', description: 'Complete 5 exam simulations.', xp: 50, check: (s) => s.totalExamsCompleted >= 5 },
  { id: 'high-performer', category: 'exam', label: 'High Performer', description: 'Score 80%+ in an exam.', xp: 60, check: (s) => s.bestExamScorePercent >= 80 },
  { id: 'elite-performance', category: 'exam', label: 'Elite Performance', description: 'Score 90%+ in an exam.', xp: 90, check: (s) => s.bestExamScorePercent >= 90 },

  // Level
  { id: 'level-5', category: 'level', label: 'Rising Star', description: 'Reach Level 5.', xp: 0, check: (s) => s.level >= 5 },
  { id: 'level-10', category: 'level', label: 'Advanced Learner', description: 'Reach Level 10.', xp: 0, check: (s) => s.level >= 10 },
  { id: 'level-20', category: 'level', label: 'Master Learner', description: 'Reach Level 20.', xp: 0, check: (s) => s.level >= 20 },
];

module.exports = {
  XP_AWARDS,
  SPEED_BONUS_THRESHOLD_SEC,
  SPEED_BONUS_XP,
  BASE_LEVEL_XP,
  LEVEL_XP_STEP,
  xpForLevel,
  xpToNextLevelFrom,
  levelForTotalXp,
  STREAK_MILESTONES,
  STREAK_SHIELD_EARN_INTERVAL_DAYS,
  STREAK_SHIELD_MAX,
  ACHIEVEMENTS,
};