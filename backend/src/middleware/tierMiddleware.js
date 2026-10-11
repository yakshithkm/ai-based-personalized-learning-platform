const { TIER_ERROR_CODES, TIER_ORDER, FEATURE_PERMISSIONS, USAGE_KEYS } = require('../config/tiers');
const {
  resolveTierContext,
  tierRank,
  hasFeatureAccess,
  getRequiredTier,
  normalizeTier,
} = require('../services/tier/tierService');
const {
  reserveUsage, releaseUsage, peekUsage, claimWindow, releaseWindow, settleWindow, waitForWindowOutcome,
} = require('../services/tier/usageService');

const TIER_LABEL = { FREE: 'Free', PRO: 'Pro', PREMIUM: 'Premium' };

// Reads the tier from the database row `protect` already loaded for THIS request. Nothing the
// client sends (headers, body, query, localStorage, JWT claims) can influence it.
const getTierContext = (req) => {
  if (!req.tierContext) req.tierContext = resolveTierContext(req.user);
  return req.tierContext;
};

const nextTierAbove = (tier) => TIER_ORDER[tierRank(tier) + 1] || null;

const send = (res, status, body) =>
  res.status(status).json({ success: false, ...body });

const unauthorized = (res) =>
  send(res, 401, {
    code: TIER_ERROR_CODES.UNAUTHORIZED,
    message: 'You need to sign in to use this feature.',
  });

// Builds the 403 for "your tier is too low", distinguishing a lapsed subscription (the user used
// to have the tier) from someone who never had it.
const denyForTier = (res, ctx, requiredTier, extra = {}) => {
  const lapsed = ctx.expired && tierRank(ctx.storedTier) >= tierRank(requiredTier);
  if (lapsed) {
    return send(res, 403, {
      code: TIER_ERROR_CODES.SUBSCRIPTION_EXPIRED,
      requiredTier,
      currentTier: ctx.tier,
      message: `Your ${TIER_LABEL[ctx.storedTier]} subscription has expired. Renew it to use this feature again.`,
      ...extra,
    });
  }
  return send(res, 403, {
    code: TIER_ERROR_CODES.TIER_UPGRADE_REQUIRED,
    requiredTier,
    currentTier: ctx.tier,
    message: `This feature requires a ${TIER_LABEL[requiredTier]} subscription.`,
    ...extra,
  });
};

/** Requires at least `minTier`. */
const requireTier = (minTier) => {
  const required = normalizeTier(minTier);
  if (!TIER_ORDER.includes(String(minTier).toUpperCase())) {
    throw new Error(`requireTier: unknown tier "${minTier}"`);
  }
  return (req, res, next) => {
    if (!req.user) return unauthorized(res);
    const ctx = getTierContext(req);
    if (tierRank(ctx.tier) >= tierRank(required)) return next();
    return denyForTier(res, ctx, required);
  };
};

/** Requires the feature (full OR limited access) per FEATURE_PERMISSIONS. */
const requireFeature = (feature) => {
  // Fail at route-definition time, not at request time, if a feature key is mistyped.
  if (!FEATURE_PERMISSIONS[feature]) throw new Error(`requireFeature: unknown feature "${feature}"`);
  return (req, res, next) => {
    if (!req.user) return unauthorized(res);
    const ctx = getTierContext(req);
    if (hasFeatureAccess(ctx.tier, feature)) return next();

    const requiredTier = getRequiredTier(feature);
    if (!requiredTier) {
      return send(res, 403, {
        code: TIER_ERROR_CODES.FEATURE_NOT_AVAILABLE,
        feature,
        currentTier: ctx.tier,
        message: 'This feature is not available right now.',
      });
    }
    return denyForTier(res, ctx, requiredTier, { feature });
  };
};

const usageLimitBody = (ctx, usageKey, result) => {
  const upgradeTier = result.unlimited ? null : nextTierAbove(ctx.tier);
  return {
    code: TIER_ERROR_CODES.USAGE_LIMIT_REACHED,
    usageKey,
    currentTier: ctx.tier,
    requiredTier: upgradeTier,
    limit: result.unlimited ? null : result.limit,
    used: result.used,
    resetsAt: result.resetsAt,
    fairUse: Boolean(result.unlimited),
    message: result.unlimited
      ? 'You have reached the fair-use limit for today. It resets automatically - please try again later.'
      : upgradeTier
        ? `You have reached your ${TIER_LABEL[ctx.tier]} plan limit. It resets automatically, or upgrade to ${TIER_LABEL[upgradeTier]} for more.`
        : 'You have reached your usage limit. It resets automatically.',
  };
};

