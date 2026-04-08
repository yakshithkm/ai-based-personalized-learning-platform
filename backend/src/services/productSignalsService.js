const round = (value, digits = 1) => Number(value.toFixed(digits));

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const dayDiffFromNow = (date) => {
  if (!date) return 999;
  const now = startOfDay(new Date());
  const target = startOfDay(date);
  return Math.floor((now.getTime() - target.getTime()) / (24 * 60 * 60 * 1000));
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const performanceColor = (score) => {
  if (score >= 75) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
};

const computeCoverageScore = (topicStats = []) => {
  const attemptedTopics = topicStats.filter((row) => Number(row.attempts || 0) > 0).length;
  const uniqueTopics = new Set(topicStats.map((row) => `${row.subject}::${row.topic}`)).size;
  if (!uniqueTopics) return 0;
  return round((attemptedTopics / uniqueTopics) * 100, 1);
};

const computeConsistencyScore = (streak = 0, weeklyTrend = []) => {
  const practicedDays = weeklyTrend.filter((day) => Number(day.attempts || 0) > 0).length;
  const weekScore = (practicedDays / 7) * 100;
  const streakScore = clamp(streak * 12, 0, 100);
  return round(streakScore * 0.45 + weekScore * 0.55, 1);
};

const computeExamReadiness = ({ overallAccuracy = 0, currentStreak = 0, weeklyTrend = [], topicStats = [] }) => {
  const accuracyScore = clamp(Number(overallAccuracy || 0), 0, 100);
  const consistencyScore = computeConsistencyScore(currentStreak, weeklyTrend);
  const coverageScore = computeCoverageScore(topicStats);

  const score = round(accuracyScore * 0.5 + consistencyScore * 0.3 + coverageScore * 0.2, 1);

  return {
    score,
    color: performanceColor(score),
    breakdown: {
      accuracy: round(accuracyScore, 1),
      consistency: consistencyScore,
      coverage: coverageScore,
    },
  };
};

const inferReadinessStatus = ({ examReadiness, dueMistakeCount = 0, hoursInactive = 0 }) => {
  const riskPenalty = (dueMistakeCount > 3 ? 10 : 0) + (hoursInactive >= 24 ? 12 : 0);
  const adjusted = clamp(examReadiness.score - riskPenalty, 0, 100);
  return {
    value: adjusted,
    status: performanceColor(adjusted),
  };
};

const buildTopicDropAlert = (allAttempts = []) => {
  const topicBuckets = new Map();

  allAttempts.forEach((attempt) => {
    const key = `${attempt.subject}::${attempt.topic}`;
    if (!topicBuckets.has(key)) topicBuckets.set(key, []);
    topicBuckets.get(key).push(attempt);
  });

  let fallingBehind = null;
  topicBuckets.forEach((attempts, key) => {
    if (attempts.length < 6) return;

    const ordered = [...attempts].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const split = Math.floor(ordered.length / 2);
    const oldWindow = ordered.slice(0, split);
    const recentWindow = ordered.slice(split);
    if (!oldWindow.length || !recentWindow.length) return;

    const oldAcc = (oldWindow.filter((row) => row.isCorrect).length / oldWindow.length) * 100;
    const recentAcc = (recentWindow.filter((row) => row.isCorrect).length / recentWindow.length) * 100;
    const drop = oldAcc - recentAcc;

    if (drop >= 8 && (!fallingBehind || drop > fallingBehind.drop)) {
      const [subject, topic] = key.split('::');
      fallingBehind = {
        subject,
        topic,
        drop: round(drop, 1),
      };
    }
  });

  return fallingBehind;
};

const estimatePercentile = ({ readinessScore = 0, accuracy = 0, consistency = 0 }) => {
  const blended = readinessScore * 0.55 + accuracy * 0.3 + consistency * 0.15;
  const percentile = clamp(Math.round(blended * 0.92 + 6), 1, 99);
  return percentile;
};

const rankAdvice = ({ percentile = 50, weakTopicPriority = [] }) => {
  if (percentile >= 90) {
    return 'You are near the top bracket. Maintain revision consistency to stay in top 10%.';
  }

  if (percentile >= 80) {
    return 'You are close to top 10%. Tighten speed and accuracy in your weakest topic.';
  }

  const targetTopic = weakTopicPriority[0];
  if (!targetTopic) {
    return 'To reach top 10%, increase daily volume and move to harder adaptive sessions.';
  }

  const topicLabel = targetTopic.subtopic && targetTopic.subtopic !== 'General'
    ? `${targetTopic.topic} (${targetTopic.subtopic})`
    : targetTopic.topic;
  return `To reach top 10%, improve ${topicLabel}.`;
};

const buildTransformationSummary = (allAttempts = []) => {
  const byTopic = new Map();

  allAttempts.forEach((attempt) => {
    const key = `${attempt.subject}::${attempt.topic}`;
    if (!byTopic.has(key)) byTopic.set(key, []);
    byTopic.get(key).push(attempt);
  });

  const cards = [];

  byTopic.forEach((attempts, key) => {
    if (attempts.length < 4) return;

    const ordered = [...attempts].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const split = Math.floor(ordered.length / 2);
    const before = ordered.slice(0, split);
    const now = ordered.slice(split);

    if (!before.length || !now.length) return;

    const beforeAcc = (before.filter((x) => x.isCorrect).length / before.length) * 100;
    const nowAcc = (now.filter((x) => x.isCorrect).length / now.length) * 100;
    const improvement = nowAcc - beforeAcc;

    const [subject, topic] = key.split('::');
    cards.push({
      subject,
      topic,
      beforeAccuracy: round(beforeAcc, 1),
      nowAccuracy: round(nowAcc, 1),
      delta: round(improvement, 1),
    });
  });

  cards.sort((a, b) => b.delta - a.delta);
  const mostImproved = cards.find((card) => card.delta > 0) || null;

  return {
    cards: cards.slice(0, 3),
    mostImproved,
  };
};

const buildUrgencyAlerts = ({ lastPracticeDate, weakTopicPriority = [], allAttempts = [], now = new Date() }) => {
  const alerts = [];
  const inactiveDays = dayDiffFromNow(lastPracticeDate);
  const hoursInactive = inactiveDays * 24;

  if (inactiveDays >= 1) {
    alerts.push({
      level: 'warning',
      code: 'streak-risk',
      text: 'Streak at risk: no practice in last 24 hours.',
    });
  }

  const fallingBehind = buildTopicDropAlert(allAttempts);
  if (fallingBehind) {
    alerts.push({
      level: 'danger',
      code: 'falling-behind',
      text: `Falling behind in ${fallingBehind.topic}: accuracy dropped by ${fallingBehind.drop}%.`,
    });
  }

  if (!alerts.length && weakTopicPriority.length) {
    alerts.push({
      level: 'info',
      code: 'on-track',
      text: 'You are on track. Keep momentum with one focus session today.',
    });
  }

  return {
    alerts,
    inactiveDays,
    hoursInactive,
  };
};

const buildNotifications = ({
  habit,
  dueMistakeCount = 0,
  urgency,
  weakTopicPriority = [],
  noWeakTopics = false,
  noMistakes = false,
}) => {
  const notifications = [];

  if ((habit?.remainingToday || 0) > 0) {
    notifications.push({
      type: 'daily-practice-reminder',
      tone: 'neutral',
      title: 'Daily Practice Reminder',
      text: `Complete ${habit.remainingToday} more questions to hit your daily goal.`,
    });
  }

  if (urgency.hoursInactive >= 24) {
    notifications.push({
      type: 'streak-warning',
      tone: 'warning',
      title: 'Streak Warning',
      text: 'Practice now to protect your streak.',
    });
  }

  if (dueMistakeCount > 0) {
    notifications.push({
      type: 'review-due',
      tone: 'danger',
      title: 'Review Due',
      text: `${dueMistakeCount} spaced-repetition reviews are due.`,
    });
  }

  if (noWeakTopics) {
    notifications.push({
      type: 'advance-level',
      tone: 'success',
      title: 'Advance Opportunity',
      text: 'No weak topics detected. Advance to harder level now.',
    });
  } else if (weakTopicPriority[0]) {
    notifications.push({
      type: 'focus-topic',
      tone: 'neutral',
      title: 'Smart Focus',
      text: `Your highest priority topic is ${weakTopicPriority[0].topic}.`,
    });
  }

  if (noMistakes) {
    notifications.push({
      type: 'consistency',
      tone: 'success',
      title: 'Strong Consistency',
      text: 'No unresolved mistakes right now. Keep this standard.',
    });
  }

  return notifications;
};

module.exports = {
  computeExamReadiness,
  inferReadinessStatus,
  estimatePercentile,
  rankAdvice,
  buildTransformationSummary,
  buildUrgencyAlerts,
  buildNotifications,
};
