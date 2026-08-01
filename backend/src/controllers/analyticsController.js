const { getAdaptiveAnalytics } = require('../services/analyticsService');
const Question = require('../models/Question');
const { EXAM_SUBJECT_MAP } = require('../config/examSubjectMap');
const {
  trackProductEvent,
  getAdminBehaviorSummary,
} = require('../services/eventTrackingService');

const getMyAnalytics = async (req, res, next) => {
  try {
    const analytics = await getAdaptiveAnalytics(req.user._id);
    return res.json(analytics);
  } catch (error) {
    return next(error);
  }
};

const trackEvent = async (req, res, next) => {
  try {
    const { eventType, metadata } = req.body;

    if (!eventType) {
      res.status(400);
      throw new Error('eventType is required');
    }

    const event = await trackProductEvent({
      userId: req.user._id,
      eventType,
      metadata: metadata || {},
    });

    return res.status(201).json({
      message: 'Event tracked',
      eventId: event._id,
    });
  } catch (error) {
    return next(error);
  }
};

const getAdminSummary = async (req, res, next) => {
  try {
    const days = Number(req.query.days || 14);
    const summary = await getAdminBehaviorSummary({ days: Math.min(Math.max(days, 1), 90) });
    return res.json(summary);
  } catch (error) {
    return next(error);
  }
};

const getQuestionStats = async (req, res, next) => {
  try {
    const [totalQuestions, subjectRows, topicRows, difficultyRows] = await Promise.all([
      Question.countDocuments({}),
      Question.aggregate([
        { $group: { _id: '$subject', count: { $sum: 1 } } },
      ]),
      Question.aggregate([
        { $group: { _id: { subject: '$subject', topic: '$topic' }, count: { $sum: 1 } } },
        { $sort: { '_id.subject': 1, '_id.topic': 1 } },
      ]),
      Question.aggregate([
        { $group: { _id: '$difficulty', count: { $sum: 1 } } },
      ]),
    ]);

    const subjects = {
      Physics: 0,
      Chemistry: 0,
      Mathematics: 0,
      Biology: 0,
    };

    subjectRows.forEach((row) => {
      if (Object.prototype.hasOwnProperty.call(subjects, row._id)) {
        subjects[row._id] = row.count;
      }
    });

    const topicsPerSubject = topicRows.reduce((acc, row) => {
      const subject = row._id.subject;
      if (!acc[subject]) acc[subject] = {};
      acc[subject][row._id.topic] = row.count;
      return acc;
    }, {});

    const difficultyBreakdown = {
      Easy: 0,
      Medium: 0,
      Hard: 0,
    };

    difficultyRows.forEach((row) => {
      if (Object.prototype.hasOwnProperty.call(difficultyBreakdown, row._id)) {
        difficultyBreakdown[row._id] = row.count;
      }
    });

    return res.json({
      totalQuestions,
      subjects,
      topicsPerSubject,
      difficultyBreakdown,
    });
  } catch (error) {
    return next(error);
  }
};

const getExamSubjects = async (req, res, next) => {
  try {
    return res.json(EXAM_SUBJECT_MAP);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getMyAnalytics,
  trackEvent,
  getAdminSummary,
  getQuestionStats,
  getExamSubjects,
};
