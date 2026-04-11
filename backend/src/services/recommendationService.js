const Attempt = require('../models/Attempt');
const Mistake = require('../models/Mistake');
const Question = require('../models/Question');
const { analyzePerformance } = require('./analysisService');

const sampleItems = (items, count) => {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

const hashString = (value = '') => {
  let hash = 0;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
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
const recommendationHistory = new Map();

const getHistoryForUser = (userId) => {
  const key = String(userId);
  if (!recommendationHistory.has(key)) {
    recommendationHistory.set(key, []);
  }
  return recommendationHistory.get(key);
};

const rankDifficulty = (difficulty) => {
  if (difficulty === 'Hard') return 3;
  if (difficulty === 'Medium') return 2;
  return 1;
};

const countBy = (list, selector) =>
  list.reduce((acc, item) => {
    const key = selector(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

const computeFreshnessPenalty = (candidate, recentHistory) => {
  let penalty = 0;

  recentHistory.forEach((entry, index) => {
    const recencyWeight = 1 + (recentHistory.length - index) / Math.max(recentHistory.length, 1);
    if (String(entry.questionId) === String(candidate._id)) {
      penalty += 120 * recencyWeight;
    }
    if (entry.topic === candidate.topic) {
      penalty += 12 * recencyWeight;
    }
    if ((entry.subtopic || 'General') === (candidate.subtopic || 'General')) {
      penalty += 8 * recencyWeight;
    }
    if ((entry.difficulty || 'Medium') === (candidate.difficulty || 'Medium')) {
      penalty += 3 * recencyWeight;
    }
    if ((entry.recommendationReason || 'fallback') === (candidate.recommendationReason || 'fallback')) {
      penalty += 6 * recencyWeight;
    }
  });

  return penalty;
};

const diversityScore = ({ candidate, selected, recentHistory }) => {
  const topicCounts = countBy(selected, (item) => item.topic || 'General');
  const subtopicCounts = countBy(selected, (item) => item.subtopic || 'General');
  const difficultyCounts = countBy(selected, (item) => item.difficulty || 'Medium');
  const reasonCounts = countBy(selected, (item) => item.recommendationReason || 'fallback');

  const sameTopicPenalty = (topicCounts[candidate.topic || 'General'] || 0) * 22;
  const sameSubtopicPenalty = (subtopicCounts[candidate.subtopic || 'General'] || 0) * 16;
  const sameDifficultyPenalty = (difficultyCounts[candidate.difficulty || 'Medium'] || 0) * 8;
  const sameReasonPenalty = (reasonCounts[candidate.recommendationReason || 'fallback'] || 0) * 6;
  const freshnessPenalty = computeFreshnessPenalty(candidate, recentHistory);

  const priorityBoost =
    candidate.recommendationReason === 'weak-topic'
      ? 30
      : candidate.recommendationReason === 'mistake-review'
        ? 26
        : candidate.recommendationReason === 'new-topic'
          ? 18
          : 8;

  return (
    Number(candidate.baseScore || 0) +
    priorityBoost +
    Math.random() * 10 -
    sameTopicPenalty -
    sameSubtopicPenalty -
    sameDifficultyPenalty -
    sameReasonPenalty -
    freshnessPenalty
  );
};

const reasonToAiSignals = (reason) => {
  if (reason === 'mistake-review') {
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

const reasonDetail = (reason, question) => {
  const variants = {
    'weak-topic': [
      `This targets ${question.topic} (${question.subtopic || 'General'}) because your recent accuracy here is below target and needs reinforcement.`,
      `You are revisiting ${question.topic} with adaptive support since this area has been a consistent weakness in recent attempts.`,
      `${question.topic} is prioritized as a corrective block: accuracy and speed signals show this concept needs deliberate practice.`,
      `We are keeping ${question.topic} in focus because both correctness and response stability are still below your expected baseline.`,
      `Adaptive priority: ${question.topic} is currently underperforming, so this question reinforces the exact weak pocket before escalation.`,
    ],
    'mistake-review': [
      `This is scheduled review for a past mistake in ${question.conceptTested || question.topic}, aligned to spaced repetition timing.`,
      `You missed a similar concept earlier; this corrective review is timed now to prevent forgetting and lock retention.`,
      `This question is resurfaced as mistake review because previous errors in ${question.topic} still need reinforcement.`,
      `Retention checkpoint: this revisits ${question.conceptTested || question.topic} at the right interval to break your old error pattern.`,
      `This review is intentionally repeated with variation so the corrected concept in ${question.topic} becomes durable under pressure.`,
    ],
    'new-topic': [
      `This introduces ${question.topic} (${question.subtopic || 'General'}) to improve syllabus coverage beyond your recent practice bubble.`,
      `Coverage expansion: this is a less-practiced topic selected to avoid single-topic overfitting and improve balance.`,
      `You have seen this area less often, so this recommendation broadens topic diversity while keeping difficulty controlled.`,
      `Topic diversification pick: ${question.topic} is selected to prevent repetition fatigue and improve transfer across chapters.`,
      `Your recent trail is narrow; this ${question.topic} item widens concept exposure without forcing an abrupt difficulty jump.`,
    ],
    fallback: [
      `Freshness pick: this question adds variety while avoiding recently seen items and repeated topic patterns.`,
      `Balanced fallback selection to keep session momentum without overloading the same concept lane.`,
      `This is a rotation candidate chosen for novelty and coverage stability in your current recommendation cycle.`,
      `Diversity fallback: selected to break repetition loops and preserve mixed-topic engagement.`,
    ],
  };

  if (variants[reason]) {
    const index = hashString(`${question._id}-${reason}`) % variants[reason].length;
    return variants[reason][index];
  }

  if (reason === 'weak-topic') {
    return `This targets ${question.topic} because your recent accuracy here is below target and needs reinforcement.`;
  }
  if (reason === 'mistake-review') {
    return `This is scheduled review for a past mistake using spaced repetition timing to improve retention.`;
  }
  if (reason === 'new-topic') {
    return `This introduces a less-practiced topic to improve exam coverage after focused weak-topic work.`;
  }

  return reasonToAiSignals(reason).why;
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
    .limit(Math.max(limit * 10, 40))
    .select('-correctAnswerIndex -correctAnswer')
    .lean();

  if (!pool.length) {
    pool = await Question.find(baseQuery)
      .limit(Math.max(limit * 10, 40))
      .select('-correctAnswerIndex -correctAnswer')
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
      .select('question subject topic subtopic conceptTested isCorrect responsePace createdAt')
      .lean(),
    Mistake.find({ user: userId, resolved: false, nextReviewAt: { $lte: now } })
      .sort({ nextReviewAt: 1 })
      .limit(20)
      .select('question subject topic subtopic conceptTested difficulty nextReviewAt repetitionStage')
      .lean(),
    Mistake.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(80)
      .select('question subject topic subtopic conceptTested difficulty createdAt')
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
  const history = getHistoryForUser(userId);
  const recentHistory = history.slice(-120);
  const recentHistoryIds = new Set(recentHistory.map((entry) => String(entry.questionId)));

  const recentAttemptWindow = attempts.slice(0, 40);
  const fastWrongCount = recentAttemptWindow.filter(
    (attempt) => !attempt.isCorrect && String(attempt.responsePace || '') === 'fast'
  ).length;
  const wrongCount = recentAttemptWindow.filter((attempt) => !attempt.isCorrect).length;
  const guessHeavyProfile = wrongCount >= 8 && fastWrongCount / Math.max(wrongCount, 1) >= 0.55;

  const conceptFastWrongMap = new Map();
  recentAttemptWindow.forEach((attempt) => {
    const conceptKey = attempt.conceptTested || `${attempt.topic} Core Concept`;
    if (!conceptFastWrongMap.has(conceptKey)) {
      conceptFastWrongMap.set(conceptKey, { total: 0, fastWrong: 0 });
    }
    const ref = conceptFastWrongMap.get(conceptKey);
    ref.total += 1;
    if (!attempt.isCorrect && String(attempt.responsePace || '') === 'fast') {
      ref.fastWrong += 1;
    }
  });

  const overconfidentConceptEntry = Array.from(conceptFastWrongMap.entries())
    .filter(([, value]) => value.fastWrong >= 2)
    .sort((a, b) => b[1].fastWrong - a[1].fastWrong)[0];

  const overconfidentWrongProfile =
    Boolean(overconfidentConceptEntry) &&
    (overconfidentConceptEntry[1].fastWrong >= 3 ||
      overconfidentConceptEntry[1].fastWrong / Math.max(overconfidentConceptEntry[1].total, 1) >= 0.6);

  const correctiveConcept = overconfidentConceptEntry?.[0] || null;

  const candidateMap = new Map();
  const registerCandidate = (question, reason, baseScore = 0, options = {}) => {
    const { allowRecentlySeen = false, allowHistorySeen = false } = options;
    const id = String(question._id);
    if (usedIds.has(id)) return;
    if (guessHeavyProfile && question.difficulty === 'Hard') return;
    if (!allowRecentlySeen && recentlySeenQuestionIds.has(id)) return;
    if (!allowHistorySeen && recentHistoryIds.has(id)) return;

    const existing = candidateMap.get(id);
    const payload = {
      ...question,
      recommendationReason: reason,
      baseScore,
      reason: reasonDetail(reason, question),
      aiSignals: reasonToAiSignals(reason),
    };

    if (!existing || payload.baseScore > existing.baseScore) {
      candidateMap.set(id, payload);
    }
  };

  const weakCandidates = (analysis.weakTopicPriority || [])
    .map((row) => {
      const key = getTopicKey(row.subject, row.topic);
      return {
        subject: row.subject,
        topic: row.topic,
        subtopic: row.subtopic || 'General',
        preferredDifficulty: guessHeavyProfile
          ? 'Easy'
          : deriveDifficulty({
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

  const correctiveMistakeCandidates = Array.from(
    new Map(
      recentMistakes
        .map((entry) => {
          const key = getTopicKey(entry.subject, entry.topic, entry.subtopic || 'General');
          const topicStat = topicStatsMap.get(key);
          const weakSignal = Number(topicStat?.accuracy || 100) < 70 ? 25 : 0;
          return [
            key,
            {
              key,
              subject: entry.subject,
              topic: entry.topic,
              subtopic: entry.subtopic || 'General',
              preferredDifficulty: guessHeavyProfile ? 'Easy' : 'Medium',
              score: Math.max(1, 120 - daysSince(entry.createdAt) * 3 + weakSignal),
            },
          ];
        })
        .sort((a, b) => b[1].score - a[1].score)
    ).values()
  ).slice(0, 8);

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

  const loadForCandidates = async (candidates, reason, options = {}) => {
    const {
      includeRecentlySeen = false,
      includeHistory = false,
      batchSize = 8,
      baseScoreOffset = 0,
      forceEasy = false,
    } = options;
    for (const candidate of candidates) {
      if (candidateMap.size >= Math.max(limit * 8, 120)) break;

      const excluded = new Set(Array.from(candidateMap.keys()));
      if (!includeRecentlySeen) {
        recentlySeenQuestionIds.forEach((id) => excluded.add(id));
      }
      if (!includeHistory) {
        recentHistoryIds.forEach((id) => excluded.add(id));
      }

      const preferredDifficulty =
        forceEasy || guessHeavyProfile || overconfidentWrongProfile
          ? 'Easy'
          : candidate.preferredDifficulty;

      const batch = await fetchQuestionBatch({
        targetExam,
        subject: candidate.subject,
        topic: candidate.topic,
        subtopic: candidate.subtopic,
        difficulty: preferredDifficulty,
        excludeIds: excluded,
        limit: batchSize,
      });

      batch.forEach((question) => {
        registerCandidate(
          question,
          reason,
          Number(candidate.score || 0) + baseScoreOffset - rankDifficulty(question.difficulty) * 2,
          {
            allowRecentlySeen: includeRecentlySeen,
            allowHistorySeen: includeHistory,
          }
        );
      });
    }
  };

  await loadForCandidates(weakCandidates, 'weak-topic', {
    batchSize: 10,
    baseScoreOffset: 20,
    includeRecentlySeen: overconfidentWrongProfile,
    includeHistory: overconfidentWrongProfile,
    forceEasy: overconfidentWrongProfile,
  });

  const dueMistakeQuestionIds = Array.from(new Set(dueMistakes.map((mistake) => String(mistake.question))));
  if (dueMistakeQuestionIds.length) {
    const dueQuestions = await Question.find({ _id: { $in: dueMistakeQuestionIds } })
      .select('-correctAnswerIndex -correctAnswer')
      .lean();
    dueQuestions.forEach((question) =>
      registerCandidate(question, 'mistake-review', 34, {
        allowRecentlySeen: true,
        allowHistorySeen: true,
      })
    );
  }

  await loadForCandidates(correctiveMistakeCandidates, 'mistake-review', {
    includeRecentlySeen: true,
    includeHistory: true,
    batchSize: 12,
    baseScoreOffset: overconfidentWrongProfile ? 40 : 18,
    forceEasy: overconfidentWrongProfile,
  });

  if (overconfidentWrongProfile && correctiveConcept) {
    const conceptFocused = await Question.find({
      examType: targetExam,
      conceptTested: correctiveConcept,
      difficulty: { $in: ['Easy', 'Medium'] },
      _id: { $nin: Array.from(candidateMap.keys()) },
    })
      .limit(24)
      .select('-correctAnswerIndex -correctAnswer')
      .lean();

    conceptFocused.forEach((question) =>
      registerCandidate(question, 'mistake-review', 46, {
        allowRecentlySeen: true,
        allowHistorySeen: true,
      })
    );
  }

  await loadForCandidates(newTopicCandidates, 'new-topic', {
    batchSize: 10,
    baseScoreOffset: 12,
  });

  if (candidateMap.size < limit * 3) {
    const fallback = await Question.find({
      examType: targetExam,
      _id: { $nin: Array.from(new Set([...candidateMap.keys(), ...recentlySeenQuestionIds])) },
    })
      .limit(limit * 14)
      .select('-correctAnswerIndex -correctAnswer')
      .lean();

    const filteredFallback = guessHeavyProfile
      ? fallback.filter((q) => q.difficulty !== 'Hard')
      : fallback;
    filteredFallback.forEach((question) => registerCandidate(question, 'fallback', 4));
  }

  let recommendations = [];
  const minDistinctTopics = Math.min(3, limit);
  const selectedTopics = new Set();
  const candidateList = Array.from(candidateMap.values());

  while (recommendations.length < limit && candidateList.length) {
    let bestIndex = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < candidateList.length; i += 1) {
      const candidate = candidateList[i];
      const score = diversityScore({ candidate, selected: recommendations, recentHistory });
      const topicNeeded = selectedTopics.size < minDistinctTopics && !selectedTopics.has(candidate.topic);
      const topicBoost = topicNeeded ? 32 : 0;
      const correctiveBoost =
        overconfidentWrongProfile && ['mistake-review', 'weak-topic'].includes(candidate.recommendationReason)
          ? 25
          : 0;
      const totalScore = score + topicBoost + correctiveBoost;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) break;
    const [selected] = candidateList.splice(bestIndex, 1);
    if (guessHeavyProfile && selected.difficulty === 'Hard') {
      continue;
    }
    recommendations.push(selected);
    usedIds.add(String(selected._id));
    selectedTopics.add(selected.topic);
  }

  if (selectedTopics.size < minDistinctTopics) {
    const topicMissingCount = minDistinctTopics - selectedTopics.size;
    const diversityFill = candidateList
      .filter((candidate) => !selectedTopics.has(candidate.topic))
      .sort((a, b) => diversityScore({ candidate: b, selected: recommendations, recentHistory }) - diversityScore({ candidate: a, selected: recommendations, recentHistory }))
      .slice(0, topicMissingCount);

    diversityFill.forEach((item) => {
      if (recommendations.length < limit && !usedIds.has(String(item._id))) {
        recommendations.push(item);
        usedIds.add(String(item._id));
        selectedTopics.add(item.topic);
      }
    });
  }

  recommendations = recommendations.slice(0, limit);

  if (recommendations.length < limit) {
    const refillPool = await Question.find({
      examType: targetExam,
      _id: { $nin: Array.from(usedIds) },
      ...(guessHeavyProfile ? { difficulty: { $ne: 'Hard' } } : {}),
    })
      .limit(limit * 20)
      .select('-correctAnswerIndex -correctAnswer')
      .lean();

    const refillCandidates = sampleItems(refillPool, Math.max(limit * 6, 30)).map((question) => ({
      ...question,
      recommendationReason: 'fallback',
      baseScore: 2,
      reason: reasonDetail('fallback', question),
      aiSignals: reasonToAiSignals('fallback'),
    }));

    refillCandidates
      .sort(
        (a, b) =>
          diversityScore({ candidate: b, selected: recommendations, recentHistory }) -
          diversityScore({ candidate: a, selected: recommendations, recentHistory })
      )
      .forEach((candidate) => {
        if (recommendations.length >= limit) return;
        const id = String(candidate._id);
        if (usedIds.has(id)) return;
        recommendations.push(candidate);
        usedIds.add(id);
      });
  }

  const ensureTopicDiversity = () => {
    const minimumTopics = Math.min(3, limit);
    const currentTopics = new Set(recommendations.map((q) => q.topic));
    if (currentTopics.size >= minimumTopics) return;

    const replaceableIndexes = recommendations
      .map((item, index) => ({
        index,
        item,
        score: diversityScore({ candidate: item, selected: recommendations, recentHistory }),
      }))
      .sort((a, b) => a.score - b.score)
      .map((entry) => entry.index);

    const topicFocusedPool = candidateList
      .concat(
        recommendations
          .filter((item) => !usedIds.has(String(item._id)))
          .map((item) => ({ ...item }))
      )
      .filter((candidate) => !currentTopics.has(candidate.topic))
      .filter((candidate) => !(guessHeavyProfile && candidate.difficulty === 'Hard'))
      .sort(
        (a, b) =>
          diversityScore({ candidate: b, selected: recommendations, recentHistory }) -
          diversityScore({ candidate: a, selected: recommendations, recentHistory })
      );

    for (const candidate of topicFocusedPool) {
      if (currentTopics.size >= minimumTopics || replaceableIndexes.length === 0) break;
      const idx = replaceableIndexes.shift();
      const oldId = String(recommendations[idx]._id);
      const newId = String(candidate._id);
      if (oldId === newId) continue;
      recommendations[idx] = candidate;
      usedIds.delete(oldId);
      usedIds.add(newId);
      currentTopics.add(candidate.topic);
    }
  };

  ensureTopicDiversity();
  recommendations = recommendations.slice(0, limit);

  if (overconfidentWrongProfile) {
    const correctiveCount = recommendations.filter((item) =>
      ['mistake-review', 'weak-topic'].includes(item.recommendationReason)
    ).length;

    if (correctiveCount < Math.min(4, limit)) {
      const needed = Math.min(4, limit) - correctiveCount;
      const extras = candidateList
        .filter((item) => ['mistake-review', 'weak-topic'].includes(item.recommendationReason))
        .filter((item) => !usedIds.has(String(item._id)))
        .sort(
          (a, b) =>
            diversityScore({ candidate: b, selected: recommendations, recentHistory }) -
            diversityScore({ candidate: a, selected: recommendations, recentHistory })
        )
        .slice(0, needed);

      extras.forEach((item) => {
        if (recommendations.length < limit) {
          recommendations.push(item);
          usedIds.add(String(item._id));
        }
      });

      recommendations = recommendations
        .sort((a, b) => {
          const aCorrective = ['mistake-review', 'weak-topic'].includes(a.recommendationReason) ? 1 : 0;
          const bCorrective = ['mistake-review', 'weak-topic'].includes(b.recommendationReason) ? 1 : 0;
          return bCorrective - aCorrective;
        })
        .slice(0, limit);
    }
  }

  recommendations.forEach((question) => {
    history.push({
      questionId: String(question._id),
      topic: question.topic,
      subtopic: question.subtopic || 'General',
      difficulty: question.difficulty || 'Medium',
      recommendationReason: question.recommendationReason,
      createdAt: now,
    });
  });

  if (history.length > 260) {
    history.splice(0, history.length - 260);
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
      (dueMistakes.length > 0 ? 0.4 : 0) +
      (newTopicCandidates.length > 0 ? 0.2 : 0)
  );

  return {
    source: 'adaptive-rule-engine',
    priorityOrder: ['weak-topic', 'mistake-review', 'new-topic'],
    weakTopics: analysis.weakTopics,
    strongTopics: analysis.strongTopics,
    recommendations: recommendations.slice(0, limit),
    difficultyPlan,
    confidence: Number(signalScore.toFixed(2)),
    diversityDiagnostics: {
      distinctTopics: new Set(recommendations.map((q) => q.topic)).size,
      distinctSubtopics: new Set(recommendations.map((q) => q.subtopic || 'General')).size,
      distinctDifficulties: new Set(recommendations.map((q) => q.difficulty || 'Medium')).size,
      overconfidentWrongProfile,
      guessHeavyProfile,
      freshnessWindow: recentHistory.length,
    },
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
      .select('-correctAnswerIndex -correctAnswer')
      .lean();
  }

  if (!harderQuestion) {
    harderQuestion = await Question.findOne({
      examType: targetExam,
      difficulty: 'Hard',
      _id: { $nin: Array.from(usedIds) },
    })
      .select('-correctAnswerIndex -correctAnswer')
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
