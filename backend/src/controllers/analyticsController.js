const { getAdaptiveAnalytics } = require('../services/analyticsService');

const getMyAnalytics = async (req, res, next) => {
  try {
    const analytics = await getAdaptiveAnalytics(req.user._id);
    return res.json(analytics);
  } catch (error) {
    return next(error);
  }
};

module.exports = { getMyAnalytics };
