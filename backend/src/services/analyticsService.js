const Attempt = require('../models/Attempt');
const Mistake = require('../models/Mistake');
const { rebuildPerformanceForUser } = require('./performanceService');
const { getMistakeBankForUser } = require('./progressTracker');
const {
  computeExamReadiness,
  inferReadinessStatus,
  estimatePercentile,
  rankAdvice,
  buildTransformationSummary,
  buildUrgencyAlerts,
  buildNotifications,
} = require('./productSignalsService');

const round = (value, digits = 1) => Number(value.toFixed(digits));
const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const average = (list = []) => {
  if (!list.length) return 0;
  return list.reduce((sum, value) => sum + Number(value || 0), 0) / list.length;
};

const stdDev = (list = []) => {
  if (!list.length) return 0;
  const mean = average(list);
  const variance = average(list.map((value) => (Number(value || 0) - mean) ** 2));
  return Math.sqrt(variance);
};

const accuracyPct = (attempts = []) => {
  if (!attempts.length) return 0;
  return (attempts.filter((entry) => entry.isCorrect).length / attempts.length) * 100;
};

const splitByWindow = (attempts = [], now = Date.now(), days = 7) => {
  const recentStart = now - days * DAY_MS;
  const previousStart = now - 2 * days * DAY_MS;

  const recent = attempts.filter((entry) => new Date(entry.createdAt).getTime() >= recentStart);
  const previous = attempts.filter((entry) => {
    const ts = new Date(entry.createdAt).getTime();
    return ts >= previousStart && ts < recentStart;
  });

  return { recent, previous };
};

const computeWeeklySubjectDeltas = (attempts = [], now = Date.now()) => {
  const subjects = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
  return subjects
    .map((subject) => {
      const subjectAttempts = attempts.filter((entry) => entry.subject === subject);
      const { recent, previous } = splitByWindow(subjectAttempts, now, 7);
      const recentAcc = accuracyPct(recent);
      const previousAcc = accuracyPct(previous);
      const delta = recentAcc - previousAcc;
      const stableStrong = recentAcc >= 70 && previousAcc >= 70 && recent.length >= 4;
      return {
        subject,
        recentAcc,
        previousAcc,
        delta,
        stableStrong,
        recentCount: recent.length,
      };
    })
    .filter((row) => row.recentCount > 0 || row.previousAcc > 0);
};

const buildWeeklyPerformanceReport = (attempts = [], now = Date.now()) => {
  const deltas = computeWeeklySubjectDeltas(attempts, now);
  const strongestRise = [...deltas].sort((a, b) => b.delta - a.delta)[0];
  const steepestDrop = [...deltas].sort((a, b) => a.delta - b.delta)[0];
  const strongStable = deltas.filter((row) => row.stableStrong).map((row) => row.subject);

  const highlights = [];

  if (strongestRise && strongestRise.delta >= 2) {
    highlights.push(`You are improving in ${strongestRise.subject}, but your accuracy is still unreliable — this suggests shallow understanding, not mastery.`);
  }

  if (steepestDrop && steepestDrop.delta <= -2) {
    highlights.push(`Your ${steepestDrop.subject} accuracy dropped by ${Math.abs(round(steepestDrop.delta, 0))}% this week. That is a liability, not a fluctuation.`);
  }

  if (strongStable.length) {
    highlights.push(`You are consistently strong in ${strongStable.join(' and ')}, which means your execution there is disciplined.`);
  }

  if (!highlights.length) {
    highlights.push('Your weekly trend is flat. That usually means you are working, but not extracting enough correction from mistakes.');
  }

  return {
    summary: highlights,
    subjectDeltas: deltas.map((row) => ({
      subject: row.subject,
      previousAccuracy: round(row.previousAcc),
      currentAccuracy: round(row.recentAcc),
      delta: round(row.delta),
    })),
  };
};

