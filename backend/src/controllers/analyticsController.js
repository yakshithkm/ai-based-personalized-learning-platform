const Attempt = require('../models/Attempt');
const Performance = require('../models/Performance');

const getMyAnalytics = async (req, res, next) => {
  try {
    const [performance, recentAttempts, attemptsBySubject] = await Promise.all([
      Performance.findOne({ user: req.user._id }),
      Attempt.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('subject topic isCorrect timeTakenSec createdAt'),
      Attempt.aggregate([
        { $match: { user: req.user._id } },
        {
          $group: {
            _id: '$subject',
            attempts: { $sum: 1 },
            correct: { $sum: { $cond: ['$isCorrect', 1, 0] } },
            avgTimeTakenSec: { $avg: '$timeTakenSec' },
          },
        },
        {
          $project: {
            _id: 0,
            subject: '$_id',
            attempts: 1,
            correct: 1,
            accuracy: {
              $cond: [
                { $eq: ['$attempts', 0] },
                0,
                { $multiply: [{ $divide: ['$correct', '$attempts'] }, 100] },
              ],
            },
            avgTimeTakenSec: 1,
          },
        },
      ]),
    ]);

    return res.json({
      performance,
      recentAttempts,
      attemptsBySubject,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getMyAnalytics };
