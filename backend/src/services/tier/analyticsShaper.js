const { FEATURES } = require('../../config/tiers');
const { hasFeatureAccess, getFeatureAccess, getTierLimits } = require('./tierService');

const cap = (list, max) => {
  if (!Array.isArray(list)) return list;
  return Number.isFinite(max) ? list.slice(0, max) : list;
};

// Fields on the Performance document that only exist to power advanced analytics. The UI reads
// only scalar totals from `performance`, but the full document is serialised into the response,
// so these have to be removed here too - otherwise the data would leak through `performance`.
const ADVANCED_PERFORMANCE_FIELDS = [
  'topicStats', 'subjectStats', 'conceptStats', 'weeklyTrend', 'weakTopicPriority',
  'weakConceptPriority', 'strongTopics', 'accuracyTrend', 'timeAccuracyCorrelation',
  'suggestedFocusTopic',
];

const toPlain = (value) => (value && typeof value.toObject === 'function' ? value.toObject() : value);

/**
 * Server-side tiering of the /analytics/me payload. Every student page reads this one payload, so
 * shaping it here is what actually enforces "basic vs advanced analytics" - hiding a card in
 * React would leave the data one DevTools tab away.
 *
 * Locked sections come back as empty values the pages already handle, plus `tierAccess` so the UI
 * can show a lock instead of an empty state.
 */
const shapeAnalyticsForTier = (analytics, tier) => {
  const out = { ...analytics };
  const limits = getTierLimits(tier);
  const advanced = hasFeatureAccess(tier, FEATURES.ADVANCED_ANALYTICS);
  const predictions = hasFeatureAccess(tier, FEATURES.READINESS_PREDICTIONS);
  const studyPlanFull = getFeatureAccess(tier, FEATURES.STUDY_PLAN) === true;
  const mistakeBankFull = getFeatureAccess(tier, FEATURES.MISTAKE_BANK) === true;

  if (!advanced) {
    const performance = toPlain(out.performance);
    if (performance) {
      const trimmed = { ...performance };
      ADVANCED_PERFORMANCE_FIELDS.forEach((field) => delete trimmed[field]);
      out.performance = trimmed;
    }
    out.topicHeatmap = [];
    out.topicMastery = [];
    out.weeklyImprovement = [];
    out.conceptMastery = [];
    out.weakConceptPriority = [];
    out.accuracyTrend = 'stable';
    out.timeAccuracyCorrelation = 0;
    out.focusConcepts = [];
    delete out.improvementInsight;
    delete out.transformation;
    delete out.benchmark;
    // Basic weak-topic identification stays; deeper prioritisation does not.
    out.weakTopicPriority = cap(out.weakTopicPriority, 3);
  }

  if (!predictions) {
    // Keep the headline score (the Dashboard ring) but remove the model internals / forecasts.
    out.examReadiness = { score: out.examReadiness?.score ?? 0, breakdown: {} };
    if (out.readiness) {
      out.readiness = { readinessScore: out.readiness.readinessScore, status: out.readiness.status };
    }
    delete out.urgency;
  }

  if (!studyPlanFull && out.studentInsightLayer) {
    const strategy = out.studentInsightLayer.studyStrategy || {};
    out.studentInsightLayer = {
      ...out.studentInsightLayer,
      studyStrategy: {
        ...strategy,
        timeAllocation: cap(strategy.timeAllocation, limits.studyPlanTopics),
        dailyStudyPlan: cap(strategy.dailyStudyPlan, limits.studyPlanTopics),
      },
    };
  }

  if (!mistakeBankFull && out.mistakeBank) {
    const max = limits.mistakeBankItems;
    out.mistakeBank = {
      ...out.mistakeBank,
      recentMistakes: cap(out.mistakeBank.recentMistakes, max),
      repeatedMistakes: cap(out.mistakeBank.repeatedMistakes, max),
      frequentFailedTopics: cap(out.mistakeBank.frequentFailedTopics, max),
      frequentFailedSubtopics: cap(out.mistakeBank.frequentFailedSubtopics, max),
      frequentFailedConcepts: cap(out.mistakeBank.frequentFailedConcepts, max),
    };
  }

  out.tierAccess = {
    tier,
    advancedAnalytics: advanced,
    readinessPredictions: predictions,
    fullStudyPlan: studyPlanFull,
    fullMistakeBank: mistakeBankFull,
    mistakeBankLimit: Number.isFinite(limits.mistakeBankItems) ? limits.mistakeBankItems : null,
    studyPlanTopicLimit: Number.isFinite(limits.studyPlanTopics) ? limits.studyPlanTopics : null,
  };
  return out;
};

module.exports = { shapeAnalyticsForTier };
