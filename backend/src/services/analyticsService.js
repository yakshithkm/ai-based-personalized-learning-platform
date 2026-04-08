const Attempt = require('../models/Attempt');
const Mistake = require('../models/Mistake');
const { rebuildPerformanceForUser } = require('./performanceService');
const { getMistakeBankForUser } = require('./progressTracker');

const round = (value, digits = 1) => Number(value.toFixed(digits));

const groupAttemptsByTopic = (attempts) => {
  const map = new Map();

  attempts.forEach((attempt) => {
    const key = `${attempt.subject}::${attempt.topic}::${attempt.subtopic || 'General'}`;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(attempt);
  });

  return map;
};

const buildImprovementInsight = (attempts) => {
  const topicMap = groupAttemptsByTopic(attempts);
  let best = null;

  topicMap.forEach((topicAttempts, key) => {
    if (topicAttempts.length < 4) return;

    const ordered = [...topicAttempts].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const split = Math.floor(ordered.length / 2);
    const older = ordered.slice(0, split);
    const recent = ordered.slice(split);

    if (!older.length || !recent.length) return;

    const oldAcc = (older.filter((entry) => entry.isCorrect).length / older.length) * 100;
    const newAcc = (recent.filter((entry) => entry.isCorrect).length / recent.length) * 100;
    const improvement = newAcc - oldAcc;

    if (!best || improvement > best.improvement) {
      const [subject, topic, subtopic] = key.split('::');
      best = {
        subject,
        topic,
        subtopic,
        oldAcc,
        newAcc,
        improvement,
      };
    }
  });

  if (!best || best.improvement <= 0) {
    return {
      text: 'Consistency is building. Keep solving in your weak topics to unlock measurable gains.',
      topic: '',
      fromAccuracy: 0,
      toAccuracy: 0,
    };
  }

  return {
    text: `Your accuracy in ${best.subtopic && best.subtopic !== 'General' ? `${best.topic} (${best.subtopic})` : best.topic} improved from ${round(best.oldAcc)}% to ${round(best.newAcc)}%.`,
    topic: `${best.subject} - ${best.topic}`,
    fromAccuracy: round(best.oldAcc),
    toAccuracy: round(best.newAcc),
  };
};

const buildNextBestAction = ({ dueMistakeCount, focusToday, strongTopics, streak }) => {
  if (dueMistakeCount > 0) {
    return {
      title: 'Your Next Step',
      label: 'Retry Mistake Reviews',
      reason: 'due-mistakes',
      route: '/practice',
      query: { mode: 'recommended' },
    };
  }

  if (focusToday.length) {
    const topic = `${focusToday[0].subject} - ${focusToday[0].topic}`;
    return {
      title: 'Your Next Step',
      label: 'Continue Weak Topic Practice',
      reason: 'weak-topic',
      route: '/practice',
      query: { mode: 'recommended', topic },
    };
  }

  if ((strongTopics || []).length) {
    return {
      title: 'Your Next Step',
      label: 'Increase Difficulty Challenge',
      reason: 'increase-difficulty',
      route: '/practice',
      query: { mode: 'focus' },
    };
  }

  return {
    title: 'Your Next Step',
    label: streak.currentStreak ? 'Start Focus Session' : 'Begin Daily Practice',
    reason: 'start-session',
    route: '/practice',
    query: { mode: 'focus' },
  };
};

const getAdaptiveAnalytics = async (userId) => {
  const now = new Date();

  const [performance, recentAttempts, allAttempts, mistakeBank, dueMistakeCount] = await Promise.all([
    rebuildPerformanceForUser(userId),
    Attempt.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('subject topic isCorrect timeTakenSec createdAt difficulty question'),
    Attempt.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(250)
      .select('subject topic subtopic isCorrect timeTakenSec createdAt'),
    getMistakeBankForUser(userId),
    Mistake.countDocuments({ user: userId, resolved: false, nextReviewAt: { $lte: now } }),
  ]);

  const attemptsBySubject = performance?.subjectStats || [];
  const focusToday = (performance?.weakTopicPriority || []).slice(0, 2);
  const improvementInsight = buildImprovementInsight(allAttempts || []);
  const habit = {
    dailyGoal: performance?.dailyGoal || 10,
    todayCompleted: performance?.todayCompleted || 0,
    remainingToday: Math.max((performance?.dailyGoal || 10) - (performance?.todayCompleted || 0), 0),
    currentStreak: performance?.currentStreak || 0,
    longestStreak: performance?.longestStreak || 0,
    streakDays: performance?.streakDays || [],
  };

  const preferredTopic = focusToday[0]
    ? `${focusToday[0].subject} - ${focusToday[0].topic}`
    : '';

  const nextAction = buildNextBestAction({
    dueMistakeCount,
    focusToday,
    strongTopics: performance?.strongTopics || [],
    streak: habit,
  });

  return {
    performance,
    recentAttempts,
    attemptsBySubject,
    weakTopicPriority: performance?.weakTopicPriority || [],
    suggestedFocusTopic: performance?.suggestedFocusTopic || '',
    accuracyTrend: performance?.accuracyTrend || 'stable',
    timeAccuracyCorrelation: performance?.timeAccuracyCorrelation || 0,
    topicHeatmap: performance?.topicStats || [],
    topicMastery: performance?.topicStats || [],
    weeklyImprovement: performance?.weeklyTrend || [],
    habit,
    focusToday,
    improvementInsight,
    nextAction: {
      ...nextAction,
      dueMistakeCount,
      query: {
        ...(nextAction.query || {}),
        topic: (nextAction.query || {}).topic || preferredTopic || undefined,
      },
    },
    mistakeBank: mistakeBank,
  };
};

module.exports = {
  getAdaptiveAnalytics,
};
