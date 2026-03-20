const Attempt = require('../models/Attempt');
const Question = require('../models/Question');
const { analyzeWithMlService } = require('../services/mlClient');
const { fallbackRecommendations } = require('../services/recommendationService');

const getRecommendations = async (req, res, next) => {
  try {
    const attempts = await Attempt.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(300)
      .select('subject topic isCorrect timeTakenSec createdAt question');

    if (!attempts.length) {
      const starterQuestions = await Question.find({ examType: req.user.targetExam })
        .limit(10)
        .select('-correctAnswerIndex');
      return res.json({
        source: 'cold-start',
        weakTopics: [],
        recommendations: starterQuestions,
      });
    }

    let mlResult;
    try {
      mlResult = await analyzeWithMlService({
        userId: String(req.user._id),
        targetExam: req.user.targetExam,
        attempts,
      });
    } catch (error) {
      mlResult = await fallbackRecommendations(req.user, attempts);
    }

    const recommendedQuestionIds = mlResult.recommendedQuestionIds || [];
    let recommendations = [];

    if (recommendedQuestionIds.length) {
      recommendations = await Question.find({
        _id: { $in: recommendedQuestionIds },
        examType: req.user.targetExam,
      }).select('-correctAnswerIndex');
    }

    if (!recommendations.length && Array.isArray(mlResult.topicRanking) && mlResult.topicRanking.length) {
      const weakTopicFilters = mlResult.topicRanking.slice(0, 5).map((row) => ({
        subject: row.subject,
        topic: row.topic,
      }));

      recommendations = await Question.find({
        examType: req.user.targetExam,
        $or: weakTopicFilters,
      })
        .limit(10)
        .select('-correctAnswerIndex');
    }

    if (!recommendations.length && Array.isArray(mlResult.recommendations)) {
      recommendations = mlResult.recommendations;
    }

    if (!recommendations.length) {
      const fallbackResult = await fallbackRecommendations(req.user, attempts);
      mlResult = {
        ...mlResult,
        source: fallbackResult.source,
        weakTopics: fallbackResult.weakTopics,
        confidence: mlResult.confidence || fallbackResult.confidence,
      };
      recommendations = fallbackResult.recommendations;
    }

    return res.json({
      source: mlResult.source || 'ml-service',
      weakTopics: mlResult.weakTopics || [],
      recommendations,
      confidence: mlResult.confidence || null,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getRecommendations };
