const User = require('../src/models/User');
const Question = require('../src/models/Question');
const Attempt = require('../src/models/Attempt');
const Mistake = require('../src/models/Mistake');
const Performance = require('../src/models/Performance');
const ExamSession = require('../src/models/ExamSession');
const ProductEvent = require('../src/models/ProductEvent');
const { rebuildPerformanceForUser } = require('../src/services/performanceService');
const { classifyMistake } = require('../src/services/feedbackService');
const { DEMO_PROFILES } = require('../src/data/demoProfiles');

const DAY_MS = 24 * 60 * 60 * 1000;
const REPETITION_DAYS = [1, 3, 7];

// --- deterministic PRNG -----------------------------------------------
// Seeded from the demo account's email so re-running the seed script
// produces the same statistical shape of data every time (same rough
// streaks, same rough accuracy split) even though the actual calendar
// dates shift forward with "today".
function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

// --- cleanup -------------------------------------------------------------

/**
 * Removes a demo user and every record that belongs to them. Refuses to
 * touch the email if an account already exists there and is NOT flagged
 * isDemo, so a real user can never be clobbered by a reseed.
 */
const cleanupDemoUser = async (email) => {
  const existing = await User.findOne({ email });
  if (!existing) return null;

  if (!existing.isDemo) {
    throw new Error(
      `Refusing to touch "${email}": an account already exists at this address and is not ` +
        'marked as a demo account. Free up this email or change the demo credentials before seeding.'
    );
  }

  const userId = existing._id;
  await Promise.all([
    Attempt.deleteMany({ user: userId }),
    Mistake.deleteMany({ user: userId }),
    Performance.deleteMany({ user: userId }),
    ExamSession.deleteMany({ user: userId }),
    ProductEvent.deleteMany({ user: userId }),
  ]);
  await User.deleteOne({ _id: userId });
  return userId;
};

const resetDemoAccounts = async () => {
  const results = [];
  for (const profile of DEMO_PROFILES) {
    // eslint-disable-next-line no-await-in-loop
    const removedId = await cleanupDemoUser(profile.email);
    results.push({ email: profile.email, removed: Boolean(removedId) });
  }
  return results;
};

// --- activity calendar ---------------------------------------------------

/**
 * Builds a list of { daysAgo, attempts } entries: a solid recent streak
 * (so the streak pill / heatmap look alive right now) plus sparse, gappy
 * activity further back (so it reads as a real student's history rather
 * than a suspiciously uniform block of daily practice for a month).
 */
const buildActivityCalendar = (rand, { totalDays = 34, recentStreakDays = 8 }) => {
  const days = [];
  for (let daysAgo = totalDays - 1; daysAgo >= 0; daysAgo -= 1) {
    if (daysAgo < recentStreakDays) {
      days.push({ daysAgo, attempts: 10 + Math.floor(rand() * 15) });
      continue;
    }
    if (rand() < 0.55) {
      days.push({ daysAgo, attempts: 3 + Math.floor(rand() * 13) });
    }
  }
  return days;
};

// --- question pools --------------------------------------------------------

const loadQuestionPools = async (examType, subjects) => {
  const pools = {};
  await Promise.all(
    subjects.map(async (subject) => {
      const docs = await Question.find({ examType, subject }).lean();
      pools[subject] = docs;
    })
  );
  return pools;
};

// --- attempt event generation ---------------------------------------------

const responsePaceFor = (timeTakenSec, expectedTimeSec) => {
  if (timeTakenSec <= expectedTimeSec * 0.8) return 'fast';
  if (timeTakenSec > expectedTimeSec * 1.2) return 'slow';
  return 'on-time';
};

