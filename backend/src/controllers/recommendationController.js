const Attempt = require('../models/Attempt');
const Question = require('../models/Question');
const { getRecommendedQuestions, getFocusSessionQuestions } = require('../services/recommendationService');

const getRecommendations = async (req, res, next) => {
  try {
    const hasAttempts = await Attempt.exists({ user: req.user._id });
    if (!hasAttempts) {
      const starterQuestions = await Question.find({ examType: req.user.targetExam })
        .limit(10)
        .select('-correctAnswerIndex')
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
      return res.json({
        source: 'cold-start',
        weakTopics: [],
        recommendations: starterWithSignals,
      });
    }

    const recommendationResult = await getRecommendedQuestions({
      userId: req.user._id,
      targetExam: req.user.targetExam,
      limit: 10,
    });

    return res.json({
      source: recommendationResult.source,
      priorityOrder: recommendationResult.priorityOrder,
      weakTopics: recommendationResult.weakTopics,
      strongTopics: recommendationResult.strongTopics,
      recommendations: recommendationResult.recommendations,
      difficultyPlan: recommendationResult.difficultyPlan,
      confidence: recommendationResult.confidence,
    });
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
