const {
  TIERS,
  TIER_ORDER,
  FEATURES,
  PLAN_CATALOG,
  TIER_ERROR_CODES,
} = require('../config/tiers');
const {
  resolveTierContext,
  isValidTier,
  tierRank,
  serializeLimits,
  serializeFeatureMap,
} = require('../services/tier/tierService');
const { describeSubscription } = require('../services/tier/subscriptionService');
const { getUsageSnapshot } = require('../services/tier/usageService');
const { getBillingProvider } = require('../services/billing/billingProvider');

const buildMatrix = () =>
  Object.fromEntries(
    Object.values(FEATURES).map((feature) => [
      feature,
      Object.fromEntries(TIER_ORDER.map((tier) => [tier, serializeFeatureMap(tier)[feature]])),
    ])
  );

const buildPlans = () =>
  TIER_ORDER.map((tier) => ({ ...PLAN_CATALOG[tier], limits: serializeLimits(tier) }));

/** GET /api/tier/me - the caller's own entitlements, resolved from the database. */
const getMyTier = async (req, res, next) => {
  try {
    const ctx = resolveTierContext(req.user);
    const usage = await getUsageSnapshot({ userId: req.user._id, tier: ctx.tier });
    return res.json({
      tier: ctx.tier,
      isDemo: Boolean(req.user.isDemo),
      subscription: describeSubscription(req.user),
      limits: serializeLimits(ctx.tier),
      features: serializeFeatureMap(ctx.tier),
      usage,
      paymentConfigured: getBillingProvider().configured,
    });
  } catch (error) {
    return next(error);
  }
};

/** GET /api/tier/plans - public catalogue + feature matrix for the Plans page. */
const getPlans = (req, res) =>
  res.json({
    plans: buildPlans(),
    matrix: buildMatrix(),
    paymentConfigured: getBillingProvider().configured,
  });

/**
 * POST /api/tier/checkout - starts an upgrade. With no payment provider configured this is an
 * honest 501: nothing is purchased and the user's tier is NOT changed. Self-service tier changes
 * do not exist anywhere in the API; only subscriptionService (admin / webhook) writes tiers.
 */
const createCheckout = async (req, res, next) => {
  try {
    const targetTier = typeof req.body?.tier === 'string' ? req.body.tier.toUpperCase() : '';
    const ctx = resolveTierContext(req.user);
    if (!isValidTier(targetTier) || targetTier === TIERS.FREE || tierRank(targetTier) <= tierRank(ctx.tier)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_UPGRADE_TARGET',
        currentTier: ctx.tier,
        message: 'Choose a plan higher than your current one.',
      });
    }
    const session = await getBillingProvider().createCheckoutSession(req.user, targetTier);
    return res.json({ success: true, ...session });
  } catch (error) {
    if (error.code === 'PAYMENT_NOT_CONFIGURED') {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    return next(error);
  }
};

module.exports = { getMyTier, getPlans, createCheckout, TIER_ERROR_CODES };
