const Question = require('../models/Question');

const getQuestions = async (req, res, next) => {
  try {
    const { subject, topic, examType, difficulty, limit = 10 } = req.query;
    const filter = {};

    if (subject) filter.subject = subject;
    if (topic) filter.topic = topic;
    if (examType) filter.examType = examType;
    if (difficulty) filter.difficulty = difficulty;

    const questions = await Question.find(filter)
      .limit(Math.min(Number(limit), 50))
      .select('-correctAnswerIndex');

    return res.json({ count: questions.length, questions });
  } catch (error) {
    return next(error);
  }
};

const getQuestionById = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      res.status(404);
      throw new Error('Question not found');
    }

    return res.json({
      question: {
        _id: question._id,
        examType: question.examType,
        subject: question.subject,
        topic: question.topic,
        difficulty: question.difficulty,
        text: question.text,
        options: question.options,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getSubjectsAndTopics = async (req, res, next) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: '$subject',
          topics: { $addToSet: '$topic' },
        },
      },
      {
        $project: {
          _id: 0,
          subject: '$_id',
          topics: 1,
        },
      },
      { $sort: { subject: 1 } },
    ];

    const data = await Question.aggregate(pipeline);
    return res.json({ subjects: data });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getQuestions, getQuestionById, getSubjectsAndTopics };
