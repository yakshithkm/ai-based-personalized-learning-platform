const { getLearningBundle, SECTION_META } = require('../services/learning');
const { resolveRequestLanguage } = require('../config/languages');
const lifecycle = require('../services/learning/lifecycle');
const { getPracticeSet } = require('../services/learning/practiceSet');
const { evaluateEffectiveness } = require('../services/learning/effectiveness');
const { serializeContent, serializeProgress, serializeRecommendation } = require('../services/learning/serializers');
const LearningContent = require('../models/LearningContent');
const LearningContentProgress = require('../models/LearningContentProgress');
const { processEvent: processGamificationEvent } = require('../services/gamification/gamificationService');
const { FEATURES } = require('../config/tiers');
const { denyFeature, consumeUsageOnce } = require('../middleware/tierMiddleware');
const {
  learningOptionsForTier,
  sectionsForTier,
  shapeLearningBundleForTier,
} = require('../services/tier/learningTiering');

// Services signal client errors with HttpError(statusCode); anything else is a real 500.
const fail = (res, next, error) => {
  if (error && error.statusCode && error.statusCode < 500) res.status(error.statusCode);
  return next(error);
};

const parseMinutes = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 10 && n <= 240 ? Math.round(n) : undefined;
};

// Full bundle: Learn Next + every section + daily plan + measured improvements.
const getLearning = async (req, res, next) => {
  try {
    const { tier } = req.tierContext;
    // Each Learn-page load is one use of the daily recommendation quota. A burst of duplicate
    // requests (React StrictMode runs effects twice in dev) is charged once.
    if (!(await consumeUsageOnce(req, res, 'RECOMMENDATIONS'))) return undefined;
    const bundle = await getLearningBundle(req.user, {
      sections: sectionsForTier(tier),
      minutes: parseMinutes(req.query.minutes),
      language: resolveRequestLanguage(req),
      ...learningOptionsForTier(tier),
    });
    return res.json(shapeLearningBundleForTier(bundle, tier));
  } catch (error) {
    return fail(res, next, error);
  }
};

// Thin, consistently-shaped views over the same engine.
const sectionEndpoint = (sections, pick) => async (req, res, next) => {
  try {
    const { tier } = req.tierContext;
    const allowed = sectionsForTier(tier, sections);
    // Defence in depth behind the route-level requireFeature: never let an empty list through,
    // because the engine reads [] as "every section".
    if (!allowed.length) return denyFeature(req, res, FEATURES.ADVANCED_RECOMMENDATIONS);
    const bundle = shapeLearningBundleForTier(
      await getLearningBundle(req.user, {
        sections: allowed,
        minutes: parseMinutes(req.query.minutes),
        language: resolveRequestLanguage(req),
        ...learningOptionsForTier(tier),
      }),
      tier
    );
    return res.json({
      source: bundle.source,
      mode: bundle.mode,
      dataConfidence: bundle.dataConfidence,
      generatedAt: bundle.generatedAt,
      ...pick(bundle),
    });
  } catch (error) {
    return fail(res, next, error);
  }
};

const getLearnNext = sectionEndpoint(['learnNext'], (b) => ({
  section: 'learnNext',
  title: SECTION_META.learnNext.title,
  learnNext: b.learnNext,
  welcome: b.welcome,
  baseline: b.baseline,
  emptyState: b.emptyState || null,
}));

const listSection = (name) =>
  sectionEndpoint([name], (b) => ({
    section: name,
    title: SECTION_META[name].title,
    items: b.sections[name] || [],
  }));

const getWeakAreas = listSection('weakAreas');
const getMistakeRecovery = listSection('mistakeRecovery');
const getChallenges = listSection('challenges');
const getDailyPlan = sectionEndpoint(['dailyPlan'], (b) => ({
  section: 'dailyPlan',
  title: "Today's Personalized Plan",
  dailyPlan: b.dailyPlan,
}));

const getRecommendation = async (req, res, next) => {
  try {
    const rec = await lifecycle.loadOwned(req.user._id, req.params.id);
    const [content, progress, effectiveness] = await Promise.all([
      rec.content ? LearningContent.findById(rec.content).select('-body').lean() : null,
      rec.content ? LearningContentProgress.findOne({ user: req.user._id, content: rec.content }).lean() : null,
      evaluateEffectiveness(rec.toObject()),
    ]);
    return res.json({
      recommendation: serializeRecommendation(rec),
      content: serializeContent(content),
      progress: serializeProgress(progress),
      effectiveness,
    });
  } catch (error) {
    return fail(res, next, error);
  }
};

const startRecommendation = async (req, res, next) => {
  try {
    return res.json(await lifecycle.startRecommendation(req.user, req.params.id));
  } catch (error) {
    return fail(res, next, error);
  }
};

const progressRecommendation = async (req, res, next) => {
  try {
    return res.json(await lifecycle.updateProgress(req.user, req.params.id, req.body || {}));
  } catch (error) {
    return fail(res, next, error);
  }
};

const completeRecommendation = async (req, res, next) => {
  try {
    const result = await lifecycle.completeRecommendation(req.user, req.params.id, req.body || {});

    let gamification = null;
    if (!result.alreadyCompleted) {
      try {
        gamification = await processGamificationEvent({
          userId: req.user._id,
          eventType: 'LEARNING_COMPLETED',
          sourceId: result.recommendation.id,
          metadata: { kind: result.recommendation.kind },
        });
      } catch (gamificationError) {
        gamification = null;
      }
    }

    return res.json({ ...result, gamification });
  } catch (error) {
    return fail(res, next, error);
  }
};

const skipRecommendation = async (req, res, next) => {
  try {
    return res.json(await lifecycle.skipRecommendation(req.user, req.params.id));
  } catch (error) {
    return fail(res, next, error);
  }
};

const feedbackRecommendation = async (req, res, next) => {
  try {
    return res.json(await lifecycle.saveFeedback(req.user, req.params.id, req.body || {}));
  } catch (error) {
    return fail(res, next, error);
  }
};

const practiceForRecommendation = async (req, res, next) => {
  try {
    const rec = await lifecycle.loadOwned(req.user._id, req.params.id);
    return res.json(await getPracticeSet({ user: req.user, rec: rec.toObject(), count: req.query.count }));
  } catch (error) {
    return fail(res, next, error);
  }
};

module.exports = {
  getLearning,
  getLearnNext,
  getWeakAreas,
  getMistakeRecovery,
  getChallenges,
  getDailyPlan,
  getRecommendation,
  startRecommendation,
  progressRecommendation,
  completeRecommendation,
  skipRecommendation,
  feedbackRecommendation,
  practiceForRecommendation,
};