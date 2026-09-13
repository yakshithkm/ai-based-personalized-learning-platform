const Attempt = require('../models/Attempt');
const Mistake = require('../models/Mistake');
const ExamSession = require('../models/ExamSession');
const { getAdminBehaviorSummary } = require('../services/eventTrackingService');

const round = (value, digits = 1) => Number((Number(value) || 0).toFixed(digits));

// Platform-wide performance/subject/topic analytics, computed directly from real
// Attempt and Mistake documents (the same collections the student-facing analytics
// service reads from) rather than a separate parallel rollup.
const getPlatformAnalytics = async (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days || 30), 1), 180);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [subjectRows, topicRows, weakTopicRows, dailyActivity, examStats, behaviorSummary] =
      await Promise.all([
        Attempt.aggregate([
          { $match: { createdAt: { $gte: since } } },
          {
            $group: {
              _id: '$subject',
              attempts: { $sum: 1 },
              correct: { $sum: { $cond: ['$isCorrect', 1, 0] } },
            },
          },
        ]),
        Attempt.aggregate([
          { $match: { createdAt: { $gte: since } } },
          {
            $group: {
              _id: { subject: '$subject', topic: '$topic' },
              attempts: { $sum: 1 },
              correct: { $sum: { $cond: ['$isCorrect', 1, 0] } },
            },
          },
          { $sort: { attempts: -1 } },
          { $limit: 12 },
        ]),
        Mistake.aggregate([
          { $match: { createdAt: { $gte: since } } },
          {
            $group: {
              _id: { subject: '$subject', topic: '$topic' },
              mistakeCount: { $sum: 1 },
            },
          },
          { $sort: { mistakeCount: -1 } },
          { $limit: 10 },
        ]),
        Attempt.aggregate([
          { $match: { createdAt: { $gte: since } } },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              attempts: { $sum: 1 },
              uniqueUsers: { $addToSet: '$user' },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        ExamSession.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        getAdminBehaviorSummary({ days: Math.min(days, 90) }),
      ]);

    const subjectPerformance = subjectRows
      .map((row) => ({
        subject: row._id,
        attempts: row.attempts,
        accuracy: round((row.correct / Math.max(row.attempts, 1)) * 100),
      }))
      .sort((a, b) => b.accuracy - a.accuracy);

    const topicPerformance = topicRows.map((row) => ({
      subject: row._id.subject,
      topic: row._id.topic,
      attempts: row.attempts,
      accuracy: round((row.correct / Math.max(row.attempts, 1)) * 100),
    }));

    const mostDifficultTopics = topicPerformance
      .filter((t) => t.attempts >= 5)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 8);

    const mostCommonWeakTopics = weakTopicRows.map((row) => ({
      subject: row._id.subject,
      topic: row._id.topic,
      mistakeCount: row.mistakeCount,
    }));

    return res.json({
      windowDays: days,
      subjectPerformance,
      topicPerformance,
      mostDifficultTopics,
      mostCommonWeakTopics,
      dailyActivity: dailyActivity.map((d) => ({
        day: d._id,
        attempts: d.attempts,
        activeUsers: d.uniqueUsers.length,
      })),
      examActivity: examStats.reduce((acc, row) => {
        acc[row._id] = row.count;
        return acc;
      }, {}),
      productBehavior: behaviorSummary,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getPlatformAnalytics };