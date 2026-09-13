const User = require('../models/User');
const Question = require('../models/Question');
const Performance = require('../models/Performance');
const ExamSession = require('../models/ExamSession');
const Attempt = require('../models/Attempt');
const TopicMeta = require('../models/TopicMeta');
const { computeExamReadiness } = require('../services/productSignalsService');

const round = (value, digits = 1) => Number((Number(value) || 0).toFixed(digits));
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const getDashboardStats = async (req, res, next) => {
  try {
    const activeSince = new Date(Date.now() - SEVEN_DAYS_MS);

    const [
      totalStudents,
      activeStudents,
      totalQuestions,
      distinctSubjectTopics,
      totalExamSessions,
      performances,
      recentAttempts,
      recentExamSessions,
    ] = await Promise.all([
      User.countDocuments({ isAdmin: { $ne: true } }),
      // "Active" = practiced (Performance.lastPracticeDate) within the last 7 days.
      // Reuses the same field the student dashboard/heatmap already populate - no
      // new tracking needed.
      Performance.countDocuments({ lastPracticeDate: { $gte: activeSince } }),
      Question.countDocuments({}),
      Question.aggregate([{ $group: { _id: { subject: '$subject', topic: '$topic' } } }]),
      ExamSession.countDocuments({}),
      Performance.find({}).select('overallAccuracy currentStreak weeklyTrend topicStats totalAttempts').lean(),
      Attempt.find({})
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('user', 'name email')
        .select('user subject topic isCorrect createdAt')
        .lean(),
      ExamSession.find({ status: { $in: ['submitted', 'expired'] } })
        .sort({ updatedAt: -1 })
        .limit(8)
        .populate('user', 'name email')
        .select('user examType mode status questionCount submittedAt resultSummary updatedAt')
        .lean(),
    ]);

    // Distinct topic count = distinct (subject, topic) pairs actually present on
    // questions, plus any catalog-only topics (0 questions yet) from TopicMeta that
    // don't already show up in that set - avoids double counting.
    const liveTopicKeys = new Set(
      distinctSubjectTopics.map((row) => `${row._id.subject}::${row._id.topic}`)
    );
    const allTopicMetaRows = await TopicMeta.find({}).select('subject name').lean();
    const catalogOnlyTopics = allTopicMetaRows.filter(
      (row) => !liveTopicKeys.has(`${row.subject}::${row.name}`)
    ).length;
    const totalTopics = liveTopicKeys.size + catalogOnlyTopics;

    const performancesWithAttempts = performances.filter((p) => (p.totalAttempts || 0) > 0);
    const avgAccuracy = performancesWithAttempts.length
      ? performancesWithAttempts.reduce((sum, p) => sum + (p.overallAccuracy || 0), 0) /
        performancesWithAttempts.length
      : 0;

    const avgReadiness = performancesWithAttempts.length
      ? performancesWithAttempts.reduce((sum, p) => {
          const readiness = computeExamReadiness({
            overallAccuracy: p.overallAccuracy,
            currentStreak: p.currentStreak,
            weeklyTrend: p.weeklyTrend,
            topicStats: p.topicStats,
          });
          return sum + readiness.score;
        }, 0) / performancesWithAttempts.length
      : 0;

    return res.json({
      totals: {
        students: totalStudents,
        activeStudents,
        subjects: 4,
        topics: totalTopics,
        questions: totalQuestions,
        examSessions: totalExamSessions,
      },
      averages: {
        accuracy: round(avgAccuracy),
        readiness: round(avgReadiness),
        studentsWithData: performancesWithAttempts.length,
      },
      recentActivity: recentAttempts.map((a) => ({
        studentName: a.user?.name || 'Unknown',
        studentEmail: a.user?.email || '',
        subject: a.subject,
        topic: a.topic,
        isCorrect: a.isCorrect,
        at: a.createdAt,
      })),
      recentExams: recentExamSessions.map((s) => ({
        sessionId: s._id,
        studentName: s.user?.name || 'Unknown',
        studentEmail: s.user?.email || '',
        examType: s.examType,
        mode: s.mode,
        status: s.status,
        questionCount: s.questionCount,
        score: s.resultSummary?.scoreSummary?.totalScore ?? null,
        maxScore: s.resultSummary?.scoreSummary?.maxScore ?? null,
        submittedAt: s.submittedAt || s.updatedAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getDashboardStats };