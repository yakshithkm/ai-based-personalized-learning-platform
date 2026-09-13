const Question = require('../models/Question');
const ExamSession = require('../models/ExamSession');
const isValidObjectId = require('../utils/isValidObjectId');
const { getAllowedSubjectsForExam, normalizeSubjectName } = require('../config/examSubjectMap');

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
const EXAM_TYPES = ['NEET', 'JEE', 'CET'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const MISTAKE_TYPES = ['concept', 'calculation', 'trap'];

const listQuestions = async (req, res, next) => {
  try {
    const {
      search = '',
      subject = '',
      topic = '',
      difficulty = '',
      examType = '',
      page = 1,
      pageSize = 20,
    } = req.query;

    const filter = {};
    if (subject) filter.subject = subject;
    if (topic) filter.topic = topic;
    if (difficulty) filter.difficulty = difficulty;
    if (examType) filter.examType = examType;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.text = regex;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));

    const [total, questions] = await Promise.all([
      Question.countDocuments(filter),
      Question.find(filter)
        .sort({ updatedAt: -1 })
        .skip((pageNum - 1) * size)
        .limit(size)
        .lean(),
    ]);

    return res.json({
      questions,
      pagination: {
        total,
        page: pageNum,
        pageSize: size,
        totalPages: Math.max(1, Math.ceil(total / size)),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getQuestion = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400);
      throw new Error('Invalid question id');
    }
    const question = await Question.findById(req.params.id).lean();
    if (!question) {
      res.status(404);
      throw new Error('Question not found');
    }
    return res.json({ question });
  } catch (error) {
    return next(error);
  }
};

// Fills in the same "supporting" fields (conceptTested, commonMistake,
// difficultyReason, solvingTimeEstimate, mistakeType, subtopic) that the
// convertRealQuestionBanks.js pipeline auto-generates for imported questions,
// so an admin can create a valid question by only filling in the fields that
// actually matter (text/options/answer/subject/topic/difficulty) without
// hitting Mongoose "required" validation errors. Anything the admin does
// supply is left untouched.
const applyDefaults = (body, existing = {}) => {
  const out = { ...existing, ...body };

  if (Array.isArray(out.options) && Number.isInteger(out.correctAnswerIndex)) {
    out.correctAnswer = out.options[out.correctAnswerIndex];
  }

  out.subtopic = out.subtopic || out.topic || 'General';
  out.conceptTested = out.conceptTested || out.topic || 'General Concept';
  out.commonMistake =
    out.commonMistake || 'Placeholder: review this question and add a specific common mistake.';
  out.difficultyReason =
    out.difficultyReason || `Auto-set placeholder reason for ${out.difficulty || 'Medium'} difficulty.`;
  out.solvingTimeEstimate = out.solvingTimeEstimate || 60;
  out.mistakeType = MISTAKE_TYPES.includes(out.mistakeType) ? out.mistakeType : 'concept';
  out.explanation = out.explanation || '';

  return out;
};

const validateQuestionShape = (data) => {
  if (!EXAM_TYPES.includes(data.examType)) {
    return `examType must be one of ${EXAM_TYPES.join(', ')}`;
  }
  if (!SUBJECTS.includes(data.subject)) {
    return `subject must be one of ${SUBJECTS.join(', ')}`;
  }
  const allowedSubjects = getAllowedSubjectsForExam(data.examType);
  if (!allowedSubjects.includes(normalizeSubjectName(data.subject) || data.subject)) {
    return `${data.subject} is not a valid subject for ${data.examType}`;
  }
  if (!data.topic || !String(data.topic).trim()) {
    return 'topic is required';
  }
  if (!data.text || !String(data.text).trim()) {
    return 'question text is required';
  }
  if (!Array.isArray(data.options) || data.options.length !== 4 || data.options.some((o) => !String(o || '').trim())) {
    return 'exactly 4 non-empty options are required';
  }
  if (!Number.isInteger(data.correctAnswerIndex) || data.correctAnswerIndex < 0 || data.correctAnswerIndex > 3) {
    return 'correctAnswerIndex must be an integer between 0 and 3';
  }
  if (data.difficulty && !DIFFICULTIES.includes(data.difficulty)) {
    return `difficulty must be one of ${DIFFICULTIES.join(', ')}`;
  }
  return null;
};

const createQuestion = async (req, res, next) => {
  try {
    const data = applyDefaults(req.body || {});
    data.difficulty = data.difficulty || 'Medium';

    const validationError = validateQuestionShape(data);
    if (validationError) {
      res.status(400);
      throw new Error(validationError);
    }

    const question = await Question.create(data);
    return res.status(201).json({ message: 'Question created successfully', question });
  } catch (error) {
    return next(error);
  }
};

const updateQuestion = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400);
      throw new Error('Invalid question id');
    }

    const existing = await Question.findById(req.params.id);
    if (!existing) {
      res.status(404);
      throw new Error('Question not found');
    }

    const data = applyDefaults(req.body || {}, existing.toObject());
    const validationError = validateQuestionShape(data);
    if (validationError) {
      res.status(400);
      throw new Error(validationError);
    }

    Object.assign(existing, data);
    await existing.save();

    return res.json({ message: 'Question updated successfully', question: existing });
  } catch (error) {
    return next(error);
  }
};

const deleteQuestion = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400);
      throw new Error('Invalid question id');
    }

    // Guard against deleting a question that's actively in use in an in-progress
    // exam session - removing it mid-exam would break grading/review for that
    // student. Historical Attempt/Mistake records are safe to keep pointing at a
    // deleted question because they snapshot subject/topic/difficulty/correctness
    // directly on the Attempt/Mistake document itself (see models/Attempt.js),
    // so past analytics keep working even if the underlying question is gone.
    const activeUsage = await ExamSession.exists({
      status: 'active',
      'questionOrder.question': req.params.id,
    });

    if (activeUsage) {
      res.status(409);
      throw new Error('Cannot delete: this question is part of an in-progress exam session');
    }

    const deleted = await Question.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404);
      throw new Error('Question not found');
    }

    return res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listQuestions, getQuestion, createQuestion, updateQuestion, deleteQuestion };