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

const getTopicKey = (subject, topic, subtopic = 'General') => `${subject}::${topic}::${subtopic}`;

const reasonToAiSignals = (reason) => {
  if (reason === 'spaced-repetition-due') {
    return {
      labels: ['AI-selected question', 'Based on your mistakes'],
      why: 'This question is due for spaced repetition review.',
      adaptiveDifficultyApplied: true,
    };
  }

  if (reason === 'weak-topic') {
    return {
      labels: ['AI-selected question', 'Adaptive difficulty applied'],
      why: 'Your recent accuracy in this topic is below target.',
      adaptiveDifficultyApplied: true,
    };
  }

  if (reason === 'recent-mistake') {
    return {
      labels: ['AI-selected question', 'Based on your mistakes'],
      why: 'You made a recent mistake in this concept.',
      adaptiveDifficultyApplied: true,
    };
  }

  if (reason === 'new-topic') {
    return {
      labels: ['AI-selected question'],
      why: 'This introduces an unpracticed topic for better coverage.',
      adaptiveDifficultyApplied: false,
    };
  }

  if (reason === 'slightly-harder-challenge') {
    return {
      labels: ['AI-selected question', 'Adaptive difficulty applied'],
      why: 'You are ready for a harder challenge to push mastery.',
      adaptiveDifficultyApplied: true,
    };
  }

  return {
    labels: ['AI-selected question'],
    why: 'Selected to keep your session balanced.',
    adaptiveDifficultyApplied: false,
  };
};