const buildStudyStrategyRecommendation = (attempts = [], now = Date.now()) => {
  const last14 = attempts.filter((entry) => new Date(entry.createdAt).getTime() >= now - 14 * DAY_MS);
  const bySubject = last14.reduce((acc, entry) => {
    if (!acc[entry.subject]) {
      acc[entry.subject] = { subject: entry.subject, total: 0, correct: 0, wrong: 0, avgTimeSec: 0 };
    }
    const ref = acc[entry.subject];
    ref.total += 1;
    if (entry.isCorrect) ref.correct += 1;
    else ref.wrong += 1;
    ref.avgTimeSec += Number(entry.timeTakenSec || 0);
    return acc;
  }, {});

  const rows = Object.values(bySubject).map((row) => {
    const acc = row.total ? (row.correct / row.total) * 100 : 0;
    const avgTimeSec = row.total ? row.avgTimeSec / row.total : 0;
    const weight = clamp((100 - acc) + row.wrong * 1.5 + (avgTimeSec > 80 ? 8 : 0), 5, 160);
    return {
      subject: row.subject,
      accuracy: acc,
      total: row.total,
      wrong: row.wrong,
      avgTimeSec,
      weight,
    };
  });

  const sorted = rows.sort((a, b) => b.weight - a.weight);
  const totalWeight = Math.max(sorted.reduce((sum, row) => sum + row.weight, 0), 1);

  const timeAllocation = sorted.map((row) => ({
    subject: row.subject,
    percent: Math.max(10, round((row.weight / totalWeight) * 100, 0)),
    reason:
      row.accuracy < 55
        ? 'accuracy needs repair'
        : row.avgTimeSec > 85
          ? 'speed and decision control needed'
          : 'maintain momentum with moderate revision',
  }));

  const capped = timeAllocation
    .sort((a, b) => b.percent - a.percent)
    .map((entry, index) => ({
      ...entry,
      percent: index === 0 ? Math.min(entry.percent, 60) : entry.percent,
    }));

  const adjustedTotal = capped.reduce((sum, entry) => sum + entry.percent, 0);
  const normalized = capped.map((entry, index) => {
    if (index === 0) {
      return {
        ...entry,
        percent: Math.max(10, entry.percent + (100 - adjustedTotal)),
      };
    }
    return entry;
  });

  return {
    subjectPriorityOrder: normalized.map((row) => row.subject),
    timeAllocation,
    dailyStudyPlan: [
      {
        slot: 'Session 1 (60 min)',
        task: `${normalized[0]?.subject || 'Weakest Subject'} concept drill + 15 timed MCQs`,
      },
      {
        slot: 'Session 2 (45 min)',
        task: `${normalized[1]?.subject || 'Second Priority'} mixed practice + error log review`,
      },
      {
        slot: 'Session 3 (30 min)',
        task: `${normalized[2]?.subject || 'Strong Subject'} retention revision and quick recap`,
      },
    ],
    guidanceText: normalized.length
      ? `Decision for this week: spend ${normalized.map((entry) => `${entry.percent}% on ${entry.subject}`).join(', ')}.`
      : 'Collect at least one week of attempts for a personalized study strategy.',
  };
};

const buildBehaviorAnalysis = (attempts = [], now = Date.now()) => {
  const last14 = attempts.filter((entry) => new Date(entry.createdAt).getTime() >= now - 14 * DAY_MS);
  const bySubject = last14.reduce((acc, entry) => {
    if (!acc[entry.subject]) acc[entry.subject] = [];
    acc[entry.subject].push(entry);
    return acc;
  }, {});

  const insights = [];
  Object.entries(bySubject).forEach(([subject, rows]) => {
    const rushingWrong = rows.filter((row) => !row.isCorrect && Number(row.timeTakenSec || 0) < 0.75 * Number(row.expectedSolvingTimeSec || 60)).length;
    const overthinkingWrong = rows.filter((row) => !row.isCorrect && Number(row.timeTakenSec || 0) > 1.3 * Number(row.expectedSolvingTimeSec || 60)).length;
    const guessing = rows.filter((row) => !row.isCorrect && Number(row.timeTakenSec || 0) < 0.5 * Number(row.expectedSolvingTimeSec || 60)).length;

    if (rushingWrong >= 3) {
      insights.push({
        type: 'rushing',
        subject,
        message: `You are rushing through ${subject} questions, and that speed is converting into avoidable mistakes.`,
      });
    }

    if (overthinkingWrong >= 3) {
      insights.push({
        type: 'overthinking',
        subject,
        message: `You spend too long on difficult ${subject} problems and still lose marks; cap decision time and move on earlier.`,
      });
    }

    if (guessing >= 3) {
      insights.push({
        type: 'guessing',
        subject,
        message: `Your ${subject} pattern shows quick guesses under pressure. Pause for one elimination step before locking answers.`,
      });
    }
  });

  return {
    patterns: insights,
    summary:
      insights[0]?.message ||
      'Your pace and accuracy pattern is balanced right now. Maintain this rhythm and keep logging mistakes.',
  };
};

