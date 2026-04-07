const Attempt = require('../models/Attempt');
const Question = require('../models/Question');
const Performance = require('../models/Performance');
const { rebuildPerformanceForUser } = require('../services/performanceService');
const { evaluateAdaptiveDifficulty } = require('../services/adaptiveDifficultyService');
const { buildImprovementTip } = require('../services/feedbackService');

const submitAttempt = async (req, res, next) => {
  try {
    const { questionId, selectedAnswerIndex, timeTakenSec } = req.body;

    if (!questionId || selectedAnswerIndex === undefined || !timeTakenSec) {
      res.status(400);
      throw new Error('questionId, selectedAnswerIndex and timeTakenSec are required');
    }

    const question = await Question.findById(questionId);
    if (!question) {
      res.status(404);
      throw new Error('Question not found');
    }

    const isCorrect = Number(selectedAnswerIndex) === question.correctAnswerIndex;

    const perfDoc = await Performance.findOne({ user: req.user._id }).select('topicStats');
    const topicEntry = perfDoc?.topicStats?.find(
      (row) => row.subject === question.subject && row.topic === question.topic
    );
    const adaptiveDifficultyBefore = topicEntry?.currentDifficulty || question.difficulty || 'Medium';
    const adaptiveDifficultyAfter = evaluateAdaptiveDifficulty({
      currentDifficulty: adaptiveDifficultyBefore,
      isCorrect,
      timeTakenSec: Number(timeTakenSec),
    });

    const attempt = await Attempt.create({
      user: req.user._id,
      question: question._id,
      subject: question.subject,
      topic: question.topic,
      difficulty: question.difficulty,
      selectedAnswerIndex,
      isCorrect,
      timeTakenSec,
      adaptiveDifficultyBefore,
      adaptiveDifficultyAfter,
    });

    const performance = await rebuildPerformanceForUser(req.user._id);

    const correctAnswer = question.options[question.correctAnswerIndex];
    const selectedAnswerText = question.options[Number(selectedAnswerIndex)] || '';
    const improvementTip = buildImprovementTip({
      isCorrect,
      timeTakenSec,
      topic: question.topic,
      difficulty: adaptiveDifficultyAfter,
      selectedAnswerText,
    });

    return res.status(201).json({
      message: 'Attempt submitted',
      attempt,
      result: {
        isCorrect,
        correctAnswerIndex: question.correctAnswerIndex,
        correctAnswer,
        explanation: question.explanation,
        improvementTip,
      },
      adaptive: {
        topic: `${question.subject} - ${question.topic}`,
        previousDifficulty: adaptiveDifficultyBefore,
        nextDifficulty: adaptiveDifficultyAfter,
        currentStoredDifficulty: topicEntry?.currentDifficulty || adaptiveDifficultyAfter,
      },
      performanceSnapshot: {
        avgAccuracy: performance?.overallAccuracy || 0,
        avgTimeTakenSec: performance?.averageTimeTakenSec || 0,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getMyAttempts = async (req, res, next) => {
  try {
    const attempts = await Attempt.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('question', 'text options difficulty subject topic');

    return res.json({ count: attempts.length, attempts });
  } catch (error) {
    return next(error);
  }
};

module.exports = { submitAttempt, getMyAttempts };
