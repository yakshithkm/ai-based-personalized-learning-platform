/**
 * Single source of truth for TutorMind's subscription tiers.
 *
 * Nothing else in the codebase should compare `user.tier` to a literal. Everything goes through
 * the helpers in services/tier/tierService.js, which read THIS file. To change what a tier can
 * do, edit FEATURE_PERMISSIONS / TIER_LIMITS below - no controller or component changes needed.
 */

const TIERS = Object.freeze({ FREE: 'FREE', PRO: 'PRO', PREMIUM: 'PREMIUM' });
const TIER_ORDER = Object.freeze([TIERS.FREE, TIERS.PRO, TIERS.PREMIUM]);
const DEFAULT_TIER = TIERS.FREE;

const SUBSCRIPTION_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  PAST_DUE: 'PAST_DUE',
});

// Stable machine-readable error codes (also mirrored in frontend/src/utils/tierErrors.js).
const TIER_ERROR_CODES = Object.freeze({
  TIER_UPGRADE_REQUIRED: 'TIER_UPGRADE_REQUIRED',
  FEATURE_NOT_AVAILABLE: 'FEATURE_NOT_AVAILABLE',
  USAGE_LIMIT_REACHED: 'USAGE_LIMIT_REACHED',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
});

/**
 * Feature keys. Access levels per tier:
 *   true      full access
 *   'LIMITED' accessible, but the matching TIER_LIMITS entry (or server-side shaping) caps it
 *   false     not available (backend returns 403 TIER_UPGRADE_REQUIRED)
 */
const FEATURES = Object.freeze({
  DASHBOARD: 'DASHBOARD',
  BASIC_PRACTICE: 'BASIC_PRACTICE',
  ADVANCED_PRACTICE: 'ADVANCED_PRACTICE',
  BASIC_ANALYTICS: 'BASIC_ANALYTICS',
  ADVANCED_ANALYTICS: 'ADVANCED_ANALYTICS',
  READINESS_PREDICTIONS: 'READINESS_PREDICTIONS',
  BASIC_RECOMMENDATIONS: 'BASIC_RECOMMENDATIONS',
  ADVANCED_RECOMMENDATIONS: 'ADVANCED_RECOMMENDATIONS',
  ADAPTIVE_LEARNING_PATHS: 'ADAPTIVE_LEARNING_PATHS',
  STUDY_PLAN: 'STUDY_PLAN',
  MISTAKE_BANK: 'MISTAKE_BANK',
  FLASHCARDS: 'FLASHCARDS',
  EXAM_SIMULATION: 'EXAM_SIMULATION',
  DETAILED_EXAM_REPORT: 'DETAILED_EXAM_REPORT',
  AI_DOUBT_SOLVING: 'AI_DOUBT_SOLVING',
  AI_PERSONALIZED_LEARNING: 'AI_PERSONALIZED_LEARNING',
  ADVANCED_AI_TUTOR: 'ADVANCED_AI_TUTOR',
  PREMIUM_CONTENT: 'PREMIUM_CONTENT',
  BASIC_GAMIFICATION: 'BASIC_GAMIFICATION',
  ADVANCED_GAMIFICATION: 'ADVANCED_GAMIFICATION',
});

const FEATURE_PERMISSIONS = Object.freeze({
  //                                  FREE       PRO      PREMIUM
  DASHBOARD:                  { FREE: true,      PRO: true, PREMIUM: true },
  BASIC_PRACTICE:             { FREE: 'LIMITED', PRO: true, PREMIUM: true },
  ADVANCED_PRACTICE:          { FREE: false,     PRO: true, PREMIUM: true },
  BASIC_ANALYTICS:            { FREE: true,      PRO: true, PREMIUM: true },
  ADVANCED_ANALYTICS:         { FREE: false,     PRO: true, PREMIUM: true },
  READINESS_PREDICTIONS:      { FREE: false,     PRO: false, PREMIUM: true },
  BASIC_RECOMMENDATIONS:      { FREE: 'LIMITED', PRO: true, PREMIUM: true },
  ADVANCED_RECOMMENDATIONS:   { FREE: false,     PRO: true, PREMIUM: true },
  ADAPTIVE_LEARNING_PATHS:    { FREE: false,     PRO: false, PREMIUM: true },
  STUDY_PLAN:                 { FREE: 'LIMITED', PRO: true, PREMIUM: true },
  MISTAKE_BANK:               { FREE: 'LIMITED', PRO: true, PREMIUM: true },
  // FREE keeps full study access but is capped to TIER_LIMITS.FREE.flashcardDecks decks; AI card
  // generation spends the shared daily AI quota (usage key 'AI').
  FLASHCARDS:                 { FREE: 'LIMITED', PRO: true, PREMIUM: true },
  EXAM_SIMULATION:            { FREE: 'LIMITED', PRO: true, PREMIUM: true },
  DETAILED_EXAM_REPORT:       { FREE: false,     PRO: true, PREMIUM: true },
  AI_DOUBT_SOLVING:           { FREE: 'LIMITED', PRO: true, PREMIUM: true },
  AI_PERSONALIZED_LEARNING:   { FREE: false,     PRO: true, PREMIUM: true },
  ADVANCED_AI_TUTOR:          { FREE: false,     PRO: false, PREMIUM: true },
  PREMIUM_CONTENT:            { FREE: false,     PRO: false, PREMIUM: true },
  BASIC_GAMIFICATION:         { FREE: true,      PRO: true, PREMIUM: true },
  ADVANCED_GAMIFICATION:      { FREE: false,     PRO: true, PREMIUM: true },
});

