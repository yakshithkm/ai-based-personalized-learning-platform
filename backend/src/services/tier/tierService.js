const {
  TIERS,
  TIER_ORDER,
  DEFAULT_TIER,
  SUBSCRIPTION_STATUSES,
  FEATURES,
  FEATURE_PERMISSIONS,
  TIER_LIMITS,
  FAIR_USE_CEILINGS,
} = require('../../config/tiers');

const normalizeTier = (value) => {
  const upper = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return TIER_ORDER.includes(upper) ? upper : DEFAULT_TIER;
};

const isValidTier = (value) => typeof value === 'string' && TIER_ORDER.includes(value);

const tierRank = (tier) => TIER_ORDER.indexOf(normalizeTier(tier));

const tiersAtOrBelow = (tier) => TIER_ORDER.slice(0, tierRank(tier) + 1);

/**
 * Works out what tier a user is actually entitled to RIGHT NOW from the stored subscription
 * fields. The stored `tier` is what was granted; the effective tier is what is honoured:
 *   - a paid tier whose end date has passed, or whose status is EXPIRED / CANCELLED(ended),
 *     falls back to FREE (and `expired` is reported so the API can say SUBSCRIPTION_EXPIRED);
 *   - no end date = non-expiring (admin grants, demo accounts).
 * This is evaluated per request from the database row - never from anything the client sends.
 */
const resolveTierContext = (user, now = new Date()) => {
  const storedTier = normalizeTier(user?.tier);
  const status = user?.subscriptionStatus || SUBSCRIPTION_STATUSES.ACTIVE;
  const endDate = user?.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
  const ended = endDate && !Number.isNaN(endDate.getTime()) && endDate.getTime() <= now.getTime();

  let expired = false;
  if (storedTier !== TIERS.FREE) {
    if (status === SUBSCRIPTION_STATUSES.EXPIRED) expired = true;
    else if (status === SUBSCRIPTION_STATUSES.CANCELLED && ended) expired = true;
    else if (status === SUBSCRIPTION_STATUSES.ACTIVE && ended) expired = true;
    // PAST_DUE keeps access until its end date (grace period), then falls into the ACTIVE rule.
    else if (status === SUBSCRIPTION_STATUSES.PAST_DUE && ended) expired = true;
  }

  return {
    storedTier,
    tier: expired ? TIERS.FREE : storedTier,
    expired,
    status,
    startDate: user?.subscriptionStartDate || null,
    endDate: endDate || null,
  };
};

const getFeatureAccess = (tier, feature) => {
  const row = FEATURE_PERMISSIONS[feature];
  if (!row) return false;
  return row[normalizeTier(tier)] ?? false;
};

/** true for both full and 'LIMITED' access. */
const hasFeatureAccess = (tier, feature) => Boolean(getFeatureAccess(tier, feature));

/** Lowest tier that can use the feature at all (null if the feature key is unknown). */
const getRequiredTier = (feature) => {
  if (!FEATURE_PERMISSIONS[feature]) return null;
  return TIER_ORDER.find((tier) => Boolean(FEATURE_PERMISSIONS[feature][tier])) || null;
};

const getTierLimits = (tier) => TIER_LIMITS[normalizeTier(tier)];

/**
 * The number actually enforced for a usage counter: the plan limit, or - for "unlimited" plans -
 * the fair-use ceiling. Always finite, so it can be used in a database filter.
 */
const getEnforcedLimit = (tier, limitKey) => {
  const planLimit = getTierLimits(tier)[limitKey];
  const ceiling = FAIR_USE_CEILINGS[limitKey];
  if (planLimit === Infinity || planLimit === undefined) return { limit: ceiling ?? Number.MAX_SAFE_INTEGER, unlimited: true };
  return { limit: planLimit, unlimited: false };
};

/** JSON-safe view of the limits (Infinity -> null, meaning "no plan limit"). */
const serializeLimits = (tier) =>
  Object.fromEntries(
    Object.entries(getTierLimits(tier)).map(([key, value]) => [key, value === Infinity ? null : value])
  );

const serializeFeatureMap = (tier) =>
  Object.fromEntries(
    Object.values(FEATURES).map((feature) => {
      const access = getFeatureAccess(tier, feature);
      return [feature, access === true ? 'FULL' : access === 'LIMITED' ? 'LIMITED' : 'NONE'];
    })
  );

module.exports = {
  normalizeTier,
  isValidTier,
  tierRank,
  tiersAtOrBelow,
  resolveTierContext,
  getFeatureAccess,
  hasFeatureAccess,
  getRequiredTier,
  getTierLimits,
  getEnforcedLimit,
  serializeLimits,
  serializeFeatureMap,
};
