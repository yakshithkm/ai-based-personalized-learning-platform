const Attempt = require('../models/Attempt');
const Performance = require('../models/Performance');
const { rebuildPerformanceForUser } = require('../services/performanceService');

const getMyAnalytics = async (req, res, next) => {
  try {
    const [performance, recentAttempts] = await Promise.all([
      rebuildPerformanceForUser(req.user._id),
      Attempt.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('subject topic isCorrect timeTakenSec createdAt difficulty'),
    ]);

    const attemptsBySubject = performance?.subjectStats || [];

    return res.json({
      performance,
      recentAttempts,
      attemptsBySubject,
      weakTopicPriority: performance?.weakTopicPriority || [],
      suggestedFocusTopic: performance?.suggestedFocusTopic || '',
      accuracyTrend: performance?.accuracyTrend || 'stable',
      timeAccuracyCorrelation: performance?.timeAccuracyCorrelation || 0,
      topicHeatmap: performance?.topicStats || [],
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getMyAnalytics };
