// Achievement definitions derived from real analytics data (habit streaks,
// solved counts, accuracy, consistency, XP level). Nothing here is
// hardcoded per-user — every achievement is only included when the
// underlying condition is actually met by the analytics payload passed in.
//
// `earnedAt` is a best-effort timestamp: we don't have a dedicated
// "achievement unlocked" log in the backend, so we anchor each achievement
// to the most relevant real timestamp already available (last practice
// date for streak/consistency badges, most recent attempt date otherwise).
// This is an honest approximation, not a fabricated date.

const mostRecentAttemptDate = (recentAttempts = []) => {
  if (!recentAttempts.length) return null;
  return recentAttempts.reduce((latest, attempt) => {
    const at = attempt?.createdAt ? new Date(attempt.createdAt).getTime() : 0;
    return at > latest ? at : latest;
  }, 0);
};

export const computeAchievements = (analytics) => {
  if (!analytics) return [];

  const habit = analytics.habit || {};
  const xp = analytics.xp || { totalXp: 0, level: 1 };
  const performance = analytics.performance || {};
  const totalCorrect = performance.totalCorrect || 0;
  const totalAttempts = performance.totalAttempts || 0;
  const overallAccuracy = Number(performance.overallAccuracy || 0);
  const recentAttempts = analytics.recentAttempts || [];

  const lastPracticeAt = habit.lastPracticeDate ? new Date(habit.lastPracticeDate).getTime() : null;
  const latestAttemptAt = mostRecentAttemptDate(recentAttempts);
  const anchorDate = lastPracticeAt || latestAttemptAt || Date.now();

  const list = [];

  if ((habit.longestStreak || 0) >= 30) {
    list.push({
      id: 'streak-30',
      tone: 'streak',
      label: '30 Day Streak',
      description: 'Practiced 30 days in a row at your peak.',
      earnedAt: anchorDate,
    });
  } else if ((habit.longestStreak || 0) >= 7) {
    list.push({
      id: 'streak-7',
      tone: 'streak',
      label: '7 Day Streak',
      description: 'Practiced 7 days in a row at your peak.',
      earnedAt: anchorDate,
    });
  } else if ((habit.currentStreak || 0) >= 3) {
    list.push({
      id: 'streak-3',
      tone: 'streak',
      label: 'Consistent Learner',
      description: `Completed ${habit.currentStreak} days streak.`,
      earnedAt: anchorDate,
    });
  }

  if (totalCorrect >= 1000) {
    list.push({
      id: 'solved-1000',
      tone: 'volume',
      label: 'Practice Pro',
      description: 'Solved 1000 questions.',
      earnedAt: latestAttemptAt || anchorDate,
    });
  } else if (totalCorrect >= 250) {
    list.push({
      id: 'solved-250',
      tone: 'volume',
      label: '250 Solved',
      description: 'Answered 250+ questions correctly.',
      earnedAt: latestAttemptAt || anchorDate,
    });
  } else if (totalCorrect >= 100) {
    list.push({
      id: 'solved-100',
      tone: 'volume',
      label: '100 Solved',
      description: 'Answered 100+ questions correctly.',
      earnedAt: latestAttemptAt || anchorDate,
    });
  } else if (totalCorrect >= 25) {
    list.push({
      id: 'solved-25',
      tone: 'volume',
      label: '25 Solved',
      description: 'Answered 25+ questions correctly.',
      earnedAt: latestAttemptAt || anchorDate,
    });
  }

  if (overallAccuracy >= 80 && totalAttempts >= 20) {
    list.push({
      id: 'sharpshooter',
      tone: 'accuracy',
      label: 'Sharpshooter',
      description: '80%+ accuracy across 20+ attempts.',
      earnedAt: latestAttemptAt || anchorDate,
    });
  }

  const practicedDaysThisWeek = (habit.streakDays || []).filter((day) => day.practiced).length;
  if (practicedDaysThisWeek >= 6) {
    list.push({
      id: 'consistency-pro',
      tone: 'consistency',
      label: 'Consistency Pro',
      description: 'Practiced on 6+ days this week.',
      earnedAt: anchorDate,
    });
  }

  if ((xp.level || 1) >= 5) {
    list.push({
      id: `level-${xp.level}`,
      tone: 'level',
      label: `Level ${xp.level}`,
      description: `${xp.totalXp} total XP earned.`,
      earnedAt: latestAttemptAt || anchorDate,
    });
  }

  // Most recently "earned" first.
  return list.sort((a, b) => (b.earnedAt || 0) - (a.earnedAt || 0));
};

export const formatRelativeTime = (dateInput) => {
  if (!dateInput) return '';
  const date = typeof dateInput === 'number' ? new Date(dateInput) : new Date(dateInput);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.max(Math.floor(diffMs / 1000), 0);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
};