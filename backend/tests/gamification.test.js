const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const GamificationProfile = require('../src/models/GamificationProfile');
const GamificationEvent = require('../src/models/GamificationEvent');
const UserAchievement = require('../src/models/UserAchievement');
const { levelForTotalXp } = require('../src/services/gamification/config');
const gamificationService = require('../src/services/gamification/gamificationService');
const { createUser, tokenFor, createQuestion } = require('./helpers/learningFixtures');

const post = (token, url, body = {}) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body);
const get = (token, url) => request(app).get(url).set('Authorization', `Bearer ${token}`);

describe('Level curve (pure function)', () => {
  test('level 1 starts at 0 xp', () => {
    expect(levelForTotalXp(0)).toMatchObject({ level: 1, currentLevelXp: 0, xpForNextLevel: 250 });
  });

  test('exactly at a level boundary rolls over to the next level', () => {
    expect(levelForTotalXp(250)).toMatchObject({ level: 2, currentLevelXp: 0, xpForNextLevel: 350 });
  });

  test('a large XP jump can skip multiple levels at once', () => {
    // 250 (L1->2) + 350 (L2->3) + 450 (L3->4) = 1050 exactly reaches level 4
    const result = levelForTotalXp(1050);
    expect(result.level).toBe(4);
    expect(result.currentLevelXp).toBe(0);
  });

  test('mid-level progress is reported correctly', () => {
    const result = levelForTotalXp(300); // 50 into level 2 (needs 350 to hit level 3)
    expect(result).toMatchObject({ level: 2, currentLevelXp: 50, xpForNextLevel: 350 });
  });
});

describe('gamificationService.processEvent - XP + anti-farming', () => {
  test('a correct practice answer awards XP exactly once, even if the same source is processed twice', async () => {
    const user = await createUser();
    const sourceId = new mongoose.Types.ObjectId();

    const first = await gamificationService.processEvent({
      userId: user._id,
      eventType: 'PRACTICE_ANSWER',
      sourceId,
      metadata: { isCorrect: true, timeTakenSec: 40, difficulty: 'Medium', isWeakTopic: false },
    });
    expect(first.duplicate).toBe(false);
    expect(first.xpAwarded).toBe(10); // this call's own award: PRACTICE_ANSWER_CORRECT, no speed/weak bonus.
    // first.totalXp (the profile grand total) is legitimately higher than 10 here -
    // a user's very first-ever event also triggers the once-per-day DAILY_ACTIVITY
    // award and the "first-step" achievement, both real, both correctly gated
    // (see the dedicated streak/achievement tests below). This test only cares
    // that the SAME source can never be double-counted, so it compares against
    // first.totalXp rather than a hand-computed constant.

    const second = await gamificationService.processEvent({
      userId: user._id,
      eventType: 'PRACTICE_ANSWER',
      sourceId, // same attempt id resubmitted
      metadata: { isCorrect: true, timeTakenSec: 40, difficulty: 'Medium', isWeakTopic: false },
    });
    expect(second.duplicate).toBe(true);
    expect(second.xpAwarded).toBe(0);
    expect(second.totalXp).toBe(first.totalXp); // resubmitting never moves the total

    const profile = await GamificationProfile.findOne({ user: user._id });
    expect(profile.totalXp).toBe(first.totalXp);
    expect(profile.totalQuestionsAnswered).toBe(1); // not double-counted either

    const practiceEvents = await GamificationEvent.find({ user: user._id, eventType: 'PRACTICE_ANSWER' });
    expect(practiceEvents).toHaveLength(1); // exactly one PRACTICE_ANSWER ledger entry for this source, ever
  });

  test('weak-topic and hard-difficulty bonuses apply, and are mutually exclusive with the base correct bonus', async () => {
    const user = await createUser();

    const weak = await gamificationService.processEvent({
      userId: user._id,
      eventType: 'PRACTICE_ANSWER',
      sourceId: new mongoose.Types.ObjectId(),
      metadata: { isCorrect: true, timeTakenSec: 999, difficulty: 'Easy', isWeakTopic: true },
    });
    expect(weak.xpAwarded).toBe(15);

    const hard = await gamificationService.processEvent({
      userId: user._id,
      eventType: 'PRACTICE_ANSWER',
      sourceId: new mongoose.Types.ObjectId(),
      metadata: { isCorrect: true, timeTakenSec: 999, difficulty: 'Hard', isWeakTopic: false },
    });
    expect(hard.xpAwarded).toBe(20);
  });

  test('a fast correct answer gets the speed bonus on top of the base award', async () => {
    const user = await createUser();
    const fast = await gamificationService.processEvent({
      userId: user._id,
      eventType: 'PRACTICE_ANSWER',
      sourceId: new mongoose.Types.ObjectId(),
      metadata: { isCorrect: true, timeTakenSec: 10, difficulty: 'Medium', isWeakTopic: false },
    });
    expect(fast.xpAwarded).toBe(13); // 10 base + 3 speed bonus
  });

  test('an exam completion awards a score bonus event distinct from the base completion event', async () => {
    const user = await createUser();
    const sessionId = new mongoose.Types.ObjectId();
    const result = await gamificationService.processEvent({
      userId: user._id,
      eventType: 'EXAM_COMPLETED',
      sourceId: sessionId,
      metadata: { scorePercent: 92 },
    });
    expect(result.xpAwarded).toBe(50 + 75); // base + 90%+ bonus

    const profile = await GamificationProfile.findOne({ user: user._id });
    expect(profile.totalExamsCompleted).toBe(1);
    expect(profile.bestExamScorePercent).toBe(92);

    // Exam completion is also streak-eligible, so a fresh user's first exam
    // legitimately also logs a DAILY_ACTIVITY event alongside these two -
    // assert the exam-specific pair exists exactly once each, rather than
    // asserting the ledger contains nothing else.
    const eventTypes = (await GamificationEvent.find({ user: user._id }).lean()).map((e) => e.eventType);
    expect(eventTypes.filter((t) => t === 'EXAM_COMPLETED')).toHaveLength(1);
    expect(eventTypes.filter((t) => t === 'EXAM_COMPLETED_BONUS')).toHaveLength(1);
  });
});

