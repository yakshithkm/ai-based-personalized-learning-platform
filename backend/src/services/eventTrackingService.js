const ProductEvent = require('../models/ProductEvent');

const VALID_EVENTS = new Set([
  'session_started',
  'question_answered',
  'session_completed',
  'next_action_clicked',
  'focus_session_started',
  'returned_next_day',
]);

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const dayKey = (date) => startOfDay(date).toISOString().slice(0, 10);

const daysBetween = (a, b) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / (24 * 60 * 60 * 1000));

const trackProductEvent = async ({ userId, eventType, metadata = {} }) => {
  if (!VALID_EVENTS.has(eventType)) {
    throw new Error('Invalid eventType');
  }

  return ProductEvent.create({
    user: userId,
    eventType,
    metadata,
  });
};

const buildDailyActivity = (events) => {
  const map = new Map();

  events.forEach((event) => {
    const key = dayKey(event.createdAt);
    if (!map.has(key)) {
      map.set(key, {
        day: key,
        users: new Set(),
      });
    }
    map.get(key).users.add(String(event.user));
  });

  return Array.from(map.values())
    .map((row) => ({ day: row.day, activeUsers: row.users.size }))
    .sort((a, b) => a.day.localeCompare(b.day));
};

const computeNextDayRetention = (events) => {
  const byUser = new Map();

  events.forEach((event) => {
    const userId = String(event.user);
    if (!byUser.has(userId)) byUser.set(userId, new Set());
    byUser.get(userId).add(dayKey(event.createdAt));
  });

  let eligible = 0;
  let retained = 0;

  byUser.forEach((daysSet) => {
    const days = Array.from(daysSet).sort();
    if (days.length < 2) return;

    for (let i = 0; i < days.length - 1; i += 1) {
      eligible += 1;
      if (daysBetween(new Date(days[i]), new Date(days[i + 1])) === 1) {
        retained += 1;
      }
    }
  });

  const rate = eligible ? (retained / eligible) * 100 : 0;
  return Number(rate.toFixed(1));
};

const sessionIdOf = (event) => String(event.metadata?.sessionId || '');

const summarizeSessions = (events) => {
  const sessions = new Map();

  events.forEach((event) => {
    const sid = sessionIdOf(event);
    if (!sid) return;

    if (!sessions.has(sid)) {
      sessions.set(sid, {
        sessionId: sid,
        startedAt: null,
        completedAt: null,
        answers: 0,
        maxQuestionIndex: 0,
        totalQuestions: Number(event.metadata?.totalQuestions || 0),
        lastEventType: '',
      });
    }

    const session = sessions.get(sid);
    session.lastEventType = event.eventType;

    if (event.eventType === 'session_started' || event.eventType === 'focus_session_started') {
      session.startedAt = session.startedAt || event.createdAt;
      session.totalQuestions = Number(event.metadata?.totalQuestions || session.totalQuestions || 0);
    }

    if (event.eventType === 'question_answered') {
      session.answers += 1;
      session.maxQuestionIndex = Math.max(session.maxQuestionIndex, Number(event.metadata?.questionIndex || 0));
      session.totalQuestions = Number(event.metadata?.totalQuestions || session.totalQuestions || 0);
    }

    if (event.eventType === 'session_completed') {
      session.completedAt = event.createdAt;
      session.totalQuestions = Number(event.metadata?.totalQuestions || session.totalQuestions || 0);
    }
  });

  const allSessions = Array.from(sessions.values());
  const startedSessions = allSessions.filter((s) => s.startedAt);
  const answeredSessions = allSessions.filter((s) => s.answers > 0);
  const completedSessions = allSessions.filter((s) => s.completedAt);

  const completionRate = startedSessions.length
    ? (completedSessions.length / startedSessions.length) * 100
    : 0;

  const avgSessionLengthSec = completedSessions.length
    ? completedSessions.reduce((sum, session) => {
      if (!session.startedAt || !session.completedAt) return sum;
      return sum + Math.max(0, Math.round((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 1000));
    }, 0) / completedSessions.length
    : 0;

  let dropAfterFirst = 0;
  let dropMidSession = 0;
  let dropAfterFeedback = 0;

  startedSessions.forEach((session) => {
    if (session.completedAt) return;

    if (session.answers <= 1) {
      dropAfterFirst += 1;
    } else {
      const expected = session.totalQuestions || session.answers;
      if (session.answers < expected) {
        dropMidSession += 1;
      }
      dropAfterFeedback += 1;
    }
  });

  return {
    totals: {
      started: startedSessions.length,
      answered: answeredSessions.length,
      completed: completedSessions.length,
    },
    sessionCompletionRate: Number(completionRate.toFixed(1)),
    averageSessionLengthSec: Number(avgSessionLengthSec.toFixed(1)),
    dropOff: {
      afterFirstQuestion: dropAfterFirst,
      midSession: dropMidSession,
      afterFeedback: dropAfterFeedback,
    },
  };
};

const computeSkippedFeatures = (events) => {
  const features = ['next_action', 'focus_session', 'continue_smart_practice'];
  const clicks = new Map(features.map((feature) => [feature, 0]));

  events
    .filter((event) => event.eventType === 'next_action_clicked')
    .forEach((event) => {
      const cta = String(event.metadata?.cta || '').trim();
      if (clicks.has(cta)) {
        clicks.set(cta, clicks.get(cta) + 1);
      }
    });

  const maxClicks = Math.max(...Array.from(clicks.values()), 0);

  return Array.from(clicks.entries())
    .map(([feature, count]) => ({
      feature,
      clicks: count,
      skippedEstimate: Math.max(maxClicks - count, 0),
    }))
    .sort((a, b) => b.skippedEstimate - a.skippedEstimate)
    .slice(0, 3);
};

const getAdminBehaviorSummary = async ({ days = 14 } = {}) => {
  const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
  const events = await ProductEvent.find({ createdAt: { $gte: since } })
    .select('user eventType metadata createdAt')
    .sort({ createdAt: 1 })
    .lean();

  const dailyActivity = buildDailyActivity(events);
  const sessions = summarizeSessions(events);
  const dauToday = dailyActivity.length ? dailyActivity[dailyActivity.length - 1].activeUsers : 0;
  const dauAvg7 = dailyActivity.length
    ? dailyActivity.slice(-7).reduce((sum, day) => sum + day.activeUsers, 0) /
      Math.max(1, Math.min(7, dailyActivity.length))
    : 0;

  const nextDayRetention = computeNextDayRetention(events);

  return {
    windowDays: Number(days),
    eventsTracked: events.length,
    retention: {
      dauToday,
      dauAvg7: Number(dauAvg7.toFixed(1)),
      nextDayRetention,
    },
    sessions,
    funnel: {
      started: sessions.totals.started,
      answered: sessions.totals.answered,
      completed: sessions.totals.completed,
    },
    mostSkippedFeatures: computeSkippedFeatures(events),
    dailyActivity,
  };
};

const getUserLastEvent = async (userId) => {
  return ProductEvent.findOne({ user: userId }).sort({ createdAt: -1 }).select('createdAt').lean();
};

module.exports = {
  trackProductEvent,
  getAdminBehaviorSummary,
  getUserLastEvent,
  dayKey,
};
