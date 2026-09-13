const User = require('../models/User');
const Performance = require('../models/Performance');
const Attempt = require('../models/Attempt');
const isValidObjectId = require('../utils/isValidObjectId');
const { getAdaptiveAnalytics } = require('../services/analyticsService');

// Maps the sortBy query param to a field on the combined (User + Performance)
// row built below. Sorting happens in-memory after the join since the two
// source fields live in different collections.
const SORTABLE_FIELDS = new Set([
  'name',
  'email',
  'registeredAt',
  'overallAccuracy',
  'currentStreak',
  'totalAttempts',
]);

// Students list: real data joined from User + Performance (one document per user,
// already maintained by the existing rebuildPerformanceForUser pipeline every time
// a student submits an attempt - no duplicate calculation here).
const listStudents = async (req, res, next) => {
  try {
    const {
      search = '',
      targetExam = '',
      sortBy = 'registeredAt',
      order = 'desc',
      page = 1,
      pageSize = 20,
    } = req.query;

    const userFilter = { isAdmin: { $ne: true } };
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      userFilter.$or = [{ name: regex }, { email: regex }];
    }
    if (targetExam) {
      userFilter.targetExam = targetExam;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));

    const users = await User.find(userFilter)
      .select('name email targetExam createdAt isDemo')
      .lean();

    const userIds = users.map((u) => u._id);
    const performances = await Performance.find({ user: { $in: userIds } })
      .select('user overallAccuracy currentStreak totalAttempts lastPracticeDate')
      .lean();
    const perfByUser = new Map(performances.map((p) => [String(p.user), p]));

    let combined = users.map((u) => {
      const perf = perfByUser.get(String(u._id)) || {};
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        targetExam: u.targetExam,
        registeredAt: u.createdAt,
        isDemo: Boolean(u.isDemo),
        overallAccuracy: Math.round(perf.overallAccuracy || 0),
        currentStreak: perf.currentStreak || 0,
        totalAttempts: perf.totalAttempts || 0,
        lastPracticeDate: perf.lastPracticeDate || null,
        status: perf.lastPracticeDate && Date.now() - new Date(perf.lastPracticeDate).getTime() < 7 * 24 * 60 * 60 * 1000
          ? 'active'
          : 'inactive',
      };
    });

    const sortField = SORTABLE_FIELDS.has(sortBy) ? sortBy : 'registeredAt';
    const dir = order === 'asc' ? 1 : -1;
    combined.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return av > bv ? dir : -dir;
    });

    const total = combined.length;
    const start = (pageNum - 1) * size;
    const pageItems = combined.slice(start, start + size);

    return res.json({
      students: pageItems,
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

// Student detail: reuses the exact same getAdaptiveAnalytics() service the student's
// own /analytics/me endpoint calls - no duplicated readiness/weak-topic/streak math.
const getStudentDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400);
      throw new Error('Invalid student id');
    }

    const student = await User.findById(id).select('-password');
    if (!student || student.isAdmin) {
      res.status(404);
      throw new Error('Student not found');
    }

    const [analytics, recentAttempts] = await Promise.all([
      getAdaptiveAnalytics(student._id, student.targetExam),
      Attempt.find({ user: student._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('subject topic difficulty isCorrect timeTakenSec createdAt')
        .lean(),
    ]);

    return res.json({
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
        targetExam: student.targetExam,
        registeredAt: student.createdAt,
        isDemo: Boolean(student.isDemo),
      },
      analytics,
      recentAttempts,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listStudents, getStudentDetail };