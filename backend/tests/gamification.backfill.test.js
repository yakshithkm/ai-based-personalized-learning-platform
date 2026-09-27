const mongoose = require('mongoose');
const Attempt = require('../src/models/Attempt');
const LearningContentProgress = require('../src/models/LearningContentProgress');
const LearningContent = require('../src/models/LearningContent');
const ExamSession = require('../src/models/ExamSession');
const GamificationProfile = require('../src/models/GamificationProfile');
const GamificationEvent = require('../src/models/GamificationEvent');
const gamificationService = require('../src/services/gamification/gamificationService');
const { backfillUserGamification, reconstructStreakFromDays } = require('../src/services/gamification/backfillService');
const { createUser } = require('./helpers/learningFixtures');

const fixedAttempt = (userId, { isCorrect = true, difficulty = 'Medium', createdAt }) => ({
  user: userId,
  question: new mongoose.Types.ObjectId(),
  subject: 'Physics',
  topic: 'Current Electricity',
  subtopic: 'General',
  conceptTested: 'Current Electricity',
  difficulty,
  selectedAnswerIndex: isCorrect ? 1 : 0,
  isCorrect,
  timeTakenSec: 60,
  createdAt,
});

describe('reconstructStreakFromDays (pure function)', () => {
  test('three consecutive days is a streak of 3', () => {
    expect(reconstructStreakFromDays(['2026-01-01', '2026-01-02', '2026-01-03'])).toEqual({
      currentStreak: 3,
      longestStreak: 3,
      lastActiveDate: '2026-01-03',
    });
  });

  test('a gap resets the current streak but keeps the longest one', () => {
    const result = reconstructStreakFromDays(['2026-01-01', '2026-01-02', '2026-01-10']);
    expect(result.longestStreak).toBe(2);
    expect(result.currentStreak).toBe(1);
    expect(result.lastActiveDate).toBe('2026-01-10');
  });

  test('empty history yields a zero streak', () => {
    expect(reconstructStreakFromDays([])).toEqual({ currentStreak: 0, longestStreak: 0, lastActiveDate: null });
  });
});

