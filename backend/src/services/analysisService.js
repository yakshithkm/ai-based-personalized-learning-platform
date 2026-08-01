const Attempt = require('../models/Attempt');
const {
  inferTopicDifficultyFromAttempts,
  computeDifficultyScore,
} = require('./adaptiveDifficultyService');

const round = (value, digits = 2) => Number(value.toFixed(digits));

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const calculateCorrelation = (pairs) => {
  if (!pairs.length) return 0;

  const xs = pairs.map((pair) => pair.timeTakenSec);
  const ys = pairs.map((pair) => (pair.isCorrect ? 1 : 0));

  const n = pairs.length;
  const meanX = xs.reduce((sum, val) => sum + val, 0) / n;
  const meanY = ys.reduce((sum, val) => sum + val, 0) / n;

  const numerator = xs.reduce((sum, x, index) => sum + (x - meanX) * (ys[index] - meanY), 0);
  const denomX = Math.sqrt(xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0));
  const denomY = Math.sqrt(ys.reduce((sum, y) => sum + (y - meanY) ** 2, 0));

  if (!denomX || !denomY) return 0;
  return round(numerator / (denomX * denomY), 3);
};

const trendFromAttempts = (attempts) => {
  if (attempts.length < 12) return 'stable';

  const recent = attempts.slice(0, 10);
  const previous = attempts.slice(10, 20);

  const recentAccuracy =
    (recent.filter((attempt) => attempt.isCorrect).length / Math.max(recent.length, 1)) * 100;
  const previousAccuracy =
    (previous.filter((attempt) => attempt.isCorrect).length / Math.max(previous.length, 1)) * 100;

  const delta = recentAccuracy - previousAccuracy;
  if (delta >= 5) return 'improving';
  if (delta <= -5) return 'declining';
  return 'stable';
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const dayKey = (date) => startOfDay(date).toISOString().slice(0, 10);

const habitMetricsFromAttempts = (attempts, dailyGoal = 10) => {
  if (!attempts.length) {
    return {
      dailyGoal,
      todayCompleted: 0,
      remainingToday: dailyGoal,
      currentStreak: 0,
      longestStreak: 0,
      lastPracticeDate: null,
      streakDays: [],
    };
  }

  const byDay = new Map();
  attempts.forEach((attempt) => {
    const key = dayKey(attempt.createdAt);
    byDay.set(key, (byDay.get(key) || 0) + 1);
  });

  const sortedDays = Array.from(byDay.keys()).sort();
  const today = startOfDay(new Date());
  const todayKey = dayKey(today);
  const todayCompleted = byDay.get(todayKey) || 0;

  let longestStreak = 0;
  let rolling = 0;
  for (let i = 0; i < sortedDays.length; i += 1) {
    if (i === 0) {
      rolling = 1;
    } else {
      const prev = new Date(sortedDays[i - 1]);
      const cur = new Date(sortedDays[i]);
      const diffDays = Math.round((cur.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
      rolling = diffDays === 1 ? rolling + 1 : 1;
    }
    longestStreak = Math.max(longestStreak, rolling);
  }

  let currentStreak = 0;
  let cursor = new Date(today);
  while (true) {
    const key = dayKey(cursor);
    if (!byDay.has(key)) break;
    currentStreak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }

  const streakDays = Array.from({ length: 7 }).map((_, index) => {
    const d = new Date(today.getTime() - (6 - index) * 24 * 60 * 60 * 1000);
    const key = dayKey(d);
    return {
      day: key,
      practiced: byDay.has(key),
      attempts: byDay.get(key) || 0,
    };
  });

  return {
    dailyGoal,
    todayCompleted,
    remainingToday: Math.max(dailyGoal - todayCompleted, 0),
    currentStreak,
    longestStreak,
    lastPracticeDate: sortedDays.length ? new Date(sortedDays[sortedDays.length - 1]) : null,
    streakDays,
  };
};

const weeklyTrendFromAttempts = (attempts) => {
  const today = startOfDay(new Date());
  const dayAttempts = new Map();

  attempts.forEach((attempt) => {
    const key = dayKey(attempt.createdAt);
    if (!dayAttempts.has(key)) {
      dayAttempts.set(key, []);
    }
    dayAttempts.get(key).push(attempt);
  });

  return Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(today.getTime() - (6 - idx) * 24 * 60 * 60 * 1000);
    const key = dayKey(d);
    const list = dayAttempts.get(key) || [];
    const correct = list.filter((entry) => entry.isCorrect).length;
    const accuracy = list.length ? (correct / list.length) * 100 : 0;
    return {
      day: key.slice(5),
      attempts: list.length,
      accuracy: round(accuracy, 1),
    };
  });
};

const analyzePerformance = async (userId) => {
  const attempts = await Attempt.find({ user: userId }).sort({ createdAt: -1 }).lean();

  if (!attempts.length) {
    return {
      weakTopics: [],
      strongTopics: [],
      avgAccuracy: 0,
      avgTime: 0,
      subjectStats: [],
      topicStats: [],
      conceptStats: [],
      weakTopicPriority: [],
      weakConceptPriority: [],
      accuracyTrend: 'stable',
      timeAccuracyCorrelation: 0,
      suggestedFocusTopic: '',
      topicMastery: [],
      dailyGoal: 10,
      todayCompleted: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastPracticeDate: null,
      streakDays: [],
      weeklyTrend: [],
    };
  }

  const topicMap = new Map();
  const conceptMap = new Map();
  const subjectMap = new Map();

  let weightedAttempts = 0;
  let weightedCorrect = 0;
  let weightedTime = 0;

  attempts.forEach((attempt, index) => {
    const weight = index < 10 ? 2 : 1;
    weightedAttempts += weight;
    weightedCorrect += attempt.isCorrect ? weight : 0;
    weightedTime += attempt.timeTakenSec * weight;

    const subtopic = attempt.subtopic || attempt.topic || 'General';
    const topicKey = `${attempt.subject}::${attempt.topic}::${subtopic}`;
    if (!topicMap.has(topicKey)) {
      topicMap.set(topicKey, {
        subject: attempt.subject,
        topic: attempt.topic,
        subtopic,
        attempts: 0,
        correct: 0,
        weightedAttempts: 0,
        weightedCorrect: 0,
        weightedTime: 0,
        rawAttempts: [],
      });
    }

    const topicRef = topicMap.get(topicKey);
    topicRef.attempts += 1;
    topicRef.correct += attempt.isCorrect ? 1 : 0;
    topicRef.weightedAttempts += weight;
    topicRef.weightedCorrect += attempt.isCorrect ? weight : 0;
    topicRef.weightedTime += attempt.timeTakenSec * weight;
    topicRef.rawAttempts.push(attempt);

    const concept = attempt.conceptTested || `${attempt.topic} Core Concept`;
    const conceptKey = `${attempt.subject}::${attempt.topic}::${concept}`;
    if (!conceptMap.has(conceptKey)) {
      conceptMap.set(conceptKey, {
        subject: attempt.subject,
        topic: attempt.topic,
        concept,
        attempts: 0,
        correct: 0,
        weightedAttempts: 0,
        weightedCorrect: 0,
        weightedTime: 0,
        slowCorrectCount: 0,
        mistakeCount: 0,
        streak: 0,
      });
    }

    const conceptRef = conceptMap.get(conceptKey);
    conceptRef.attempts += 1;
    conceptRef.correct += attempt.isCorrect ? 1 : 0;
    conceptRef.weightedAttempts += weight;
    conceptRef.weightedCorrect += attempt.isCorrect ? weight : 0;
    conceptRef.weightedTime += attempt.timeTakenSec * weight;

    const expected = Number(attempt.expectedSolvingTimeSec || 60);
    if (attempt.isCorrect && Number(attempt.timeTakenSec || 0) > expected * 1.25) {
      conceptRef.slowCorrectCount += 1;
    }

    if (!attempt.isCorrect) {
      conceptRef.mistakeCount += 1;
      conceptRef.streak = 0;
    } else {
      conceptRef.streak += 1;
    }

    if (!subjectMap.has(attempt.subject)) {
      subjectMap.set(attempt.subject, {
        subject: attempt.subject,
        attempts: 0,
        weightedAttempts: 0,
        weightedCorrect: 0,
        weightedTime: 0,
      });
    }

    const subjectRef = subjectMap.get(attempt.subject);
    subjectRef.attempts += 1;
    subjectRef.weightedAttempts += weight;
    subjectRef.weightedCorrect += attempt.isCorrect ? weight : 0;
    subjectRef.weightedTime += attempt.timeTakenSec * weight;
  });

  const topicStats = Array.from(topicMap.values()).map((topic) => {
    const accuracy = topic.weightedAttempts
      ? (topic.weightedCorrect / topic.weightedAttempts) * 100
      : 0;
    const avgTimeTakenSec = topic.weightedAttempts
      ? topic.weightedTime / topic.weightedAttempts
      : 0;

    const normalizedTimePenalty = clamp((avgTimeTakenSec - 35) / 65, 0, 1) * 30;
    const focusScore = round(clamp((100 - accuracy) * 0.7 + normalizedTimePenalty, 0, 100), 1);

    return {
      subject: topic.subject,
      topic: topic.topic,
      subtopic: topic.subtopic,
      attempts: topic.attempts,
      correct: topic.correct,
      accuracy: round(accuracy, 1),
      avgTimeTakenSec: round(avgTimeTakenSec, 2),
      focusScore,
      currentDifficulty: inferTopicDifficultyFromAttempts(topic.rawAttempts),
      masteryScore: round(clamp(accuracy * 0.75 + Math.min(topic.attempts * 4, 25), 0, 100), 1),
    };
  });

  const conceptStats = Array.from(conceptMap.values()).map((entry) => {
    const accuracy = entry.weightedAttempts
      ? (entry.weightedCorrect / entry.weightedAttempts) * 100
      : 0;
    const avgTimeTakenSec = entry.weightedAttempts
      ? entry.weightedTime / entry.weightedAttempts
      : 0;
    const slowCorrectRate = entry.attempts
      ? (entry.slowCorrectCount / entry.attempts) * 100
      : 0;
    const mistakeFrequency = entry.attempts
      ? (entry.mistakeCount / entry.attempts) * 100
      : 0;

    const adaptiveDifficultyScore = computeDifficultyScore({
      topicAccuracy: accuracy,
      timeTakenSec: avgTimeTakenSec,
      expectedTimeSec: 60,
      recentStreak: entry.streak,
      mistakeFrequency: mistakeFrequency / 10,
    });

    return {
      subject: entry.subject,
      topic: entry.topic,
      concept: entry.concept,
      attempts: entry.attempts,
      correct: entry.correct,
      accuracy: round(accuracy, 1),
      avgTimeTakenSec: round(avgTimeTakenSec, 2),
      mistakeFrequency: round(mistakeFrequency, 1),
      slowCorrectRate: round(slowCorrectRate, 1),
      masteryScore: round(clamp(accuracy * 0.7 + Math.min(entry.attempts * 3, 30), 0, 100), 1),
      adaptiveDifficultyScore: round(adaptiveDifficultyScore, 1),
    };
  });

  const subjectStats = Array.from(subjectMap.values())
    .map((subject) => ({
      subject: subject.subject,
      attempts: subject.attempts,
      accuracy: round(
        subject.weightedAttempts
          ? (subject.weightedCorrect / subject.weightedAttempts) * 100
          : 0,
        1
      ),
      avgTimeTakenSec: round(
        subject.weightedAttempts ? subject.weightedTime / subject.weightedAttempts : 0,
        2
      ),
    }))
    .sort((a, b) => b.attempts - a.attempts);

  const weakTopicRows = topicStats
    .filter((topic) => topic.attempts >= 1 && topic.accuracy < 60)
    .sort((a, b) => b.focusScore - a.focusScore);
  const strongTopicRows = topicStats.filter((topic) => topic.attempts >= 2 && topic.accuracy > 80);

  const weakTopics = weakTopicRows.map((topic) =>
    topic.subtopic && topic.subtopic !== 'General'
      ? `${topic.subject} - ${topic.topic} (${topic.subtopic})`
      : `${topic.subject} - ${topic.topic}`
  );
  const strongTopics = strongTopicRows.map((topic) =>
    topic.subtopic && topic.subtopic !== 'General'
      ? `${topic.subject} - ${topic.topic} (${topic.subtopic})`
      : `${topic.subject} - ${topic.topic}`
  );

  const weakTopicPriority = weakTopicRows.map((topic) => ({
    subject: topic.subject,
    topic: topic.topic,
    subtopic: topic.subtopic,
    accuracy: topic.accuracy,
    avgTimeTakenSec: topic.avgTimeTakenSec,
    focusScore: topic.focusScore,
  }));

  const weakConceptPriority = conceptStats
    .filter((row) => row.accuracy < 70 || row.slowCorrectRate > 30 || row.mistakeFrequency > 35)
    .map((row) => ({
      subject: row.subject,
      topic: row.topic,
      concept: row.concept,
      accuracy: row.accuracy,
      avgTimeTakenSec: row.avgTimeTakenSec,
      mistakeFrequency: row.mistakeFrequency,
      slowCorrectRate: row.slowCorrectRate,
      priorityScore: round(
        (100 - row.accuracy) * 0.45 +
          row.mistakeFrequency * 0.35 +
          row.slowCorrectRate * 0.2,
        1
      ),
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const suggestedFocusTopic = attempts.length < 5
    ? 'Need more attempts before giving strong focus advice. Keep practicing mixed topics.'
    : weakTopicPriority.length
    ? `You should practice ${weakTopicPriority[0].subtopic && weakTopicPriority[0].subtopic !== 'General' ? `${weakTopicPriority[0].topic} (${weakTopicPriority[0].subtopic})` : weakTopicPriority[0].topic} today`
    : 'Keep practicing to unlock adaptive focus suggestions';

  const timeAccuracyCorrelation = calculateCorrelation(attempts.slice(0, 200));
  const habit = habitMetricsFromAttempts(attempts, 10);
  const topicMastery = topicStats
    .map((topic) => ({
      subject: topic.subject,
      topic: topic.topic,
      subtopic: topic.subtopic,
      masteryScore: topic.masteryScore,
      accuracy: topic.accuracy,
      attempts: topic.attempts,
    }))
    .sort((a, b) => b.masteryScore - a.masteryScore);
  const weeklyTrend = weeklyTrendFromAttempts(attempts.slice(0, 400));

  return {
    weakTopics,
    strongTopics,
    avgAccuracy: round((weightedCorrect / Math.max(weightedAttempts, 1)) * 100, 2),
    avgTime: round(weightedTime / Math.max(weightedAttempts, 1), 2),
    subjectStats,
    topicStats,
    conceptStats,
    weakTopicPriority,
    weakConceptPriority,
    accuracyTrend: trendFromAttempts(attempts),
    timeAccuracyCorrelation,
    suggestedFocusTopic,
    topicMastery,
    dailyGoal: habit.dailyGoal,
    todayCompleted: habit.todayCompleted,
    currentStreak: habit.currentStreak,
    longestStreak: habit.longestStreak,
    lastPracticeDate: habit.lastPracticeDate,
    streakDays: habit.streakDays,
    weeklyTrend,
  };
};

module.exports = {
  analyzePerformance,
};
