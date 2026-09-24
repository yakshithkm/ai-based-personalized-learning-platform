const LearningContent = require('../models/LearningContent');
const LearningContentProgress = require('../models/LearningContentProgress');
const LearningRecommendation = require('../models/LearningRecommendation');
const Question = require('../models/Question');
const {
  EXAM_TYPES,
  SUBJECTS,
  DIFFICULTIES,
  CONTENT_TYPES,
  LEARNING_STAGES,
} = require('../services/learning/constants');
const { serializeContent } = require('../services/learning/serializers');

const badRequest = (res, next, message) => {
  res.status(400);
  return next(new Error(message));
};

const cleanString = (value, max) => String(value ?? '').trim().slice(0, max);
const cleanList = (value, maxItems = 20, maxLen = 200) =>
  (Array.isArray(value) ? value : String(value || '').split(/\r?\n|,/))
    .map((item) => cleanString(item, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);

// Whitelists fields and validates them; returns { data } or { error }.
const sanitizePayload = (body, { partial = false } = {}) => {
  const data = {};
  const has = (key) => body[key] !== undefined;
  const need = (key) => !partial || has(key);

  if (need('title')) {
    const title = cleanString(body.title, 200);
    if (!title) return { error: 'title is required' };
    data.title = title;
  }
  if (has('description')) data.description = cleanString(body.description, 1000);

  if (need('subject')) {
    if (!SUBJECTS.includes(body.subject)) return { error: `subject must be one of ${SUBJECTS.join(', ')}` };
    data.subject = body.subject;
  }
  if (need('topic')) {
    const topic = cleanString(body.topic, 200);
    if (!topic) return { error: 'topic is required' };
    data.topic = topic;
  }
  if (has('subtopic')) data.subtopic = cleanString(body.subtopic, 200) || 'General';
  if (has('concept')) data.concept = cleanString(body.concept, 200);

  if (need('contentType')) {
    if (!CONTENT_TYPES.includes(body.contentType)) return { error: `contentType must be one of ${CONTENT_TYPES.join(', ')}` };
    data.contentType = body.contentType;
  }
  if (has('learningStage') && body.learningStage) {
    if (!LEARNING_STAGES.includes(body.learningStage)) return { error: `learningStage must be one of ${LEARNING_STAGES.join(', ')}` };
    data.learningStage = body.learningStage;
  }
  if (has('difficulty')) {
    if (!DIFFICULTIES.includes(body.difficulty)) return { error: `difficulty must be one of ${DIFFICULTIES.join(', ')}` };
    data.difficulty = body.difficulty;
  }
  if (has('examTypes')) {
    const list = cleanList(body.examTypes, 3, 10);
    if (list.some((e) => !EXAM_TYPES.includes(e))) return { error: `examTypes must be a subset of ${EXAM_TYPES.join(', ')}` };
    data.examTypes = list;
  }

  if (has('url')) {
    data.url = cleanString(body.url, 2000);
    if (data.url && !/^https?:\/\//i.test(data.url)) return { error: 'url must start with http:// or https://' };
  }
  if (has('body')) data.body = String(body.body ?? '').slice(0, 20000);
  if (has('provider')) data.provider = cleanString(body.provider, 80) || 'TutorMind';
  if (has('language')) data.language = cleanString(body.language, 10) || 'en';

  if (has('estimatedMinutes')) {
    const n = Number(body.estimatedMinutes);
    if (!Number.isFinite(n) || n < 1 || n > 240) return { error: 'estimatedMinutes must be between 1 and 240' };
    data.estimatedMinutes = Math.round(n);
  }
  ['qualityScore', 'popularityScore'].forEach((key) => {
    if (has(key)) data[key] = body[key];
  });
  for (const key of ['qualityScore', 'popularityScore']) {
    if (data[key] !== undefined) {
      const n = Number(data[key]);
      if (!Number.isFinite(n) || n < 0 || n > 100) return { error: `${key} must be between 0 and 100` };
      data[key] = n;
    }
  }

  if (has('prerequisites')) data.prerequisites = cleanList(body.prerequisites);
  if (has('learningObjectives')) data.learningObjectives = cleanList(body.learningObjectives, 12, 300);
  if (has('tags')) data.tags = cleanList(body.tags, 20, 50);
  if (has('isActive')) data.isActive = Boolean(body.isActive);

  return { data };
};

// Aggregate-only usage metrics (no student identifiers are ever returned).
const loadStats = async (ids) => {
  if (!ids.length) return new Map();
  const [recRows, progressRows] = await Promise.all([
    LearningRecommendation.aggregate([
      { $match: { content: { $in: ids } } },
      {
        $group: {
          _id: '$content',
          recommended: { $sum: 1 },
          clicked: { $sum: { $cond: [{ $ne: ['$clickedAt', null] }, 1, 0] } },
        },
      },
    ]),
    LearningContentProgress.aggregate([
      { $match: { content: { $in: ids } } },
      {
        $group: {
          _id: '$content',
          learners: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          helpfulYes: { $sum: { $cond: [{ $eq: ['$helpful', true] }, 1, 0] } },
          helpfulRated: { $sum: { $cond: [{ $in: ['$helpful', [true, false]] }, 1, 0] } },
          avgTimeSpentSec: { $avg: { $cond: [{ $gt: ['$timeSpentSec', 0] }, '$timeSpentSec', null] } },
        },
      },
    ]),
  ]);

  const recBy = new Map(recRows.map((r) => [String(r._id), r]));
  const progBy = new Map(progressRows.map((r) => [String(r._id), r]));
  const pct = (a, b) => (b ? Number(((a / b) * 100).toFixed(1)) : null);

  const out = new Map();
  ids.forEach((id) => {
    const rec = recBy.get(String(id)) || {};
    const prog = progBy.get(String(id)) || {};
    out.set(String(id), {
      timesRecommended: rec.recommended || 0,
      learners: prog.learners || 0,
      completions: prog.completed || 0,
      completionRate: pct(prog.completed || 0, prog.learners || 0),
      helpfulRate: pct(prog.helpfulYes || 0, prog.helpfulRated || 0),
      helpfulResponses: prog.helpfulRated || 0,
      avgTimeSpentSec: prog.avgTimeSpentSec ? Math.round(prog.avgTimeSpentSec) : null,
      clickRate: pct(rec.clicked || 0, rec.recommended || 0),
    });
  });
  return out;
};

const listContent = async (req, res, next) => {
  try {
    const { q = '', subject, topic, contentType, difficulty, active } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const filter = {};
    if (SUBJECTS.includes(subject)) filter.subject = subject;
    if (topic) filter.topic = String(topic);
    if (CONTENT_TYPES.includes(contentType)) filter.contentType = contentType;
    if (DIFFICULTIES.includes(difficulty)) filter.difficulty = difficulty;
    if (active === 'true') filter.isActive = true;
    if (active === 'false') filter.isActive = false;
    if (q) {
      const safe = String(q).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ title: new RegExp(safe, 'i') }, { topic: new RegExp(safe, 'i') }, { concept: new RegExp(safe, 'i') }];
    }

    const [total, rows] = await Promise.all([
      LearningContent.countDocuments(filter),
      LearningContent.find(filter)
        .sort({ subject: 1, topic: 1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-body')
        .lean(),
    ]);
    const stats = await loadStats(rows.map((r) => r._id));

    return res.json({
      items: rows.map((row) => ({
        ...serializeContent(row),
        isActive: row.isActive,
        qualityScore: row.qualityScore,
        popularityScore: row.popularityScore,
        prerequisites: row.prerequisites || [],
        stats: stats.get(String(row._id)),
        updatedAt: row.updatedAt,
      })),
      pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
    });
  } catch (error) {
    return next(error);
  }
};

const getContent = async (req, res, next) => {
  try {
    const content = await LearningContent.findById(req.params.id).lean();
    if (!content) {
      res.status(404);
      return next(new Error('Learning content not found'));
    }
    const stats = await loadStats([content._id]);
    return res.json({
      ...serializeContent(content, { includeBody: true }),
      isActive: content.isActive,
      qualityScore: content.qualityScore,
      popularityScore: content.popularityScore,
      prerequisites: content.prerequisites || [],
      stats: stats.get(String(content._id)),
    });
  } catch (error) {
    return next(error);
  }
};

const handleWriteError = (error, res, next) => {
  if (error?.code === 11000) {
    res.status(409);
    return next(new Error('Content with the same provider, title, subject and topic already exists'));
  }
  if (error?.name === 'ValidationError') {
    res.status(400);
    return next(new Error(Object.values(error.errors).map((e) => e.message).join('; ')));
  }
  return next(error);
};

const createContent = async (req, res, next) => {
  try {
    const { data, error } = sanitizePayload(req.body || {});
    if (error) return badRequest(res, next, error);
    const created = await LearningContent.create({ ...data, createdBy: req.user._id });
    return res.status(201).json(serializeContent(created.toObject(), { includeBody: true }));
  } catch (error) {
    return handleWriteError(error, res, next);
  }
};

const updateContent = async (req, res, next) => {
  try {
    const { data, error } = sanitizePayload(req.body || {}, { partial: true });
    if (error) return badRequest(res, next, error);
    const doc = await LearningContent.findById(req.params.id);
    if (!doc) {
      res.status(404);
      return next(new Error('Learning content not found'));
    }
    doc.set(data);
    await doc.save(); // runs validators (url/body requirement, stage derivation)
    return res.json({ ...serializeContent(doc.toObject(), { includeBody: true }), isActive: doc.isActive });
  } catch (error) {
    return handleWriteError(error, res, next);
  }
};

// Hard delete only when nothing references the content; otherwise the admin should disable it
// (disabled content is never recommended and is closed out if a student had it open).
const deleteContent = async (req, res, next) => {
  try {
    const [progressRefs, recRefs] = await Promise.all([
      LearningContentProgress.countDocuments({ content: req.params.id }),
      LearningRecommendation.countDocuments({ content: req.params.id }),
    ]);
    if (progressRefs || recRefs) {
      res.status(409);
      return next(new Error('This content has student history. Disable it instead of deleting it.'));
    }
    const removed = await LearningContent.findByIdAndDelete(req.params.id);
    if (!removed) {
      res.status(404);
      return next(new Error('Learning content not found'));
    }
    return res.json({ message: 'Learning content deleted' });
  } catch (error) {
    return next(error);
  }
};

// Form helpers: enums + the real (subject, topic) pairs in the question bank, so admins pick
// topics that the recommendation engine can actually match.
const getContentMeta = async (req, res, next) => {
  try {
    const rows = await Question.aggregate([{ $group: { _id: { subject: '$subject', topic: '$topic' } } }]);
    const topicsBySubject = {};
    rows.forEach((row) => {
      (topicsBySubject[row._id.subject] = topicsBySubject[row._id.subject] || []).push(row._id.topic);
    });
    Object.values(topicsBySubject).forEach((list) => list.sort());

    return res.json({
      subjects: SUBJECTS,
      examTypes: EXAM_TYPES,
      difficulties: DIFFICULTIES,
      contentTypes: CONTENT_TYPES,
      learningStages: LEARNING_STAGES,
      topicsBySubject,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listContent, getContent, createContent, updateContent, deleteContent, getContentMeta, sanitizePayload };