const buildConsistencyScore = ({ attempts = [], topicStats = [], now = Date.now() }) => {
  const last14 = attempts.filter((entry) => new Date(entry.createdAt).getTime() >= now - 14 * DAY_MS);
  const activeDaySet = new Set(last14.map((entry) => new Date(entry.createdAt).toISOString().slice(0, 10)));
  const usageScore = clamp((activeDaySet.size / 14) * 100, 0, 100);

  const byDay = last14.reduce((acc, entry) => {
    const dayKey = new Date(entry.createdAt).toISOString().slice(0, 10);
    if (!acc[dayKey]) acc[dayKey] = [];
    acc[dayKey].push(entry);
    return acc;
  }, {});

  const dailyAccuracies = Object.values(byDay).map((rows) => accuracyPct(rows) / 100);
  const accStd = stdDev(dailyAccuracies);
  const accuracyStability = clamp(100 - accStd * 120, 0, 100);

  const coveredTopics = new Set(last14.map((entry) => `${entry.subject}::${entry.topic}`)).size;
  const baselineTopics = Math.max(topicStats.length || 1, 1);
  const topicCoverage = clamp((coveredTopics / Math.min(12, baselineTopics + 4)) * 100, 0, 100);

  const score = round(usageScore * 0.4 + accuracyStability * 0.35 + topicCoverage * 0.25, 1);

  return {
    score,
    components: {
      usageScore: round(usageScore),
      accuracyStability: round(accuracyStability),
      topicCoverage: round(topicCoverage),
    },
  };
};

const buildImprovementTrajectory = ({ attempts = [], consistencyScore, now = Date.now() }) => {
  const last14 = attempts.filter((entry) => new Date(entry.createdAt).getTime() >= now - 14 * DAY_MS);
  const previous14 = attempts.filter((entry) => {
    const ts = new Date(entry.createdAt).getTime();
    return ts >= now - 28 * DAY_MS && ts < now - 14 * DAY_MS;
  });

  const currentAcc = accuracyPct(last14) / 100;
  const previousAcc = accuracyPct(previous14) / 100;
  const dailySlope = (currentAcc - previousAcc) / 14;
  const projectedAcc = clamp(currentAcc + dailySlope * 30, 0.2, 0.95);
  const confidenceBoost = consistencyScore >= 70 ? 1.02 : consistencyScore <= 40 ? 0.96 : 1;
  const projectedAccAdjusted = clamp(projectedAcc * confidenceBoost, 0.2, 0.96);

  const expectedScore30Days = round((5 * projectedAccAdjusted - 1) * 180, 0);

  return {
    currentAccuracy: round(currentAcc * 100),
    projectedAccuracy30Days: round(projectedAccAdjusted * 100),
    expectedScore30Days,
    message: `If you continue this trend, your expected score in 30 days is ${expectedScore30Days}.`,
  };
};

