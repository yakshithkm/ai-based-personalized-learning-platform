const Question = require('../models/Question');
const {
  normalizeExamType,
  getAllowedSubjectsForExam,
  normalizeSubjectName,
} = require('../config/examSubjectMap');
const isValidObjectId = require('../utils/isValidObjectId');

const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard'];

const getHarderDifficulty = (difficulty) => {
  const index = DIFFICULTY_ORDER.indexOf(difficulty);
  if (index === -1 || index >= DIFFICULTY_ORDER.length - 1) return 'Hard';
  return DIFFICULTY_ORDER[index + 1];
};

const resolveExamFromRequest = (req) => {
  const examFromUser = req.user?.targetExam || req.user?.exam || '';
  const examFromRequest = req.query?.exam || req.query?.examType || '';
  return normalizeExamType(examFromUser || examFromRequest || '');
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
      // Guard against a malformed id reaching findById, which would otherwise throw an
      // uncaught CastError whose default message leaks internal model/field names.
      const baseQuestion = isValidObjectId(baseQuestionId)
        ? await Question.findById(baseQuestionId)
        : null;

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

    // Same CastError guard as above - excludeQuestionId is user-supplied and flows
    // straight into a query filter.
    if (excludeQuestionId && isValidObjectId(excludeQuestionId)) {
      filter._id = { $ne: excludeQuestionId };
    }

    const requestedLimit = Number(limit) || 15;
    const isAdaptiveSingle = Boolean(similarTo || harderThan);
    const resolvedLimit = isAdaptiveSingle
      ? Math.min(Math.max(requestedLimit, 1), 50)
      : Math.min(Math.max(requestedLimit, 10), 20);

    const fetchQuestions = async (matchFilter) => {
      if (isAdaptiveSingle) {
        // Narrow, already-specific pool (same subject/topic as a base question) -
        // deterministic find() is fine here and keeps this path's existing behavior.
        return Question.find(matchFilter)
          .limit(resolvedLimit)
          .select('-correctAnswerIndex -correctAnswer');
      }

      // $sample instead of find().limit(): without an explicit sort, MongoDB returns
      // matching documents in essentially insertion order every time, so as the question
      // bank grows every student would keep seeing the same fixed first ~20 questions per
      // filter combination, forever. A growing bank only helps if requests actually surface
      // variety from it.
      return Question.aggregate([
        { $match: matchFilter },
        { $sample: { size: resolvedLimit } },
        { $project: { correctAnswerIndex: 0, correctAnswer: 0 } },
      ]);
    };

    let questions = await fetchQuestions(filter);

    if (!questions.length && (similarTo || harderThan)) {
      const fallbackFilter = { ...filter };
      delete fallbackFilter.difficulty;
      questions = await fetchQuestions(fallbackFilter);
    }

    return res.json({ count: questions.length, questions });
  } catch (error) {
    return next(error);
  }
};

const getQuestionById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400);
      throw new Error('Invalid question id');
    }

    // Exclude answer-revealing fields at the query level (defense in depth - the
    // response below is hand-built and already omits them, but this means a future
    // change to the response shape can't accidentally leak the answer).
    const question = await Question.findById(req.params.id).select(
      '-correctAnswerIndex -correctAnswer -explanation -commonMistake'
    );
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

    return res.json({ subjects: data });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getQuestions, getQuestionById, getSubjectsAndTopics };
