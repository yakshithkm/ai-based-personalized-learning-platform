const Attempt = require('../models/Attempt');
const Question = require('../models/Question');
const { getRecommendedQuestions, getFocusSessionQuestions } = require('../services/recommendationService');
const { getLearningBundle } = require('../services/learning');
const { FEATURES } = require('../config/tiers');
const { hasFeatureAccess, getTierLimits } = require('../services/tier/tierService');
const { consumeUsageOnce } = require('../middleware/tierMiddleware');
const {
  learningOptionsForTier,
  sectionsForTier,
  shapeLearningBundleForTier,
} = require('../services/tier/learningTiering');

// Depth the tier does not include (the engine's planning internals) is removed server-side.
const shapeQuestionRecs = (payload, tier) => {
  if (hasFeatureAccess(tier, FEATURES.ADVANCED_RECOMMENDATIONS)) return payload;
  const { difficultyPlan, confidence, priorityOrder, strongTopics, ...basic } = payload;
  return basic;
};

// Backward compatible: the question payload keeps its shape; `?include=learning` adds the
// learning-content bundle next to it. That bundle is the metered, tier-shaped one - the same rules
// as GET /recommendations/learning apply here, so the query param is not a side door.
// Resolves to null (response already sent) when the recommendation quota is spent.
const withLearning = async (req, res, payload) => {
  if (req.query.include !== 'learning') return payload;
  const { tier } = req.tierContext;
  if (!(await consumeUsageOnce(req, res, 'RECOMMENDATIONS'))) return null;
  const bundle = await getLearningBundle(req.user, {
    sections: sectionsForTier(tier),
    ...learningOptionsForTier(tier),
  });
  return { ...payload, learning: shapeLearningBundleForTier(bundle, tier) };
};

const getRecommendations = async (req, res, next) => {
  try {
    const { tier } = req.tierContext;
    const count = getTierLimits(tier).questionRecommendationCount;
    const hasAttempts = await Attempt.exists({ user: req.user._id });
    if (!hasAttempts) {
      const starterQuestions = await Question.find({ examType: req.user.targetExam })
        .limit(Math.min(10, count))
        .select('-correctAnswerIndex -correctAnswer')
        .lean();

      const starterWithSignals = starterQuestions.map((question) => ({
        ...question,
        recommendationReason: 'cold-start',
        aiSignals: {
          labels: ['AI-selected question'],
          why: 'Starter set generated to establish your baseline performance.',
          adaptiveDifficultyApplied: false,
        },
      }));
      const starter = await withLearning(req, res, {
        source: 'cold-start',
        weakTopics: [],
        recommendations: starterWithSignals,
      });
      return starter ? res.json(starter) : undefined;
    }

    const recommendationResult = await getRecommendedQuestions({
      userId: req.user._id,
      targetExam: req.user.targetExam,
      limit: count,
    });

    const result = await withLearning(
      req,
      res,
      shapeQuestionRecs(
        {
          source: recommendationResult.source,
          priorityOrder: recommendationResult.priorityOrder,
          weakTopics: recommendationResult.weakTopics,
          strongTopics: recommendationResult.strongTopics,
          recommendations: recommendationResult.recommendations,
          difficultyPlan: recommendationResult.difficultyPlan,
          confidence: recommendationResult.confidence,
        },
        tier
      )
    );
    return result ? res.json(result) : undefined;
  } catch (error) {
    return next(error);
  }
};

const getFocusSession = async (req, res, next) => {
  try {
    const session = await getFocusSessionQuestions({
      userId: req.user._id,
      targetExam: req.user.targetExam,
      total: Number(req.query.total || 10),
    });

    return res.json(session);
  } catch (error) {
    return next(error);
  }
};

module.exports = { getRecommendations, getFocusSession };