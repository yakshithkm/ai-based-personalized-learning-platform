const User = require('../../models/User');
const { TIERS, SUBSCRIPTION_STATUSES } = require('../../config/tiers');
const { isValidTier, resolveTierContext } = require('./tierService');

class SubscriptionError extends Error {
  constructor(message, statusCode = 400, code = 'INVALID_SUBSCRIPTION_CHANGE') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * THE only function that changes a user's tier. Admin tier changes, demo provisioning and any
 * future payment webhook (Stripe / Razorpay) all call this, so tier mutation has exactly one
 * code path to audit. It deliberately takes plain values - never `req.body` - and validates them.
 */
const applySubscription = async (
  userId,
  { tier, status = SUBSCRIPTION_STATUSES.ACTIVE, startDate, endDate = null, provider = null, externalId = null },
  { now = new Date() } = {}
) => {
  if (!isValidTier(tier)) throw new SubscriptionError('A valid tier (FREE, PRO or PREMIUM) is required');
  if (!Object.values(SUBSCRIPTION_STATUSES).includes(status)) {
    throw new SubscriptionError('Invalid subscription status');
  }
  if (endDate && Number.isNaN(new Date(endDate).getTime())) {
    throw new SubscriptionError('Invalid subscription end date');
  }

  const isFree = tier === TIERS.FREE;
  const update = {
    tier,
    subscriptionStatus: isFree ? SUBSCRIPTION_STATUSES.ACTIVE : status,
    subscriptionStartDate: isFree ? null : startDate ? new Date(startDate) : now,
    subscriptionEndDate: isFree ? null : endDate ? new Date(endDate) : null,
    subscriptionProvider: isFree ? null : provider,
    subscriptionExternalId: isFree ? null : externalId,
  };

  const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true });
  if (!user) throw new SubscriptionError('User not found', 404, 'USER_NOT_FOUND');
  return user;
};

const describeSubscription = (user, now = new Date()) => {
  const ctx = resolveTierContext(user, now);
  return {
    tier: ctx.tier,
    storedTier: ctx.storedTier,
    status: ctx.expired ? SUBSCRIPTION_STATUSES.EXPIRED : ctx.status,
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    expired: ctx.expired,
  };
};

module.exports = { applySubscription, describeSubscription, SubscriptionError };
