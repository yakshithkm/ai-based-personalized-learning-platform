const Performance = require('../models/Performance');
const { analyzePerformance } = require('./analysisService');

const rebuildPerformanceForUser = async (userId) => {
  const analysis = await analyzePerformance(userId);

  const totalAttempts = analysis.topicStats.reduce((sum, topic) => sum + topic.attempts, 0);
  const totalCorrect = analysis.topicStats.reduce((sum, topic) => sum + topic.correct, 0);

  return Performance.findOneAndUpdate(
    { user: userId },
    {
      user: userId,
      totalAttempts,
      totalCorrect,
      overallAccuracy: analysis.avgAccuracy,
      averageTimeTakenSec: analysis.avgTime,
      weakTopics: analysis.weakTopics,
      strongTopics: analysis.strongTopics,
      weakTopicPriority: analysis.weakTopicPriority,
      subjectStats: analysis.subjectStats,
      topicStats: analysis.topicStats,
      dailyGoal: analysis.dailyGoal,
      todayCompleted: analysis.todayCompleted,
      currentStreak: analysis.currentStreak,
      longestStreak: analysis.longestStreak,
      lastPracticeDate: analysis.lastPracticeDate,
      streakDays: analysis.streakDays,
      weeklyTrend: analysis.weeklyTrend,
      accuracyTrend: analysis.accuracyTrend,
      timeAccuracyCorrelation: analysis.timeAccuracyCorrelation,
      suggestedFocusTopic: analysis.suggestedFocusTopic,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

module.exports = { rebuildPerformanceForUser };