/**
 * Quotas. `Infinity` means "no plan limit" and is handled in code only - it is never written to
 * the database. Unlimited tiers are still bounded by FAIR_USE_CEILINGS below (abuse protection),
 * which is why the UI can describe them as "unlimited" without the backend being unbounded.
 *
 * Keys ending in `PerDay` / `PerMonth` are usage counters (see USAGE_KEYS). Other keys are caps
 * on how much of a feature is served.
 */
const TIER_LIMITS = Object.freeze({
  FREE: {
    practicePerDay: 20,
    aiPerDay: 5,
    recommendationsPerDay: 5,
    examsPerMonth: 2,
    questionRecommendationCount: 5,
    mistakeBankItems: 10,
    studyPlanTopics: 2,
    aiHistoryMessages: 4,
    flashcardDecks: 5,
    // Learning-content sections served by /recommendations/learning (see services/learning).
    learningSections: ['learnNext', 'weakAreas', 'dailyPlan'],
  },
  PRO: {
    practicePerDay: 100,
    aiPerDay: 30,
    recommendationsPerDay: 25,
    examsPerMonth: 10,
    questionRecommendationCount: 10,
    mistakeBankItems: 100,
    studyPlanTopics: 6,
    aiHistoryMessages: 8,
    flashcardDecks: 30,
    learningSections: [
      'learnNext', 'weakAreas', 'dailyPlan', 'mistakeRecovery',
      'continueLearning', 'practiceAfterLearning', 'exploreNew', 'improvements',
    ],
  },
  PREMIUM: {
    practicePerDay: Infinity,
    aiPerDay: Infinity,
    recommendationsPerDay: Infinity,
    examsPerMonth: Infinity,
    questionRecommendationCount: 20,
    mistakeBankItems: Infinity,
    studyPlanTopics: Infinity,
    aiHistoryMessages: 12,
    flashcardDecks: Infinity,
    learningSections: [
      'learnNext', 'weakAreas', 'dailyPlan', 'mistakeRecovery', 'continueLearning',
      'practiceAfterLearning', 'exploreNew', 'improvements', 'challenges',
    ],
  },
});

// Hard ceilings applied to every tier that is "unlimited" on paper. Protects the Gemini quota
// and the database from runaway clients. Overridable via env for ops without a code change.
const envNumber = (name, fallback) => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const FAIR_USE_CEILINGS = Object.freeze({
  practicePerDay: envNumber('TIER_FAIR_USE_PRACTICE_PER_DAY', 2000),
  aiPerDay: envNumber('TIER_FAIR_USE_AI_PER_DAY', 300),
  recommendationsPerDay: envNumber('TIER_FAIR_USE_RECOMMENDATIONS_PER_DAY', 1000),
  examsPerMonth: envNumber('TIER_FAIR_USE_EXAMS_PER_MONTH', 200),
});

/**
 * Usage counters. `period` decides the reset boundary (calendar day / month, computed in
 * USAGE_TIMEZONE - never by a cron job, the period key simply changes).
 */
const USAGE_KEYS = Object.freeze({
  PRACTICE: { key: 'PRACTICE', limitKey: 'practicePerDay', period: 'day' },
  AI: { key: 'AI', limitKey: 'aiPerDay', period: 'day' },
  RECOMMENDATIONS: { key: 'RECOMMENDATIONS', limitKey: 'recommendationsPerDay', period: 'day' },
  EXAMS: { key: 'EXAMS', limitKey: 'examsPerMonth', period: 'month' },
});

const USAGE_TIMEZONE = process.env.TIER_USAGE_TIMEZONE || 'Asia/Kolkata';

// Plan marketing copy lives with the tier definitions so Plans page / API / docs never drift.
// `priceLabel` is display-only: real billing amounts belong to the payment provider.
const PLAN_CATALOG = Object.freeze({
  FREE: {
    tier: 'FREE',
    priceLabel: 'Free',
    tagline: 'Core learning features',
    highlights: [
      'Dashboard, basic analytics and weak-topic detection',
      'Limited daily practice',
      'Basic recommendations and study plan',
      'Limited AI doubt solving',
      '2 exam simulations per month',
    ],
  },
  PRO: {
    tier: 'PRO',
    priceLabel: 'Pro',
    tagline: 'Advanced learning features',
    highlights: [
      'Higher practice and AI limits',
      'Advanced analytics and weak-concept analysis',
      'Advanced recommendations and full study plan',
      'AI-powered learning assistance',
      '10 exam simulations per month with detailed reports',
    ],
  },
  PREMIUM: {
    tier: 'PREMIUM',
    priceLabel: 'Premium',
    tagline: 'The complete TutorMind experience',
    highlights: [
      'Unlimited practice, AI and exam simulations (fair-use protected)',
      'Advanced AI tutor with deeper conversations',
      'Readiness predictions and adaptive learning paths',
      'Full mistake bank and complete analytics',
      'All premium learning content',
    ],
  },
});

module.exports = {
  TIERS,
  TIER_ORDER,
  DEFAULT_TIER,
  SUBSCRIPTION_STATUSES,
  TIER_ERROR_CODES,
  FEATURES,
  FEATURE_PERMISSIONS,
  TIER_LIMITS,
  FAIR_USE_CEILINGS,
  USAGE_KEYS,
  USAGE_TIMEZONE,
  PLAN_CATALOG,
};
