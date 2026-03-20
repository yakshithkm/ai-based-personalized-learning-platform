const Attempt = require('../models/Attempt');
const Performance = require('../models/Performance');

const rebuildPerformanceForUser = async (userId) => {
  const attempts = await Attempt.find({ user: userId }).lean();

  const totalAttempts = attempts.length;
  const totalCorrect = attempts.filter((a) => a.isCorrect).length;
  const overallAccuracy = totalAttempts ? (totalCorrect / totalAttempts) * 100 : 0;
  const averageTimeTakenSec = totalAttempts
    ? attempts.reduce((sum, a) => sum + a.timeTakenSec, 0) / totalAttempts
    : 0;

  const topicMap = new Map();

  attempts.forEach((attempt) => {
    const key = `${attempt.subject}::${attempt.topic}`;
    if (!topicMap.has(key)) {
      topicMap.set(key, {
        subject: attempt.subject,
        topic: attempt.topic,
        attempts: 0,
        correct: 0,
        totalTime: 0,
      });
    }

    const item = topicMap.get(key);
    item.attempts += 1;
    item.correct += attempt.isCorrect ? 1 : 0;
    item.totalTime += attempt.timeTakenSec;
  });

  const topicStats = Array.from(topicMap.values()).map((item) => ({
    subject: item.subject,
    topic: item.topic,
    attempts: item.attempts,
    correct: item.correct,
    accuracy: item.attempts ? (item.correct / item.attempts) * 100 : 0,
    avgTimeTakenSec: item.attempts ? item.totalTime / item.attempts : 0,
  }));

  const weakTopics = topicStats
    .filter((topic) => topic.attempts >= 3 && topic.accuracy < 60)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 8)
    .map((topic) => `${topic.subject} - ${topic.topic}`);

  return Performance.findOneAndUpdate(
    { user: userId },
    {
      user: userId,
      totalAttempts,
      totalCorrect,
      overallAccuracy,
      averageTimeTakenSec,
      topicStats,
      weakTopics,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

module.exports = { rebuildPerformanceForUser };