const buildEventsForUser = ({ rand, profile, questionsBySubject, calendar, now }) => {
  const subjects = Object.keys(profile.subjectProfile);
  const events = [];

  calendar.forEach(({ daysAgo, attempts }) => {
    const dayBase = new Date(now.getTime() - daysAgo * DAY_MS);
    let cursorMinutes = 6 * 60 + Math.floor(rand() * 120); // start ~6am-8am

    // Recency nudges accuracy upward a little (a believable "improving"
    // arc) - bounded so it never drifts into unrealistic near-100% territory.
    const recencyBoost = clamp((34 - daysAgo) / 34, 0, 1) * 8 - 3;

    for (let i = 0; i < attempts; i += 1) {
      const subjectRoll = rand();
      let cumulative = 0;
      let subject = subjects[subjects.length - 1];
      for (let s = 0; s < subjects.length; s += 1) {
        cumulative += profile.subjectProfile[subjects[s]].weight;
        if (subjectRoll <= cumulative) {
          subject = subjects[s];
          break;
        }
      }

      const pool = questionsBySubject[subject] || [];
      if (!pool.length) continue;
      const question = pick(rand, pool);

      const topicJitter = (rand() - 0.5) * 16;
      const targetAccuracy = clamp(
        profile.subjectProfile[subject].baseAccuracy + topicJitter + recencyBoost,
        18,
        94
      );
      const isCorrect = rand() * 100 < targetAccuracy;

      const expectedTimeSec = Number(question.solvingTimeEstimate || 60);
      const paceRoll = rand();
      let factor;
      if (paceRoll < 0.25) factor = 0.5 + rand() * 0.3; // fast
      else if (paceRoll < 0.8) factor = 0.85 + rand() * 0.3; // on-time
      else factor = 1.25 + rand() * 0.45; // slow
      const timeTakenSec = Math.max(5, Math.round(expectedTimeSec * factor));

      let selectedAnswerIndex = question.correctAnswerIndex;
      if (!isCorrect) {
        const others = [0, 1, 2, 3].filter((idx) => idx !== question.correctAnswerIndex);
        selectedAnswerIndex = pick(rand, others);
      }

      cursorMinutes += 2 + Math.floor(rand() * 5);
      const createdAt = new Date(
        dayBase.getFullYear(),
        dayBase.getMonth(),
        dayBase.getDate(),
        Math.floor(cursorMinutes / 60) % 24,
        cursorMinutes % 60,
        Math.floor(rand() * 60)
      );

      events.push({
        question,
        subject,
        topic: question.topic,
        subtopic: question.subtopic || question.topic || 'General',
        conceptTested: question.conceptTested || `${question.topic} Core Concept`,
        difficulty: question.difficulty,
        isCorrect,
        selectedAnswerIndex,
        selectedAnswerText: (question.options || [])[selectedAnswerIndex] || '',
        timeTakenSec,
        expectedTimeSec,
        createdAt,
      });
    }
  });

  events.sort((a, b) => a.createdAt - b.createdAt);
  return events;
};

// --- mistake-bank replay ---------------------------------------------------

/**
 * Replays the same rules attemptController + progressTracker apply on every
 * live wrong/right answer (reusing the real classifyMistake function), but
 * driven by our backdated event timestamps instead of "now" - so Mistake
 * Bank entries land on the same day as the attempt that caused them and
 * retries/resolutions follow the real spaced-repetition stages.
 */
const buildMistakesFromEvents = (userId, events) => {
  const byQuestion = new Map();
  const all = [];

  events.forEach((evt) => {
    const qKey = String(evt.question._id);
    const list = byQuestion.get(qKey) || [];
    const openOnes = list.filter((m) => !m.resolved);

    if (!evt.isCorrect) {
      const repeatedMistakeCount = all.filter(
        (m) => m.conceptTested === evt.conceptTested && !m.resolved
      ).length;

      const mistakeType =
        classifyMistake({
          isCorrect: false,
          timeTakenSec: evt.timeTakenSec,
          expectedTimeSec: evt.expectedTimeSec,
          selectedAnswerText: evt.selectedAnswerText,
          repeatedMistakeCount,
          questionCommonMistake: evt.question.commonMistake,
        }) || 'Concept Error';

      const timeDeltaSec = Math.round(evt.timeTakenSec - evt.expectedTimeSec);

      const mistake = {
        user: userId,
        question: evt.question._id,
        subject: evt.subject,
        topic: evt.topic,
        subtopic: evt.subtopic,
        conceptTested: evt.conceptTested,
        difficulty: evt.difficulty,
        mistakeType,
        timeTakenSec: evt.timeTakenSec,
        expectedTimeSec: evt.expectedTimeSec,
        timeDeltaSec,
        isSlowCorrect: false,
        selectedAnswerIndex: evt.selectedAnswerIndex,
        selectedAnswerText: evt.selectedAnswerText,
        repetitionStage: 0,
        nextReviewAt: addDays(evt.createdAt, REPETITION_DAYS[0]),
        retryCount: 0,
        improvedOnRetry: false,
        resolved: false,
        resolvedAt: null,
        lastReviewedAt: evt.createdAt,
        lastAttemptCorrect: false,
        createdAt: evt.createdAt,
        updatedAt: evt.createdAt,
      };

      list.push(mistake);
      all.push(mistake);

      openOnes.forEach((m) => {
        m.retryCount += 1;
        m.lastReviewedAt = evt.createdAt;
        m.lastAttemptCorrect = false;
        m.updatedAt = evt.createdAt;
      });

      byQuestion.set(qKey, list);
      return;
    }

    if (!openOnes.length) return;

    const isSlowCorrect = evt.timeTakenSec > evt.expectedTimeSec * 1.25;
    openOnes.forEach((m) => {
      m.retryCount += 1;
      m.lastReviewedAt = evt.createdAt;
      m.lastAttemptCorrect = true;
      m.improvedOnRetry = true;
      m.timeTakenSec = evt.timeTakenSec;
      m.expectedTimeSec = evt.expectedTimeSec;
      m.timeDeltaSec = Math.round(evt.timeTakenSec - evt.expectedTimeSec);
      m.isSlowCorrect = isSlowCorrect;
      m.updatedAt = evt.createdAt;

      if (m.repetitionStage >= 2) {
        m.resolved = true;
        m.resolvedAt = evt.createdAt;
        m.nextReviewAt = null;
      } else {
        m.repetitionStage += 1;
        m.nextReviewAt = addDays(evt.createdAt, REPETITION_DAYS[m.repetitionStage]);
      }
    });
    byQuestion.set(qKey, list);
  });

  return all;
};

