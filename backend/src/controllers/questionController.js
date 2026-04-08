const Question = require('../models/Question');

const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard'];

const getHarderDifficulty = (difficulty) => {
  const index = DIFFICULTY_ORDER.indexOf(difficulty);
  if (index === -1 || index >= DIFFICULTY_ORDER.length - 1) return 'Hard';
  return DIFFICULTY_ORDER[index + 1];
};

const getQuestions = async (req, res, next) => {
  try {
    const {
      subject,
      topic,
      subtopic,
      examType,
      difficulty,
      limit = 10,
      similarTo,
      harderThan,
      excludeQuestionId,
    } = req.query;
    const filter = {};

    filter.examType = examType || req.user?.targetExam;

    let resolvedDifficulty = difficulty;

    if (similarTo || harderThan) {
      const baseQuestionId = similarTo || harderThan;
      const baseQuestion = await Question.findById(baseQuestionId);

      if (baseQuestion) {
        filter.subject = baseQuestion.subject;
        filter.topic = baseQuestion.topic;
        filter.subtopic = baseQuestion.subtopic || baseQuestion.topic || 'General';

        if (similarTo && !resolvedDifficulty) {
          resolvedDifficulty = baseQuestion.difficulty;
        }

        if (harderThan) {
          resolvedDifficulty = getHarderDifficulty(baseQuestion.difficulty);
        }
      }
    }

    if (subject) filter.subject = subject;
    if (topic) filter.topic = topic;
    if (subtopic) {
      filter.$or = [{ subtopic }, { subtopic: { $exists: false } }, { subtopic: null }];
    }
    if (resolvedDifficulty) filter.difficulty = resolvedDifficulty;

    if (excludeQuestionId) {
      filter._id = { $ne: excludeQuestionId };
    }

    let questions = await Question.find(filter)
      .limit(Math.min(Number(limit), 50))
      .select('-correctAnswerIndex');

    if (!questions.length && (similarTo || harderThan)) {
      const fallbackFilter = { ...filter };
      delete fallbackFilter.difficulty;
      questions = await Question.find(fallbackFilter)
        .limit(Math.min(Number(limit), 50))
        .select('-correctAnswerIndex');
    }

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
        subtopic: question.subtopic || question.topic || 'General',
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
          subtopics: {
            $addToSet: {
              topic: '$topic',
              subtopic: { $ifNull: ['$subtopic', '$topic'] },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          subject: '$_id',
          topics: 1,
          subtopics: 1,
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
