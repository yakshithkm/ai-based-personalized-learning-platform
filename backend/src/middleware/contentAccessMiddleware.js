const LearningRecommendation = require('../models/LearningRecommendation');
const LearningContent = require('../models/LearningContent');
const mongoose = require('mongoose');
const { TIER_ERROR_CODES, TIER_ORDER } = require('../config/tiers');
const { tierRank } = require('../services/tier/tierService');
const { getTierContext } = require('./tierMiddleware');

const LABEL = { FREE: 'Free', PRO: 'Pro', PREMIUM: 'Premium' };

/**
 * Guards every route that opens or progresses a recommendation (`/:id`, `/:id/practice`,
 * `/:id/start|progress|complete`): if the underlying learning content is above the caller's tier,
 * the request is refused - so premium material cannot be reached by guessing a recommendation id
 * or calling the API directly. Practice-only recommendations (no content) always pass.
 */
const requireRecommendationContentAccess = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return next(); // the controller reports the bad id
    const rec = await LearningRecommendation.findOne({ _id: id, user: req.user._id }).select('content').lean();
    if (!rec || !rec.content) return next(); // unknown / not theirs -> controller returns the 404

    const content = await LearningContent.findById(rec.content).select('accessTier').lean();
    const required = TIER_ORDER.includes(content?.accessTier) ? content.accessTier : 'FREE';
    const ctx = getTierContext(req);
    if (tierRank(ctx.tier) >= tierRank(required)) return next();

    const lapsed = ctx.expired && tierRank(ctx.storedTier) >= tierRank(required);
    return res.status(403).json({
      success: false,
      code: lapsed ? TIER_ERROR_CODES.SUBSCRIPTION_EXPIRED : TIER_ERROR_CODES.TIER_UPGRADE_REQUIRED,
      feature: 'PREMIUM_CONTENT',
      requiredTier: required,
      currentTier: ctx.tier,
      message: lapsed
        ? `Your ${LABEL[ctx.storedTier]} subscription has expired. Renew it to open this content.`
        : `This learning content requires a ${LABEL[required]} subscription.`,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { requireRecommendationContentAccess };
