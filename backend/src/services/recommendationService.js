const Attempt = require('../models/Attempt');
const Mistake = require('../models/Mistake');
const Question = require('../models/Question');
const { analyzePerformance } = require('./analysisService');

const sampleItems = (items, count) => {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

const daysSince = (date) => {
  if (!date) return 999;
  const diffMs = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
};

const deriveDifficulty = ({ accuracy, fallback = 'Medium' }) => {
  if (Number(accuracy) > 80) return 'Hard';
  if (Number(accuracy) < 50) return 'Easy';
  return fallback;
};

const getTopicKey = (subject, topic) => `${subject}::${topic}`;

const fetchQuestionBatch = async ({ targetExam, subject, topic, difficulty, excludeIds, limit }) => {
  const baseQuery = {
    examType: targetExam,
    subject,
    topic,
    _id: { $nin: Array.from(excludeIds) },
  };

  let pool = await Question.find({ ...baseQuery, difficulty })
    .limit(Math.max(limit * 4, 12))
    .select('-correctAnswerIndex')
    .lean();

  if (!pool.length) {
    pool = await Question.find(baseQuery)
      .limit(Math.max(limit * 4, 12))
      .select('-correctAnswerIndex')
      .lean();
  }

  return sampleItems(pool, limit);
};

const getRecommendedQuestions = async ({ userId, targetExam, limit = 10 }) => {
  const now = new Date();
  const [analysis, attempts, dueMistakes, recentMistakes, allTopics] = await Promise.all([
    analyzePerformance(userId),
    Attempt.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(250)
      .select('question subject topic createdAt')
      .lean(),
    Mistake.find({ user: userId, resolved: false, nextReviewAt: { $lte: now } })
      .sort({ nextReviewAt: 1 })
      .limit(20)
      .select('question subject topic difficulty nextReviewAt repetitionStage')
      .lean(),
    Mistake.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(80)
      .select('question subject topic difficulty createdAt')
      .lean(),
    Question.aggregate([
      { $match: { examType: targetExam } },
      { $group: { _id: { subject: '$subject', topic: '$topic' } } },
      {
        $project: {
          _id: 0,
          subject: '$_id.subject',
          topic: '$_id.topic',
        },
      },
    ]),
  ]);

  const topicStatsMap = new Map(
    (analysis.topicStats || []).map((row) => [getTopicKey(row.subject, row.topic), row])
  );
  const lastPracticeByTopic = new Map();
  const recentlySeenQuestionIds = new Set();
  attempts.forEach((attempt, index) => {
    const key = getTopicKey(attempt.subject, attempt.topic);
    if (!lastPracticeByTopic.has(key)) {
      lastPracticeByTopic.set(key, attempt.createdAt);
    }
    if (index < 20 && attempt.question) {
      recentlySeenQuestionIds.add(String(attempt.question));
    }
  });

  const usedIds = new Set();
  const recommendations = [];

  const pushQuestions = (questions, reason) => {
    questions.forEach((question) => {
      if (recommendations.length >= limit) return;
      const id = String(question._id);
      if (usedIds.has(id)) return;
      usedIds.add(id);
      recommendations.push({
        ...question,
        recommendationReason: reason,
      });
    });
  };

  const dueMistakeQuestionIds = Array.from(new Set(dueMistakes.map((mistake) => String(mistake.question))));
  if (dueMistakeQuestionIds.length) {
    const dueQuestions = await Question.find({ _id: { $in: dueMistakeQuestionIds } })
      .select('-correctAnswerIndex')
      .lean();
    pushQuestions(dueQuestions, 'spaced-repetition-due');
  }

  const weakCandidates = (analysis.weakTopicPriority || [])
    .map((row) => {
      const key = getTopicKey(row.subject, row.topic);
      return {
        subject: row.subject,
        topic: row.topic,
        preferredDifficulty: deriveDifficulty({
          accuracy: row.accuracy,
          fallback: topicStatsMap.get(key)?.currentDifficulty || 'Medium',
        }),
        score: Number(row.focusScore || 0) + daysSince(lastPracticeByTopic.get(key)) * 4,
      };
    })
    .sort((a, b) => b.score - a.score);

  const recentMistakeMap = new Map();
  recentMistakes.forEach((mistake) => {
    const key = getTopicKey(mistake.subject, mistake.topic);
    if (!recentMistakeMap.has(key)) {
      recentMistakeMap.set(key, mistake);
    }
  });

  const weakSet = new Set(weakCandidates.map((entry) => getTopicKey(entry.subject, entry.topic)));
  const recentMistakeCandidates = Array.from(recentMistakeMap.values())
    .filter((entry) => !weakSet.has(getTopicKey(entry.subject, entry.topic)))
    .map((entry) => {
      const key = getTopicKey(entry.subject, entry.topic);
      const stat = topicStatsMap.get(key);
      return {
        subject: entry.subject,
        topic: entry.topic,
        preferredDifficulty: deriveDifficulty({
          accuracy: stat?.accuracy,
          fallback: entry.difficulty || stat?.currentDifficulty || 'Medium',
        }),
        score: 100 - daysSince(entry.createdAt) + daysSince(lastPracticeByTopic.get(key)) * 2,
      };
    })
    .sort((a, b) => b.score - a.score);

  const practicedTopics = new Set((analysis.topicStats || []).map((row) => getTopicKey(row.subject, row.topic)));
  const newTopicCandidates = allTopics
    .filter((topic) => !practicedTopics.has(getTopicKey(topic.subject, topic.topic)))
    .slice(0, 20)
    .map((topic) => ({
      subject: topic.subject,
      topic: topic.topic,
      preferredDifficulty: 'Medium',
      score: 1,
    }));

  const loadForCandidates = async (candidates, reason) => {
    for (const candidate of candidates) {
      if (recommendations.length >= limit) break;
      const batch = await fetchQuestionBatch({
        targetExam,
        subject: candidate.subject,
        topic: candidate.topic,
        difficulty: candidate.preferredDifficulty,
        excludeIds: new Set([...usedIds, ...recentlySeenQuestionIds]),
        limit: Math.min(2, limit - recommendations.length),
      });
      pushQuestions(batch, reason);
    }
  };

  await loadForCandidates(weakCandidates, 'weak-topic');
  await loadForCandidates(recentMistakeCandidates, 'recent-mistake');
  await loadForCandidates(newTopicCandidates, 'new-topic');

  if (recommendations.length < limit) {
    const fallback = await Question.find({
      examType: targetExam,
      _id: { $nin: Array.from(new Set([...usedIds, ...recentlySeenQuestionIds])) },
    })
      .limit(limit * 2)
      .select('-correctAnswerIndex')
      .lean();

    pushQuestions(sampleItems(fallback, limit - recommendations.length), 'fallback');
  }

  const difficultyPlan = recommendations.reduce(
    (acc, question) => {
      const key = question.difficulty || 'Medium';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { Easy: 0, Medium: 0, Hard: 0 }
  );

  const signalScore = Math.min(
    1,
    (weakCandidates.length > 0 ? 0.4 : 0) +
      (recentMistakeCandidates.length + dueMistakes.length > 0 ? 0.4 : 0) +
      (newTopicCandidates.length > 0 ? 0.2 : 0)
  );

  return {
    source: 'adaptive-rule-engine',
    priorityOrder: ['weak-topic', 'recent-mistake', 'new-topic'],
    weakTopics: analysis.weakTopics,
    strongTopics: analysis.strongTopics,
    recommendations: recommendations.slice(0, limit),
    difficultyPlan,
    confidence: Number(signalScore.toFixed(2)),
  };
};

module.exports = {
  getRecommendedQuestions,
};
