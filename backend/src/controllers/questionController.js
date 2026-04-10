const Question = require('../models/Question');
const {
  normalizeExamType,
  getAllowedSubjectsForExam,
  normalizeSubjectName,
} = require('../config/examSubjectMap');

const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard'];

const getHarderDifficulty = (difficulty) => {
  const index = DIFFICULTY_ORDER.indexOf(difficulty);
  if (index === -1 || index >= DIFFICULTY_ORDER.length - 1) return 'Hard';
  return DIFFICULTY_ORDER[index + 1];
};

const resolveExamFromRequest = (req) => {
  const examFromUser = req.user?.targetExam || req.user?.exam || '';
  const examFromRequest = req.query?.exam || req.query?.examType || '';
  const resolved = normalizeExamType(examFromUser || examFromRequest || '');

  console.log('[ExamResolve]', JSON.stringify({
    examFromUser: examFromUser,
    examFromRequest: examFromRequest,
    resolvedExam: resolved || null,
  }));

  return resolved;
};

const getQuestions = async (req, res, next) => {
  try {
    const {
      subject,
      topic,
      subtopic,
      examType,
      exam,
      difficulty,
      limit = 15,
      similarTo,
      harderThan,
      excludeQuestionId,
    } = req.query;
    const filter = {};
    const resolvedExamType = normalizeExamType(examType || exam || resolveExamFromRequest(req));
    const allowedSubjects = getAllowedSubjectsForExam(resolvedExamType);
    const normalizedSubject = normalizeSubjectName(subject);

    if (resolvedExamType) {
      filter.examType = resolvedExamType;
    }

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

    if (subject) {
      if (!normalizedSubject || !allowedSubjects.includes(normalizedSubject)) {
        console.log(
          '[QuestionFetchBlocked]',
          JSON.stringify({
            examType: resolvedExamType || 'UNKNOWN',
            requestedSubject: subject,
            allowedSubjects,
          })
        );
        return res.json({ count: 0, questions: [] });
      }
      filter.subject = normalizedSubject;
    } else if (!filter.subject) {
      filter.subject = { $in: allowedSubjects };
    }

    if (topic) filter.topic = topic;
    if (subtopic) {
      filter.$or = [{ subtopic }, { subtopic: { $exists: false } }, { subtopic: null }];
    }
    if (resolvedDifficulty) filter.difficulty = resolvedDifficulty;

    if (excludeQuestionId) {
      filter._id = { $ne: excludeQuestionId };
    }

    const requestedLimit = Number(limit) || 15;
    const isAdaptiveSingle = Boolean(similarTo || harderThan);
    const resolvedLimit = isAdaptiveSingle
      ? Math.min(Math.max(requestedLimit, 1), 50)
      : Math.min(Math.max(requestedLimit, 10), 20);

    let questions = await Question.find(filter)
      .limit(resolvedLimit)
      .select('-correctAnswerIndex -correctAnswer');

    if (!questions.length && (similarTo || harderThan)) {
      const fallbackFilter = { ...filter };
      delete fallbackFilter.difficulty;
      questions = await Question.find(fallbackFilter)
        .limit(resolvedLimit)
        .select('-correctAnswerIndex -correctAnswer');
    }

    console.log(
      '[QuestionFetch]',
      JSON.stringify({
        examType: resolvedExamType || 'ALL',
        allowedSubjects,
        requestedSubject: subject || 'ALL',
        normalizedSubject: normalizedSubject || null,
        subjectApplied: subject ? normalizedSubject : 'ALL_ALLOWED',
        topic: topic || 'ALL',
        subtopic: subtopic || 'ALL',
        difficulty: resolvedDifficulty || 'ALL',
        requestedLimit,
        appliedLimit: resolvedLimit,
        fetchedCount: questions.length,
      })
    );

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
    const resolvedExamType = resolveExamFromRequest(req);
    const allowedSubjects = getAllowedSubjectsForExam(resolvedExamType);

    const pipeline = [
      {
        $match: {
          ...(resolvedExamType ? { examType: resolvedExamType } : {}),
          subject: { $in: allowedSubjects },
        },
      },
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

    const grouped = await Question.aggregate(pipeline);
    const groupedMap = new Map(grouped.map((row) => [row.subject, row]));

    const data = allowedSubjects.map((subjectName) => {
      const existing = groupedMap.get(subjectName);
      if (existing) return existing;
      return {
        subject: subjectName,
        topics: [],
        subtopics: [],
      };
    });

    console.log(
      '[SubjectsTopics]',
      JSON.stringify({
        examFromUser: req.user?.targetExam || req.user?.exam || null,
        examFromRequest: req.query?.exam || req.query?.examType || null,
        examType: resolvedExamType || 'UNKNOWN',
        returnedSubjects: data.map((row) => row.subject),
      })
    );

    return res.json({ subjects: data });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getQuestions, getQuestionById, getSubjectsAndTopics };