describe('gamificationService.processEvent - level ups', () => {
  test('crossing a level boundary is reported via leveledUp/previousLevel', async () => {
    const user = await createUser();
    // Push the profile to just below the level-2 boundary (250 xp) directly,
    // then let one more award tip it over.
    await GamificationProfile.create({ user: user._id, totalXp: 245, level: 1, currentLevelXp: 245, xpForNextLevel: 250 });

    const result = await gamificationService.processEvent({
      userId: user._id,
      eventType: 'PRACTICE_ANSWER',
      sourceId: new mongoose.Types.ObjectId(),
      metadata: { isCorrect: true, timeTakenSec: 999, difficulty: 'Hard', isWeakTopic: false }, // +20 xp
    });

    expect(result.leveledUp).toBe(true);
    expect(result.previousLevel).toBe(1);
    expect(result.level).toBe(2);
  });
});

describe('gamificationService - achievements', () => {
  test('an achievement unlocks once real thresholds are met, and never unlocks twice', async () => {
    const user = await createUser();
    for (let i = 0; i < 25; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await gamificationService.processEvent({
        userId: user._id,
        eventType: 'PRACTICE_ANSWER',
        sourceId: new mongoose.Types.ObjectId(),
        metadata: { isCorrect: true, timeTakenSec: 999, difficulty: 'Easy', isWeakTopic: false },
      });
    }
    const unlocked = await UserAchievement.find({ user: user._id }).lean();
    const ids = unlocked.map((a) => a.achievementId);
    expect(ids).toEqual(expect.arrayContaining(['first-step', 'getting-started']));
    expect(ids).not.toContain('question-crusher'); // needs 100

    // Re-running evaluation (as a side effect of another event) must not re-insert.
    await gamificationService.processEvent({
      userId: user._id,
      eventType: 'PRACTICE_ANSWER',
      sourceId: new mongoose.Types.ObjectId(),
      metadata: { isCorrect: true, timeTakenSec: 999, difficulty: 'Easy', isWeakTopic: false },
    });
    const afterAgain = await UserAchievement.find({ user: user._id, achievementId: 'first-step' });
    expect(afterAgain).toHaveLength(1);
  });
});