describe('backfillUserGamification', () => {
  test('populates XP/counters/streak from pre-existing Attempt history for a never-touched user', async () => {
    const user = await createUser();
    await Attempt.insertMany([
      fixedAttempt(user._id, { isCorrect: true, createdAt: new Date('2026-01-01T10:00:00Z') }),
      fixedAttempt(user._id, { isCorrect: true, createdAt: new Date('2026-01-02T10:00:00Z') }),
      fixedAttempt(user._id, { isCorrect: false, createdAt: new Date('2026-01-03T10:00:00Z') }),
    ]);

    const result = await backfillUserGamification(user._id);
    expect(result.ran).toBe(true);
    expect(result.processedCount).toBe(3);

    const profile = await GamificationProfile.findOne({ user: user._id });
    expect(profile.totalQuestionsAnswered).toBe(3);
    expect(profile.totalQuestionsCorrect).toBe(2);
    expect(profile.totalXp).toBeGreaterThan(0);
    expect(profile.longestStreak).toBe(3); // three consecutive calendar days
    expect(profile.currentStreak).toBe(3);
    expect(profile.lastActiveDate).toBe('2026-01-03');
    expect(profile.historicalBackfillCompletedAt).toBeTruthy();

    // Every historical attempt produced its own dedupeable ledger entry,
    // dated to its real historical day - not the day the backfill ran.
    const events = await GamificationEvent.find({ user: user._id, eventType: 'PRACTICE_ANSWER' }).sort({ createdAt: 1 });
    expect(events).toHaveLength(3);
    expect(events[0].createdAt.toISOString().slice(0, 10)).toBe('2026-01-01');
  });

  test('concurrent first-time requests for the same user never see a stale, mid-backfill profile', async () => {
    const user = await createUser();
    // Enough attempts that the backfill loop takes a non-trivial number of
    // awaited steps, widening the race window the way a real demo account
    // with hundreds of attempts would.
    await Attempt.insertMany(
      Array.from({ length: 12 }, (_, i) =>
        fixedAttempt(user._id, { isCorrect: true, createdAt: new Date(Date.UTC(2026, 0, 1 + i, 10, 0, 0)) })
      )
    );

    // Two requests race in for the same never-backfilled user - e.g. the
    // header's summary fetch and a page's own analytics fetch, both firing
    // on the same page load.
    const [resultA, resultB] = await Promise.all([
      backfillUserGamification(user._id),
      backfillUserGamification(user._id),
    ]);

    // Exactly one of them actually did the work; the other must have WAITED
    // for it rather than returning immediately with an empty profile.
    const outcomes = [resultA, resultB];
    expect(outcomes.filter((r) => r.ran)).toHaveLength(1);
    expect(outcomes.every((r) => r.alreadyBackfilled || r.ran)).toBe(true);
    expect(outcomes.some((r) => r.inProgress)).toBe(false);

    // Whichever one a caller reads, the profile itself must already be
    // fully populated by the time either promise resolves.
    const profile = await GamificationProfile.findOne({ user: user._id });
    expect(profile.totalQuestionsAnswered).toBe(12);
    expect(profile.historicalBackfillCompletedAt).toBeTruthy();
  });

  test('is idempotent - running it twice never double-counts', async () => {
    const user = await createUser();
    await Attempt.insertMany([fixedAttempt(user._id, { isCorrect: true, createdAt: new Date('2026-02-01T10:00:00Z') })]);

    const first = await backfillUserGamification(user._id);
    expect(first.ran).toBe(true);

    const second = await backfillUserGamification(user._id);
    expect(second.ran).toBe(false);
    expect(second.alreadyBackfilled).toBe(true);

    const profile = await GamificationProfile.findOne({ user: user._id });
    expect(profile.totalQuestionsAnswered).toBe(1);
  });

  test('never regresses a streak the user is actively maintaining today', async () => {
    const user = await createUser();

    // Old history, several days in the past - nothing recent.
    await Attempt.insertMany([
      fixedAttempt(user._id, { isCorrect: true, createdAt: new Date('2020-01-01T10:00:00Z') }),
      fixedAttempt(user._id, { isCorrect: true, createdAt: new Date('2020-01-02T10:00:00Z') }),
    ]);

    // The user is already active TODAY via the live pipeline before the
    // backfill ever runs (e.g. they signed up and immediately practiced).
    const liveResult = await gamificationService.processEvent({
      userId: user._id,
      eventType: 'PRACTICE_ANSWER',
      sourceId: new mongoose.Types.ObjectId(),
      metadata: { isCorrect: true, timeTakenSec: 30, difficulty: 'Medium', isWeakTopic: false },
    });
    expect(liveResult.streak.currentStreak).toBe(1);

    await backfillUserGamification(user._id);

    const profile = await GamificationProfile.findOne({ user: user._id });
    // The 2020 history must not overwrite today's freshly-started streak...
    expect(profile.currentStreak).toBe(1);
    // ...but it DOES still count toward the all-time longest streak record.
    expect(profile.longestStreak).toBe(2);
  });

  test('also backfills completed learning content and submitted exams', async () => {
    const user = await createUser();
    const content = await LearningContent.create({
      title: 'Ohm\u2019s Law',
      subject: 'Physics',
      topic: 'Current Electricity',
      contentType: 'concept',
      difficulty: 'Easy',
      estimatedMinutes: 8,
      body: 'Some study text.',
      examTypes: ['NEET', 'JEE', 'CET'],
      qualityScore: 80,
    });
    await LearningContentProgress.create({
      user: user._id,
      content: content._id,
      status: 'completed',
      progressPercent: 100,
      completedAt: new Date('2026-03-01T09:00:00Z'),
    });

    await ExamSession.create({
      user: user._id,
      examType: 'NEET',
      mode: 'full-length',
      status: 'submitted',
      questionCount: 10,
      timeLimitSec: 600,
      expiresAt: new Date('2026-03-02T00:00:00Z'),
      submittedAt: new Date('2026-03-02T09:00:00Z'),
      resultSummary: { scoreSummary: { totalScore: 36, maxScore: 40 } }, // 90%
    });

    // An exam forced to submit by proctoring violations must NOT earn XP,
    // same rule as the live path.
    await ExamSession.create({
      user: user._id,
      examType: 'NEET',
      mode: 'full-length',
      status: 'submitted',
      questionCount: 10,
      timeLimitSec: 600,
      expiresAt: new Date('2026-03-03T00:00:00Z'),
      submittedAt: new Date('2026-03-03T09:00:00Z'),
      autoSubmitReason: 'MAX_VIOLATIONS',
      resultSummary: { scoreSummary: { totalScore: 40, maxScore: 40 } },
    });

    const result = await backfillUserGamification(user._id);
    expect(result.processedCount).toBe(2); // learning + one valid exam; violation exam excluded

    const profile = await GamificationProfile.findOne({ user: user._id });
    expect(profile.totalLearningContentCompleted).toBe(1);
    expect(profile.totalExamsCompleted).toBe(1);
    expect(profile.bestExamScorePercent).toBe(90);

    const eventTypes = (await GamificationEvent.find({ user: user._id }).lean()).map((e) => e.eventType);
    expect(eventTypes.filter((t) => t === 'EXAM_COMPLETED')).toHaveLength(1);
  });
});