// --- per-profile seeding ---------------------------------------------------

const seedOneProfile = async (profile, now) => {
  await cleanupDemoUser(profile.email);

  const subjects = Object.keys(profile.subjectProfile);
  const questionsBySubject = await loadQuestionPools(profile.targetExam, subjects);

  const missingSubjects = subjects.filter((s) => !(questionsBySubject[s] || []).length);
  if (missingSubjects.length) {
    throw new Error(
      `No questions found for ${profile.targetExam} subjects [${missingSubjects.join(', ')}]. ` +
        'Run "npm run seed:questions" first so the demo accounts have a real question bank to draw from.'
    );
  }

  // Build the activity calendar/events BEFORE creating the user so we know
  // the earliest practice date and can register the account a few days
  // before that - otherwise "Member since" would show a date AFTER the
  // student's first seeded practice session, which is impossible.
  const rand = mulberry32(hashSeed(profile.email));
  const calendar = buildActivityCalendar(rand, { totalDays: 34, recentStreakDays: 8 });
  const events = buildEventsForUser({ rand, profile, questionsBySubject, calendar, now });

  const earliestActivityAt = events.length ? events[0].createdAt : now;
  const registrationLeadDays = 1 + Math.floor(rand() * 4); // joined 1-4 days before first practice
  const joinedAt = new Date(
    earliestActivityAt.getTime() - registrationLeadDays * DAY_MS
  );

  const user = await User.create({
    name: profile.name,
    email: profile.email,
    password: profile.password,
    targetExam: profile.targetExam,
    isDemo: true,
    createdAt: joinedAt,
    updatedAt: joinedAt,
  });

  const attemptDocs = events.map((evt) => ({
    user: user._id,
    question: evt.question._id,
    subject: evt.subject,
    topic: evt.topic,
    subtopic: evt.subtopic,
    conceptTested: evt.conceptTested,
    difficulty: evt.difficulty,
    selectedAnswerIndex: evt.selectedAnswerIndex,
    isCorrect: evt.isCorrect,
    timeTakenSec: evt.timeTakenSec,
    expectedSolvingTimeSec: evt.expectedTimeSec,
    responsePace: responsePaceFor(evt.timeTakenSec, evt.expectedTimeSec),
    adaptiveDifficultyBefore: evt.difficulty,
    adaptiveDifficultyAfter: evt.difficulty,
    createdAt: evt.createdAt,
    updatedAt: evt.createdAt,
  }));

  if (attemptDocs.length) {
    await Attempt.insertMany(attemptDocs, { ordered: false });
  }

  const mistakeDocs = buildMistakesFromEvents(user._id, events);
  if (mistakeDocs.length) {
    await Mistake.insertMany(mistakeDocs, { ordered: false });
  }

  await rebuildPerformanceForUser(user._id);

  return {
    email: user.email,
    name: user.name,
    targetExam: user.targetExam,
    attempts: attemptDocs.length,
    correctAttempts: attemptDocs.filter((a) => a.isCorrect).length,
    mistakes: mistakeDocs.length,
    activeDays: calendar.length,
  };
};

const seedDemoAccounts = async () => {
  const now = new Date();
  const results = [];
  for (const profile of DEMO_PROFILES) {
    // Sequential on purpose: keeps DB load light and error messages
    // attributable to a single profile if something goes wrong.
    // eslint-disable-next-line no-await-in-loop
    const result = await seedOneProfile(profile, now);
    results.push(result);
  }
  return results;
};

module.exports = { seedDemoAccounts, resetDemoAccounts, DEMO_PROFILES };