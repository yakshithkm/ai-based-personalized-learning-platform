const ExamSession = require('../models/ExamSession');
const User = require('../models/User');
const isValidObjectId = require('../utils/isValidObjectId');

// IMPORTANT SCOPE NOTE (see final implementation report for the full explanation):
// This project has no stored "Exam" template entity. Every exam a student takes is
// procedurally generated on demand by examSimulationService.js from a hardcoded
// MOCK_BLUEPRINTS config (fixed question count + time limit per examType) - that
// file is documented in the project's own history as the single highest-fragility
// piece of the codebase (race conditions, single-flight bugs). Building a true
// admin "create custom exam" feature would mean either (a) duplicating the exam
// engine, which the spec explicitly forbids, or (b) modifying that already-fragile
// service, which is too risky to do as part of this change. So this controller
// gives admins full, real, read-only oversight of every exam session that has
// actually happened - list/filter/search/detail - which is the part of "Exam
// Management" that's safely implementable today.
const listExamSessions = async (req, res, next) => {
  try {
    const {
      status = '',
      examType = '',
      mode = '',
      search = '',
      page = 1,
      pageSize = 20,
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (examType) filter.examType = examType;
    if (mode) filter.mode = mode;

    let userIdFilter = null;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const matchingUsers = await User.find({ $or: [{ name: regex }, { email: regex }] }).select('_id');
      userIdFilter = matchingUsers.map((u) => u._id);
      filter.user = { $in: userIdFilter };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));

    const [total, sessions] = await Promise.all([
      ExamSession.countDocuments(filter),
      ExamSession.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * size)
        .limit(size)
        .populate('user', 'name email')
        .select(
          'user examType mode sectionSubject status questionCount timeLimitSec startedAt submittedAt resultSummary integrityRisk createdAt'
        )
        .lean(),
    ]);

    return res.json({
      sessions: sessions.map((s) => ({
        _id: s._id,
        studentName: s.user?.name || 'Unknown',
        studentEmail: s.user?.email || '',
        examType: s.examType,
        mode: s.mode,
        sectionSubject: s.sectionSubject,
        status: s.status,
        questionCount: s.questionCount,
        timeLimitSec: s.timeLimitSec,
        startedAt: s.startedAt,
        submittedAt: s.submittedAt,
        score: s.resultSummary?.scoreSummary?.totalScore ?? null,
        maxScore: s.resultSummary?.scoreSummary?.maxScore ?? null,
        integrityRisk: Boolean(s.integrityRisk),
        createdAt: s.createdAt,
      })),
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

const getExamSessionDetail = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(400);
      throw new Error('Invalid exam session id');
    }

    const session = await ExamSession.findById(req.params.id)
      .populate('user', 'name email targetExam')
      .lean();

    if (!session) {
      res.status(404);
      throw new Error('Exam session not found');
    }

    return res.json({ session });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listExamSessions, getExamSessionDetail };