const fetchQuestionBatch = async ({
  targetExam,
  subject,
  topic,
  subtopic,
  difficulty,
  excludeIds,
  limit,
}) => {
  const baseQuery = {
    examType: targetExam,
    subject,
    topic,
    _id: { $nin: Array.from(excludeIds) },
  };

  if (subtopic) {
    baseQuery.$or = [
      { subtopic },
      { subtopic: { $exists: false } },
      { subtopic: null },
    ];
  }

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
      .select('question subject topic subtopic createdAt')
      .lean(),
    Mistake.find({ user: userId, resolved: false, nextReviewAt: { $lte: now } })
      .sort({ nextReviewAt: 1 })
      .limit(20)
      .select('question subject topic subtopic difficulty nextReviewAt repetitionStage')
      .lean(),
    Mistake.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(80)
      .select('question subject topic subtopic difficulty createdAt')
      .lean(),
    Question.aggregate([
      { $match: { examType: targetExam } },
      {
        $group: {
          _id: {
            subject: '$subject',
            topic: '$topic',
            subtopic: { $ifNull: ['$subtopic', '$topic'] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          subject: '$_id.subject',
          topic: '$_id.topic',
          subtopic: '$_id.subtopic',
        },
      },
    ]),
  ]);

  const topicStatsMap = new Map(
    (analysis.topicStats || []).map((row) => [
      getTopicKey(row.subject, row.topic, row.subtopic || 'General'),
      row,
    ])
  );
  const lastPracticeByTopic = new Map();
  const recentlySeenQuestionIds = new Set();
  attempts.forEach((attempt, index) => {
    const key = getTopicKey(attempt.subject, attempt.topic, attempt.subtopic || 'General');
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
      const aiSignals = reasonToAiSignals(reason);
      recommendations.push({
        ...question,
        recommendationReason: reason,
        aiSignals,
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
        subtopic: row.subtopic || 'General',
        preferredDifficulty: deriveDifficulty({
          accuracy: row.accuracy,
          fallback:
            topicStatsMap.get(
              getTopicKey(row.subject, row.topic, row.subtopic || 'General')
            )?.currentDifficulty || 'Medium',
        }),
        score:
          Number(row.focusScore || 0) +
          daysSince(lastPracticeByTopic.get(getTopicKey(row.subject, row.topic, row.subtopic || 'General'))) * 4,
      };
    })
    .sort((a, b) => b.score - a.score);

  const recentMistakeMap = new Map();
  recentMistakes.forEach((mistake) => {
    const key = getTopicKey(mistake.subject, mistake.topic, mistake.subtopic || 'General');
    if (!recentMistakeMap.has(key)) {
      recentMistakeMap.set(key, mistake);
    }
  });

  const weakSet = new Set(
    weakCandidates.map((entry) => getTopicKey(entry.subject, entry.topic, entry.subtopic || 'General'))
  );
  const recentMistakeCandidates = Array.from(recentMistakeMap.values())
    .filter((entry) => !weakSet.has(getTopicKey(entry.subject, entry.topic, entry.subtopic || 'General')))
    .map((entry) => {
      const key = getTopicKey(entry.subject, entry.topic, entry.subtopic || 'General');
      const stat = topicStatsMap.get(key);
      return {
        subject: entry.subject,
        topic: entry.topic,
        subtopic: entry.subtopic || 'General',
        preferredDifficulty: deriveDifficulty({
          accuracy: stat?.accuracy,
          fallback: entry.difficulty || stat?.currentDifficulty || 'Medium',
        }),
        score: 100 - daysSince(entry.createdAt) + daysSince(lastPracticeByTopic.get(key)) * 2,
      };
    })
    .sort((a, b) => b.score - a.score);

  const practicedTopics = new Set(
    (analysis.topicStats || []).map((row) =>
      getTopicKey(row.subject, row.topic, row.subtopic || 'General')
    )
  );
  const newTopicCandidates = allTopics
    .filter((topic) => !practicedTopics.has(getTopicKey(topic.subject, topic.topic, topic.subtopic || 'General')))
    .slice(0, 20)
    .map((topic) => ({
      subject: topic.subject,
      topic: topic.topic,
      subtopic: topic.subtopic || 'General',
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
        subtopic: candidate.subtopic,
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

const getFocusSessionQuestions = async ({ userId, targetExam, total = 10 }) => {
  const sessionSize = Math.min(Math.max(total, 5), 10);

  const recommendationResult = await getRecommendedQuestions({
    userId,
    targetExam,
    limit: Math.max(sessionSize - 1, 5),
  });

  const usedIds = new Set(recommendationResult.recommendations.map((q) => String(q._id)));
  const analysis = await analyzePerformance(userId);

  const strongTopic = (analysis.topicStats || [])
    .filter((row) => Number(row.accuracy || 0) >= 80)
    .sort((a, b) => Number(b.accuracy || 0) - Number(a.accuracy || 0))[0];
  let harderQuestion = null;

  if (strongTopic) {
    harderQuestion = await Question.findOne({
      examType: targetExam,
      subject: strongTopic.subject,
      topic: strongTopic.topic,
      ...(strongTopic.subtopic ? { subtopic: strongTopic.subtopic } : {}),
      difficulty: 'Hard',
      _id: { $nin: Array.from(usedIds) },
    })
      .select('-correctAnswerIndex')
      .lean();
  }

  if (!harderQuestion) {
    harderQuestion = await Question.findOne({
      examType: targetExam,
      difficulty: 'Hard',
      _id: { $nin: Array.from(usedIds) },
    })
      .select('-correctAnswerIndex')
      .lean();
  }

  const questions = [...recommendationResult.recommendations];
  if (harderQuestion) {
    questions.push({
      ...harderQuestion,
      recommendationReason: 'slightly-harder-challenge',
      aiSignals: reasonToAiSignals('slightly-harder-challenge'),
    });
  }

  return {
    source: 'focus-session-engine',
    sessionType: 'focus',
    totalQuestions: sessionSize,
    questions: questions.slice(0, sessionSize),
    mix: {
      weakTopic: questions.filter((q) => q.recommendationReason === 'weak-topic').length,
      mistakeBased: questions.filter(
        (q) => q.recommendationReason === 'recent-mistake' || q.recommendationReason === 'spaced-repetition-due'
      ).length,
      harderChallenge: questions.some((q) => q.recommendationReason === 'slightly-harder-challenge') ? 1 : 0,
    },
  };
};

module.exports = {
  getRecommendedQuestions,
  getFocusSessionQuestions,
};