describe('gamificationService - streaks', () => {
  test('same-day activity does not extend the streak twice', async () => {
    const user = await createUser();
    const now = new Date();

    const r1 = await gamificationService.processEvent({
      userId: user._id,
      eventType: 'PRACTICE_ANSWER',
      sourceId: new mongoose.Types.ObjectId(),
      metadata: { isCorrect: true, timeTakenSec: 999, difficulty: 'Easy', isWeakTopic: false },
    });
    expect(r1.streak.currentStreak).toBe(1);

    const r2 = await gamificationService.processEvent({
      userId: user._id,
      eventType: 'PRACTICE_ANSWER',
      sourceId: new mongoose.Types.ObjectId(),
      metadata: { isCorrect: true, timeTakenSec: 999, difficulty: 'Easy', isWeakTopic: false },
    });
    expect(r2.streak.currentStreak).toBe(1);
    expect(r2.streak.streakExtended).toBe(false);

    const profile = await GamificationProfile.findOne({ user: user._id });
    expect(profile.currentStreak).toBe(1);
    expect(profile.longestStreak).toBe(1);
    void now;
  });

  test('a missed day (gap of 2+) with no shield resets the streak to 1', async () => {
    const user = await createUser();
    await GamificationProfile.create({
      user: user._id,
      currentStreak: 5,
      longestStreak: 5,
      lastActiveDate: '2020-01-01',
      streakShields: 0,
    });

    const result = await gamificationService.processEvent({
      userId: user._id,
      eventType: 'PRACTICE_ANSWER',
      sourceId: new mongoose.Types.ObjectId(),
      metadata: { isCorrect: true, timeTakenSec: 999, difficulty: 'Easy', isWeakTopic: false },
    });

    expect(result.streak.currentStreak).toBe(1);
    const profile = await GamificationProfile.findOne({ user: user._id });
    expect(profile.longestStreak).toBe(5); // longest streak is preserved
  });
});

describe('Gamification API routes', () => {
  test('summary/profile/achievements/history all require auth', async () => {
    expect((await request(app).get('/api/gamification/summary')).status).toBe(401);
    expect((await request(app).get('/api/gamification/profile')).status).toBe(401);
    expect((await request(app).get('/api/gamification/achievements')).status).toBe(401);
    expect((await request(app).get('/api/gamification/history')).status).toBe(401);
  });

  test('submitting a practice attempt awards XP and is reflected in the summary endpoint', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const question = await createQuestion({ correctAnswerIndex: 1 });

    const attemptRes = await post(token, '/api/attempts', {
      questionId: String(question._id),
      selectedAnswerIndex: 1,
      timeTakenSec: 20,
    });
    expect(attemptRes.status).toBe(201);
    expect(attemptRes.body.gamification).toBeTruthy();
    expect(attemptRes.body.gamification.xpAwarded).toBeGreaterThan(0);

    const summary = await get(token, '/api/gamification/summary');
    expect(summary.status).toBe(200);
    // attemptRes.body.gamification.xpAwarded is this one event's own award;
    // .totalXp is the running profile total (which also picked up the
    // first-time DAILY_ACTIVITY/first-step stacking) - the summary endpoint
    // must agree with that total exactly.
    expect(summary.body.profile.totalXp).toBe(attemptRes.body.gamification.totalXp);
    expect(summary.body.profile.currentStreak).toBe(1);
  });

  test('there is no endpoint that lets a client directly grant themselves XP', async () => {
    const user = await createUser();
    const token = tokenFor(user);
    const res = await post(token, '/api/gamification/add-xp', { amount: 999999 });
    expect(res.status).toBe(404);
  });
});