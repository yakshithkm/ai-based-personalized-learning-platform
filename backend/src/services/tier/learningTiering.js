const { FEATURES } = require('../../config/tiers');
const { hasFeatureAccess, getTierLimits, tiersAtOrBelow } = require('./tierService');

const allowedSectionsForTier = (tier) => getTierLimits(tier).learningSections;

/** Options handed to getLearningBundle so tiering happens inside the engine, not after it. */
const learningOptionsForTier = (tier) => ({
  accessTiers: tiersAtOrBelow(tier), // premium-only resources never enter candidate retrieval
  aiPolish: hasFeatureAccess(tier, FEATURES.AI_PERSONALIZED_LEARNING), // Gemini only for PRO+
});

/**
 * Intersects the sections an endpoint wants with what the tier may have. Returns [] when nothing
 * is allowed - callers must treat that as a refusal (an empty list given to the engine would mean
 * "all sections").
 */
const sectionsForTier = (tier, wanted) => {
  const allowed = allowedSectionsForTier(tier);
  return wanted && wanted.length ? wanted.filter((name) => allowed.includes(name)) : allowed;
};

/** Removes depth the tier does not include from an already-built bundle. */
const shapeLearningBundleForTier = (bundle, tier) => {
  const out = { ...bundle };
  const advanced = hasFeatureAccess(tier, FEATURES.ADVANCED_RECOMMENDATIONS);
  if (!advanced && out.learnNext) {
    out.learnNext = {
      ...out.learnNext,
      primary: out.learnNext.primary ? { ...out.learnNext.primary, path: [] } : out.learnNext.primary,
      alsoConsider: [],
    };
  }
  out.tierAccess = {
    tier,
    sections: allowedSectionsForTier(tier),
    learningPath: advanced,
    adaptiveChallenges: hasFeatureAccess(tier, FEATURES.ADAPTIVE_LEARNING_PATHS),
    aiPersonalization: hasFeatureAccess(tier, FEATURES.AI_PERSONALIZED_LEARNING),
  };
  return out;
};

module.exports = { allowedSectionsForTier, learningOptionsForTier, sectionsForTier, shapeLearningBundleForTier };