const buildMentorJudgmentSystem = ({
  attempts = [],
  weeklyReport,
  studyStrategy,
  behaviorAnalysis,
  consistencyScore,
  mistakeBank,
  now = Date.now(),
}) => {
  const last14 = attempts.filter((entry) => new Date(entry.createdAt).getTime() >= now - 14 * DAY_MS);
  const subjectRows = ['Physics', 'Chemistry', 'Mathematics', 'Biology']
    .map((subject) => {
      const subjectAttempts = last14.filter((entry) => entry.subject === subject);
      const accuracy = accuracyPct(subjectAttempts);
      const avgTimeSec = average(subjectAttempts.map((entry) => Number(entry.timeTakenSec || 0)));
      const expectedTimeSec = average(subjectAttempts.map((entry) => Number(entry.expectedSolvingTimeSec || 60)));
      const wrongCount = subjectAttempts.filter((entry) => !entry.isCorrect).length;
      return {
        subject,
        accuracy,
        avgTimeSec,
        expectedTimeSec,
        wrongCount,
        count: subjectAttempts.length,
      };
    })
    .filter((row) => row.count > 0);

  const criticalWeaknesses = subjectRows.filter((row) => row.accuracy > 0 && row.accuracy < 55);
  const liabilities = criticalWeaknesses.map(
    (row) => `${row.subject} is currently a liability in your exam performance.`
  );

  const repeatedPatternMap = new Map();
  last14.forEach((attempt) => {
    const key = `${attempt.subject}::${attempt.topic}::${attempt.subtopic || 'General'}`;
    if (!repeatedPatternMap.has(key)) {
      repeatedPatternMap.set(key, { subject: attempt.subject, topic: attempt.topic, subtopic: attempt.subtopic || 'General', count: 0, wrong: 0 });
    }
    const row = repeatedPatternMap.get(key);
    row.count += 1;
    if (!attempt.isCorrect) row.wrong += 1;
  });

  const bankMistakePatterns = Array.isArray(mistakeBank?.repeatedMistakes)
    ? mistakeBank.repeatedMistakes.map((entry) => ({
        subject: entry.subject || 'General',
        topic: entry.topic || entry.concept || 'General',
        subtopic: entry.subtopic || 'General',
        message: `You are repeating the same mistake pattern in ${entry.topic || entry.concept || 'this topic'}. Practicing more without fixing the concept will not help.`,
      }))
    : [];

  const repeatedMistakePatterns = Array.from(repeatedPatternMap.values())
    .filter((row) => row.count >= 3 && row.wrong >= 2)
    .sort((a, b) => b.wrong - a.wrong || b.count - a.count)
    .slice(0, 3)
    .map((row) => ({
      subject: row.subject,
      topic: row.topic,
      subtopic: row.subtopic,
      message: `You are repeating the same mistake pattern in ${row.topic}. Practicing more without fixing the concept will not help.`,
    }));

  const critiquePool = repeatedMistakePatterns.length ? repeatedMistakePatterns : bankMistakePatterns;

  const effortVsResult = subjectRows.map((row) => {
    const timeRatio = row.expectedTimeSec ? row.avgTimeSec / row.expectedTimeSec : 1;
    let judgment = 'balanced';
    let message = `${row.subject} is steady: effort and accuracy are in acceptable balance.`;

    if (row.accuracy < 55 && timeRatio > 1.15) {
      judgment = 'inefficient';
      message = `You are spending too much time on ${row.subject} without results — this indicates inefficient problem-solving.`;
    } else if (row.accuracy < 55 && timeRatio < 0.85) {
      judgment = 'rushing';
      message = `You are rushing ${row.subject} and compromising accuracy.`;
    } else if (row.accuracy >= 70 && timeRatio <= 1.1) {
      judgment = 'strong';
      message = `${row.subject} shows controlled execution and dependable accuracy.`;
    }

    return {
      subject: row.subject,
      accuracy: round(row.accuracy),
      avgTimeSec: round(row.avgTimeSec),
      expectedTimeSec: round(row.expectedTimeSec),
      timeRatio: round(timeRatio, 2),
      judgment,
      message,
    };
  });

  const focusSubject = [...subjectRows]
    .sort((a, b) => a.accuracy - b.accuracy || b.wrongCount - a.wrongCount)[0];

  const decisionGuidance = focusSubject
    ? `Stop practicing new topics. Focus only on correcting ${focusSubject.subject} for the next 3 days.`
    : 'Stop spreading attention thinly. Lock onto one weakness and repair it before adding new material.';

  const analyticalInsight = weeklyReport.summary[0]
    ? weeklyReport.summary[0].replace('You improved', 'You are improving').replace('this week.', 'this week, but your accuracy is still unreliable — this suggests shallow understanding, not mastery.')
    : 'Your trend is changing, but not in a way that yet proves mastery.';

  const strictInsight = criticalWeaknesses[0]
    ? `${criticalWeaknesses[0].subject} is currently a liability in your exam performance. You do not need more volume; you need correction.`
    : 'Your current effort is not yet translating into stable marks. That is a correction problem, not a practice problem.';

  const encouragingInsight = subjectRows.some((row) => row.accuracy >= 70)
    ? `${subjectRows.find((row) => row.accuracy >= 70).subject} is becoming dependable. Keep the same method, because the consistency is finally showing.`
    : 'You can recover this profile if you stop guessing and start fixing one concept at a time.';

  const harshCritique = critiquePool[0]
    ? critiquePool[0].message
    : criticalWeaknesses[0]
      ? `${criticalWeaknesses[0].subject} is currently a liability in your exam performance.`
      : 'Practicing harder without correcting the underlying concept will keep producing the same score.';

  const balancedFeedback = focusSubject
    ? `You are improving in ${focusSubject.subject}, but your accuracy is still unreliable — this suggests shallow understanding, not mastery.`
    : 'Your progress is real, but it is not yet dependable enough to change your strategy.';

  return {
    priorityWarnings: liabilities,
    repeatedPatternCritique: repeatedMistakePatterns,
    effortVsResult,
    decisionGuidance,
    sampleInsights: [
      {
        tone: 'analytical',
        text: analyticalInsight,
      },
      {
        tone: 'strict',
        text: strictInsight,
      },
      {
        tone: 'encouraging',
        text: encouragingInsight,
      },
    ],
    harshCritique,
    balancedFeedback,
    toneSummary: {
      analytical: 'Evidence-based evaluation of change and stability.',
      strict: 'Direct correction when performance is becoming a liability.',
      encouraging: 'Supportive only when progress is observable and repeatable.',
    },
    mentorJudgmentNarrative: [
      analyticalInsight,
      strictInsight,
      balancedFeedback,
      decisionGuidance,
    ],
  };
};

