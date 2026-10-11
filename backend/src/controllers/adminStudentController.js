const User = require('../models/User');
const Performance = require('../models/Performance');
const Attempt = require('../models/Attempt');
const isValidObjectId = require('../utils/isValidObjectId');
const { getAdaptiveAnalytics } = require('../services/analyticsService');
const { isValidTier, resolveTierContext } = require('../services/tier/tierService');
const { applySubscription, describeSubscription, SubscriptionError } = require('../services/tier/subscriptionService');
const { getUsageSnapshot } = require('../services/tier/usageService');
const { SUBSCRIPTION_STATUSES } = require('../config/tiers');

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

// Admin view of a user's subscription: the stored (granted) tier plus the effective status, so an
// expired paid plan is visible as such instead of silently showing PRO.
const subscriptionColumns = (user) => {
  const sub = describeSubscription(user);
  return {
    tier: sub.storedTier,
    effectiveTier: sub.tier,
    subscriptionStatus: sub.status,
    subscriptionStartDate: sub.startDate,
    subscriptionEndDate: sub.endDate,
  };
};

// Students list: real data joined from User + Performance (one document per user,
// already maintained by the existing rebuildPerformanceForUser pipeline every time
// a student submits an attempt - no duplicate calculation here).
const listStudents = async (req, res, next) => {
  try {
    const {
      search = '',
      targetExam = '',
      tier = '',
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
    if (tier) {
      if (!isValidTier(String(tier).toUpperCase())) {
        res.status(400);
        throw new Error('tier must be FREE, PRO or PREMIUM');
      }
      // Users that predate the tier field have none stored and count as FREE.
      userFilter.tier = String(tier).toUpperCase() === 'FREE'
        ? { $in: ['FREE', null] }
        : String(tier).toUpperCase();
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));

    const users = await User.find(userFilter)
      .select('name email targetExam createdAt isDemo tier subscriptionStatus subscriptionStartDate subscriptionEndDate')
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
        ...subscriptionColumns(u),
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
// PATCH /api/admin/students/:id/tier - the admin-only way to grant or change a tier today (a
// payment webhook would call the same subscriptionService.applySubscription later). Admin-only by
// the router-level protect + requireAdmin; the tier comes from the body but is validated against
// the enum and the target must be an existing non-admin student. Demo accounts are locked so a
// presentation account cannot be changed by accident.
const updateStudentTier = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400);
      throw new Error('Invalid student id');
    }
    const { tier, status, endDate } = req.body || {};
    if (!isValidTier(tier)) {
      res.status(400);
      throw new Error('tier must be FREE, PRO or PREMIUM');
    }
    if (status !== undefined && !Object.values(SUBSCRIPTION_STATUSES).includes(status)) {
      res.status(400);
      throw new Error('Invalid subscription status');
    }

    const student = await User.findById(id).select('isAdmin isDemo tier');
    if (!student || student.isAdmin) {
      res.status(404);
      throw new Error('Student not found');
    }
    if (student.isDemo) {
      return res.status(409).json({
        success: false,
        code: 'DEMO_ACCOUNT_LOCKED',
        message: 'Demo accounts have a fixed tier. Re-run "npm run seed:demo" to reprovision them.',
      });
    }

    const previousTier = student.tier || 'FREE';
    const updated = await applySubscription(id, { tier, status, endDate, provider: 'admin' });
    // eslint-disable-next-line no-console
    console.info(`[tier] admin ${req.user._id} changed user ${id}: ${previousTier} -> ${updated.tier}`);

    return res.json({
      student: { _id: updated._id, ...subscriptionColumns(updated) },
    });
  } catch (error) {
    if (error instanceof SubscriptionError) res.status(error.statusCode);
    return next(error);
  }
};

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

    const [analytics, recentAttempts, usage] = await Promise.all([
      getAdaptiveAnalytics(student._id, student.targetExam),
      Attempt.find({ user: student._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('subject topic difficulty isCorrect timeTakenSec createdAt')
        .lean(),
      getUsageSnapshot({ userId: student._id, tier: resolveTierContext(student).tier }),
    ]);

    return res.json({
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
        targetExam: student.targetExam,
        registeredAt: student.createdAt,
        isDemo: Boolean(student.isDemo),
        ...subscriptionColumns(student),
      },
      usage,
      analytics,
      recentAttempts,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listStudents, getStudentDetail, updateStudentTier };