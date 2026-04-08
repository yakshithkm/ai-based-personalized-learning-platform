const { getAdaptiveAnalytics } = require('../services/analyticsService');
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

module.exports = { getMyAnalytics, trackEvent, getAdminSummary };