const buildStudentInsightLayer = ({ attempts = [], topicStats = [], mistakeBank = null, now = Date.now() }) => {
  const weeklyReport = buildWeeklyPerformanceReport(attempts, now);
  const studyStrategy = buildStudyStrategyRecommendation(attempts, now);
  const behaviorAnalysis = buildBehaviorAnalysis(attempts, now);
  const consistency = buildConsistencyScore({ attempts, topicStats, now });
  const trajectory = buildImprovementTrajectory({
    attempts,
    consistencyScore: consistency.score,
    now,
  });
  const mentorJudgmentSystem = buildMentorJudgmentSystem({
    attempts,
    weeklyReport,
    studyStrategy,
    behaviorAnalysis,
    consistencyScore: consistency.score,
    mistakeBank,
    now,
  });

  return {
    weeklyPerformanceReport: weeklyReport,
    studyStrategy,
    behaviorAnalysis,
    consistencyScore: consistency,
    improvementTrajectory: trajectory,
    mentorJudgmentSystem,
    mentorVoice: [
      ...weeklyReport.summary.slice(0, 2),
      behaviorAnalysis.summary,
      trajectory.message,
      mentorJudgmentSystem.decisionGuidance,
    ].slice(0, 4),
  };
};

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

const pointsForAttempt = ({ isCorrect, timeTakenSec }) => {
  const base = isCorrect ? 12 : 5;
  const speedBonus = isCorrect && Number(timeTakenSec || 0) <= 35 ? 3 : 0;
  return base + speedBonus;
};

