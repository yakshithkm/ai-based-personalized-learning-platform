const Question = require('../models/Question');
const TopicMeta = require('../models/TopicMeta');
const isValidObjectId = require('../utils/isValidObjectId');

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

// Subjects are a fixed, system-wide constant (see config/examSubjectMap.js) used by
// the Question schema enum, the exam-subject mapping, the recommendation engine,
// and the ML analysis pipeline. They are intentionally NOT a free CRUD entity here -
// adding/removing a subject would require enum changes across all of those, plus the
// ML service, which is a real architecture change out of scope for this feature. This
// endpoint gives admins full visibility (question/topic counts) without pretending
// subjects can be safely added, edited, or deleted.
const listSubjects = async (req, res, next) => {
  try {
    const rows = await Question.aggregate([
      {
        $group: {
          _id: '$subject',
          questionCount: { $sum: 1 },
          topics: { $addToSet: '$topic' },
        },
      },
    ]);
    const bySubject = new Map(rows.map((r) => [r._id, r]));

    const subjects = SUBJECTS.map((subject) => {
      const row = bySubject.get(subject);
      return {
        subject,
        questionCount: row?.questionCount || 0,
        topicCount: row?.topics?.length || 0,
        editable: false,
      };
    });

    return res.json({
      subjects,
      note:
        'Subjects are a fixed set used across the exam engine, recommendation service, and ML pipeline. ' +
        'Add/edit/delete is not supported here - see the implementation report for details.',
    });
  } catch (error) {
    return next(error);
  }
};

// Topics: merges the real, additive TopicMeta catalog with live (subject, topic)
// pairs actually present on Question documents, so both "planned" topics (0
// questions yet) and "organically existing" topics (created via the seed
// pipeline, never catalogued) show up in one list.
const listTopics = async (req, res, next) => {
  try {
    const { subject = '' } = req.query;

    const questionMatch = subject ? { subject } : {};
    const liveRows = await Question.aggregate([
      { $match: questionMatch },
      { $group: { _id: { subject: '$subject', topic: '$topic' }, questionCount: { $sum: 1 } } },
    ]);

    const catalogMatch = subject ? { subject } : {};
    const catalogRows = await TopicMeta.find(catalogMatch).lean();

    const liveMap = new Map(
      liveRows.map((r) => [`${r._id.subject}::${r._id.topic}`, r.questionCount])
    );
    const catalogMap = new Map(catalogRows.map((r) => [`${r.subject}::${r.name}`, r]));

    const allKeys = new Set([...liveMap.keys(), ...catalogMap.keys()]);

    const topics = Array.from(allKeys).map((key) => {
      const [subj, name] = key.split('::');
      const catalogEntry = catalogMap.get(key);
      return {
        _id: catalogEntry?._id || null,
        subject: subj,
        name,
        status: catalogEntry?.status || 'active',
        notes: catalogEntry?.notes || '',
        questionCount: liveMap.get(key) || 0,
        catalogued: Boolean(catalogEntry),
      };
    });

    topics.sort((a, b) => (a.subject === b.subject ? a.name.localeCompare(b.name) : a.subject.localeCompare(b.subject)));

    return res.json({ topics });
  } catch (error) {
    return next(error);
  }
};

const createTopic = async (req, res, next) => {
  try {
    const { subject, name, notes = '' } = req.body || {};
    if (!SUBJECTS.includes(subject)) {
      res.status(400);
      throw new Error(`subject must be one of ${SUBJECTS.join(', ')}`);
    }
    if (!name || !String(name).trim()) {
      res.status(400);
      throw new Error('name is required');
    }

    const existing = await TopicMeta.findOne({ subject, name: name.trim() });
    if (existing) {
      res.status(400);
      throw new Error('This topic is already catalogued for this subject');
    }

    const topic = await TopicMeta.create({ subject, name: name.trim(), notes });
    return res.status(201).json({ message: 'Topic created successfully', topic });
  } catch (error) {
    return next(error);
  }
};

const updateTopic = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400);
      throw new Error('Invalid topic id');
    }

    const { status, notes } = req.body || {};
    const topic = await TopicMeta.findById(req.params.id);
    if (!topic) {
      res.status(404);
      throw new Error('Topic not found');
    }

    // Renaming the catalog entry's `name` is intentionally not supported here:
    // doing so would desync it from the actual Question.topic strings it's meant
    // to describe (and from historical Performance/Mistake documents already
    // keyed by the old name), which is worse than just deleting and recreating.
    if (status) {
      if (!['active', 'disabled'].includes(status)) {
        res.status(400);
        throw new Error('status must be active or disabled');
      }
      topic.status = status;
    }
    if (typeof notes === 'string') {
      topic.notes = notes;
    }

    await topic.save();
    return res.json({ message: 'Topic updated successfully', topic });
  } catch (error) {
    return next(error);
  }
};

const deleteTopic = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400);
      throw new Error('Invalid topic id');
    }

    const topic = await TopicMeta.findById(req.params.id);
    if (!topic) {
      res.status(404);
      throw new Error('Topic not found');
    }

    const questionCount = await Question.countDocuments({ subject: topic.subject, topic: topic.name });
    if (questionCount > 0) {
      res.status(409);
      throw new Error(
        `Cannot delete: ${questionCount} question(s) still reference this topic. Remove or reassign them first.`
      );
    }

    await topic.deleteOne();
    return res.json({ message: 'Topic deleted successfully' });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listSubjects, listTopics, createTopic, updateTopic, deleteTopic };