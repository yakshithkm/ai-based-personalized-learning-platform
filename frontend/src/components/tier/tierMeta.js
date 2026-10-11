export const TIER_ORDER = ['FREE', 'PRO', 'PREMIUM'];

export const tierRank = (tier) => Math.max(TIER_ORDER.indexOf(tier), 0);

export const tierNameKey = (tier) => `tier.names.${String(tier || 'FREE').toLowerCase()}`;

// Higher plan the user should be sent to for a given requirement.
export const nextTier = (tier) => TIER_ORDER[Math.min(tierRank(tier) + 1, TIER_ORDER.length - 1)];

export const BENEFIT_KEYS = {
  PRO: ['benefits.pro.advancedAnalytics', 'benefits.pro.aiLimits', 'benefits.pro.recommendations', 'benefits.pro.exams'],
  PREMIUM: ['benefits.premium.tutor', 'benefits.premium.unlimited', 'benefits.premium.readiness', 'benefits.premium.content'],
};
