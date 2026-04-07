const Attempt = require('../models/Attempt');
const Question = require('../models/Question');
const { getRecommendedQuestions } = require('../services/recommendationService');

const getRecommendations = async (req, res, next) => {
  try {
    const hasAttempts = await Attempt.exists({ user: req.user._id });
    if (!hasAttempts) {
      const starterQuestions = await Question.find({ examType: req.user.targetExam })
        .limit(10)
        .select('-correctAnswerIndex');
      return res.json({
        source: 'cold-start',
        weakTopics: [],
        recommendations: starterQuestions,
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

module.exports = { getRecommendations };
