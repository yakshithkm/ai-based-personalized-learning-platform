const Attempt = require('../models/Attempt');
const Question = require('../models/Question');
const { rebuildPerformanceForUser } = require('../services/performanceService');

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

    const attempt = await Attempt.create({
      user: req.user._id,
      question: question._id,
      subject: question.subject,
      topic: question.topic,
      selectedAnswerIndex,
      isCorrect,
      timeTakenSec,
    });

    await rebuildPerformanceForUser(req.user._id);

    return res.status(201).json({
      message: 'Attempt submitted',
      attempt,
      result: {
        isCorrect,
        correctAnswerIndex: question.correctAnswerIndex,
        explanation: question.explanation,
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