/**
 * Consumes `amount` from a usage counter BEFORE the handler runs (atomic - concurrent requests
 * cannot both slip past the limit). If the request then fails (status >= 400) or the handler sets
 * `res.locals.refundUsage = true`, the reservation is returned, so rejected/failed requests do
 * not burn quota.
 */
// Reserves quota imperatively (for handlers that only sometimes need it, e.g. an optional
// `?include=learning`). Sends the 429 itself and resolves false when the quota is spent.
const consumeUsage = async (req, res, usageKey, { amount = 1 } = {}) => {
  const ctx = getTierContext(req);
  const result = await reserveUsage({ userId: req.user._id, tier: ctx.tier, usageKey, amount });
  if (!result.ok) {
    send(res, 429, usageLimitBody(ctx, usageKey, result));
    return false;
  }
  res.once('finish', () => {
    if (res.statusCode >= 400 || res.locals.refundUsage) {
      releaseUsage(result.reservation).catch(() => {});
    }
  });
  return true;
};

// The client tags each page visit with a random id (?visit=...). Anything else is ignored.
const getVisitId = (req) => {
  const raw = req.query?.visit;
  return typeof raw === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(raw) ? raw : null;
};

// Like consumeUsage, but the duplicate requests of ONE page visit (StrictMode's double effect, a
// double click) are charged ONCE. A separate visit has its own id, so it is charged even a second
// later. The first request records its outcome and duplicates inherit it: allowed if the first was
// (even though it may have just used the last unit), refused if it was refused. Requests without a
// visit id are simply charged every time (no de-duplication).
const consumeUsageOnce = async (req, res, usageKey, { windowMs = 5000 } = {}) => {
  const visit = getVisitId(req);
  if (!visit) return consumeUsage(req, res, usageKey);

  const userId = req.user._id;
  const fresh = await claimWindow({ userId, key: usageKey, visit, windowMs });
  if (fresh) {
    try {
      const ok = await consumeUsage(req, res, usageKey);
      await settleWindow({ userId, key: usageKey, visit, granted: ok });
      return ok;
    } catch (error) {
      await releaseWindow({ userId, key: usageKey, visit }).catch(() => {});
      throw error;
    }
  }
  const outcome = await waitForWindowOutcome({ userId, key: usageKey, visit });
  if (outcome === 'denied') {
    const ctx = getTierContext(req);
    const result = await peekUsage({ userId, tier: ctx.tier, usageKey });
    if (!result.ok) {
      send(res, 429, usageLimitBody(ctx, usageKey, result));
      return false;
    }
  }
  return true; // granted (or the opener is still in flight: it is the one being charged)
};

const checkUsageLimit = (usageKey, options = {}) => {
  if (!USAGE_KEYS[usageKey]) throw new Error(`checkUsageLimit: unknown usage key "${usageKey}"`);
  return async (req, res, next) => {
    try {
      if (!req.user) return unauthorized(res);
      if (!(await consumeUsage(req, res, usageKey, options))) return undefined;
      return next();
    } catch (error) {
      return next(error);
    }
  };
};

// Imperative feature refusal (same body as requireFeature) for handlers that decide at runtime.
const denyFeature = (req, res, feature) => {
  const ctx = getTierContext(req);
  const requiredTier = getRequiredTier(feature);
  if (!requiredTier) {
    return send(res, 403, {
      code: TIER_ERROR_CODES.FEATURE_NOT_AVAILABLE,
      feature,
      currentTier: ctx.tier,
      message: 'This feature is not available right now.',
    });
  }
  return denyForTier(res, ctx, requiredTier, { feature });
};

/** Read-only variant: blocks once the quota is spent, without consuming anything. */
const requireUsageAvailable = (usageKey) => {
  if (!USAGE_KEYS[usageKey]) throw new Error(`requireUsageAvailable: unknown usage key "${usageKey}"`);
  return async (req, res, next) => {
    try {
      if (!req.user) return unauthorized(res);
      const ctx = getTierContext(req);
      const result = await peekUsage({ userId: req.user._id, tier: ctx.tier, usageKey });
      if (!result.ok) return send(res, 429, usageLimitBody(ctx, usageKey, result));
      return next();
    } catch (error) {
      return next(error);
    }
  };
};

module.exports = {
  getTierContext,
  requireTier,
  requireFeature,
  checkUsageLimit,
  requireUsageAvailable,
  consumeUsage,
  consumeUsageOnce,
  denyFeature,
};
