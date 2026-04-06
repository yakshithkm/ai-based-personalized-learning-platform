const Attempt = require('../models/Attempt');
const Question = require('../models/Question');
const { analyzePerformance } = require('./analysisService');

const sampleItems = (items, count) => {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

const buildDifficultyPlan = (total) => {
  const medium = Math.max(1, Math.round(total * 0.6));
  const easy = Math.max(1, Math.round(total * 0.3));
  const hard = Math.max(1, total - medium - easy);

  const planTotal = medium + easy + hard;
  if (planTotal === total) {
    return { Medium: medium, Easy: easy, Hard: hard };
  }

  return {
    Medium: medium,
    Easy: easy,
    Hard: Math.max(1, hard - (planTotal - total)),
  };
};

const queryQuestionPool = async ({
  targetExam,
  excludeIds,
  difficulty,
  topicFilters,
  limit,
}) => {
  const query = {
    examType: targetExam,
    difficulty,
    _id: { $nin: Array.from(excludeIds) },
  };

  if (topicFilters.length) {
    query.$or = topicFilters;
  }

  const pool = await Question.find(query)
    .limit(Math.max(limit * 4, 20))
    .select('-correctAnswerIndex')
    .lean();

  return sampleItems(pool, limit);
};

const getRecommendedQuestions = async ({ userId, targetExam, limit = 10 }) => {
  const [analysis, recentAttempts] = await Promise.all([
    analyzePerformance(userId),
    Attempt.find({ user: userId }).sort({ createdAt: -1 }).limit(25).select('question').lean(),
  ]);

  const excludeIds = new Set(
    recentAttempts.map((attempt) => String(attempt.question)).filter(Boolean)
  );

  const topicFilters = (analysis.weakTopicPriority || []).slice(0, 6).map((row) => ({
    subject: row.subject,
    topic: row.topic,
  }));

  const difficultyPlan = buildDifficultyPlan(limit);
  const recommendations = [];
  const usedIds = new Set(excludeIds);

  for (const [difficulty, targetCount] of Object.entries(difficultyPlan)) {
    const picks = await queryQuestionPool({
      targetExam,
      excludeIds: usedIds,
      difficulty,
      topicFilters,
      limit: targetCount,
    });

    picks.forEach((question) => {
      usedIds.add(String(question._id));
      recommendations.push(question);
    });
  }

  if (recommendations.length < limit) {
    const fallbackPool = await Question.find({
      examType: targetExam,
      _id: { $nin: Array.from(usedIds) },
    })
      .limit(limit * 2)
      .select('-correctAnswerIndex')
      .lean();

    sampleItems(fallbackPool, limit - recommendations.length).forEach((question) => {
      recommendations.push(question);
    });
  }

  return {
    source: 'adaptive-rule-engine',
    weakTopics: analysis.weakTopics,
    strongTopics: analysis.strongTopics,
    recommendations: recommendations.slice(0, limit),
    difficultyPlan,
    confidence: 0.82,
  };
};

module.exports = {
  getRecommendedQuestions,
};
