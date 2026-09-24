const { getLearningBundle, SECTION_META } = require('../services/learning');
const lifecycle = require('../services/learning/lifecycle');
const { getPracticeSet } = require('../services/learning/practiceSet');
const { evaluateEffectiveness } = require('../services/learning/effectiveness');
const { serializeContent, serializeProgress, serializeRecommendation } = require('../services/learning/serializers');
const LearningContent = require('../models/LearningContent');
const LearningContentProgress = require('../models/LearningContentProgress');

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
    return res.json(await getLearningBundle(req.user, { minutes: parseMinutes(req.query.minutes) }));
  } catch (error) {
    return fail(res, next, error);
  }
};

// Thin, consistently-shaped views over the same engine.
const sectionEndpoint = (sections, pick) => async (req, res, next) => {
  try {
    const bundle = await getLearningBundle(req.user, { sections, minutes: parseMinutes(req.query.minutes) });
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
    return res.json(await lifecycle.completeRecommendation(req.user, req.params.id, req.body || {}));
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