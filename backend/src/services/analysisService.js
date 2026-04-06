const Attempt = require('../models/Attempt');
const { inferTopicDifficultyFromAttempts } = require('./adaptiveDifficultyService');

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
      weakTopicPriority: [],
      accuracyTrend: 'stable',
      timeAccuracyCorrelation: 0,
      suggestedFocusTopic: '',
    };
  }

  const topicMap = new Map();
  const subjectMap = new Map();

  let weightedAttempts = 0;
  let weightedCorrect = 0;
  let weightedTime = 0;

  attempts.forEach((attempt, index) => {
    const weight = index < 10 ? 2 : 1;
    weightedAttempts += weight;
    weightedCorrect += attempt.isCorrect ? weight : 0;
    weightedTime += attempt.timeTakenSec * weight;

    const topicKey = `${attempt.subject}::${attempt.topic}`;
    if (!topicMap.has(topicKey)) {
      topicMap.set(topicKey, {
        subject: attempt.subject,
        topic: attempt.topic,
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
      attempts: topic.attempts,
      correct: topic.correct,
      accuracy: round(accuracy, 1),
      avgTimeTakenSec: round(avgTimeTakenSec, 2),
      focusScore,
      currentDifficulty: inferTopicDifficultyFromAttempts(topic.rawAttempts),
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
    .filter((topic) => topic.accuracy < 60)
    .sort((a, b) => b.focusScore - a.focusScore);
  const strongTopicRows = topicStats.filter((topic) => topic.accuracy > 80);

  const weakTopics = weakTopicRows.map((topic) => `${topic.subject} - ${topic.topic}`);
  const strongTopics = strongTopicRows.map((topic) => `${topic.subject} - ${topic.topic}`);

  const weakTopicPriority = weakTopicRows.map((topic) => ({
    subject: topic.subject,
    topic: topic.topic,
    accuracy: topic.accuracy,
    avgTimeTakenSec: topic.avgTimeTakenSec,
    focusScore: topic.focusScore,
  }));

  const suggestedFocusTopic = weakTopicPriority.length
    ? `You should practice ${weakTopicPriority[0].topic} today`
    : 'Keep practicing to unlock adaptive focus suggestions';

  const timeAccuracyCorrelation = calculateCorrelation(attempts.slice(0, 200));

  return {
    weakTopics,
    strongTopics,
    avgAccuracy: round((weightedCorrect / Math.max(weightedAttempts, 1)) * 100, 2),
    avgTime: round(weightedTime / Math.max(weightedAttempts, 1), 2),
    subjectStats,
    topicStats,
    weakTopicPriority,
    accuracyTrend: trendFromAttempts(attempts),
    timeAccuracyCorrelation,
    suggestedFocusTopic,
  };
};

module.exports = {
  analyzePerformance,
};