const calculateXpSummary = (attempts = []) => {
  const totalXp = attempts.reduce((sum, attempt) => sum + pointsForAttempt(attempt), 0);
  const weeklyXp = attempts
    .filter((attempt) => Date.now() - new Date(attempt.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000)
    .reduce((sum, attempt) => sum + pointsForAttempt(attempt), 0);

  return {
    totalXp,
    weeklyXp,
    level: Math.floor(totalXp / 250) + 1,
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
  const totalAttempts = (allAttempts || []).length;
  const lowDataMode = totalAttempts < 5;
  const focusToday = (performance?.weakTopicPriority || []).slice(0, 2);
  const focusConcepts = (performance?.weakConceptPriority || []).slice(0, 3);
  const improvementInsight = buildImprovementInsight(allAttempts || []);
  const transformation = buildTransformationSummary(allAttempts || []);
  const habit = {
    dailyGoal: performance?.dailyGoal || 10,
    todayCompleted: performance?.todayCompleted || 0,
    remainingToday: Math.max((performance?.dailyGoal || 10) - (performance?.todayCompleted || 0), 0),
    currentStreak: performance?.currentStreak || 0,
    longestStreak: performance?.longestStreak || 0,
    streakDays: performance?.streakDays || [],
  };

  const examReadiness = computeExamReadiness({
    overallAccuracy: performance?.overallAccuracy || 0,
    currentStreak: performance?.currentStreak || 0,
    weeklyTrend: performance?.weeklyTrend || [],
    topicStats: performance?.topicStats || [],
  });

  const urgency = buildUrgencyAlerts({
    lastPracticeDate: performance?.lastPracticeDate,
    weakTopicPriority: performance?.weakTopicPriority || [],
    allAttempts,
  });

  const readiness = lowDataMode
    ? {
      value: Math.round(examReadiness.score || 0),
      status: 'insufficient-data',
    }
    : inferReadinessStatus({
    examReadiness,
    dueMistakeCount,
    hoursInactive: urgency.hoursInactive,
  });

  const percentile = lowDataMode ? null : estimatePercentile({
    readinessScore: examReadiness.score,
    accuracy: performance?.overallAccuracy || 0,
    consistency: examReadiness.breakdown.consistency,
  });

  const benchmark = lowDataMode
    ? {
      percentile: null,
      aheadOf: null,
      estimated: false,
      message: 'Early profile: insufficient data to estimate your standing. Complete a few more attempts for reliable benchmarking.',
      top10Advice: 'Build a data baseline first: complete 5-10 mixed attempts before ranking advice is shown.',
    }
    : {
      percentile,
      aheadOf: percentile,
      estimated: true,
      message: `You are ahead of ${percentile}% of students.`,
      top10Advice: rankAdvice({
        percentile,
        weakTopicPriority: performance?.weakTopicPriority || [],
      }),
    };

  const noWeakTopics = !(performance?.weakTopicPriority || []).length;
  const noMistakes = dueMistakeCount === 0 && !(mistakeBank?.repeatedMistakes || []).length;

  const notifications = buildNotifications({
    habit,
    dueMistakeCount,
    urgency,
    weakTopicPriority: performance?.weakTopicPriority || [],
    noWeakTopics,
    noMistakes,
  });

  const xp = calculateXpSummary(allAttempts || []);

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
    conceptMastery: performance?.conceptStats || [],
    weakConceptPriority: performance?.weakConceptPriority || [],
    habit,
    focusToday,
    focusConcepts,
    improvementInsight,
    transformation,
    urgency,
    readiness,
    examReadiness,
    benchmark,
    notifications,
    xp,
    emptyStateGuidance: {
      noWeakTopics,
      noMistakes,
      lowDataMode,
      uncertaintyMessage: lowDataMode
        ? 'We need more data before making strong claims about your strengths.'
        : '',
      weakTopicMessage: noWeakTopics
        ? 'No weak topics detected. Advance to harder level.'
        : '',
      mistakeMessage: noMistakes ? 'Strong consistency. No pending mistakes now.' : '',
    },
    nextAction: {
      ...nextAction,
      dueMistakeCount,
      query: {
        ...(nextAction.query || {}),
        topic: (nextAction.query || {}).topic || preferredTopic || undefined,
      },
    },
    mistakeBank: mistakeBank,
    studentInsightLayer: buildStudentInsightLayer({
      attempts: allAttempts || [],
      topicStats: performance?.topicStats || [],
      mistakeBank,
      now: Date.now(),
    }),
  };
};

module.exports = {
  getAdaptiveAnalytics,
};
