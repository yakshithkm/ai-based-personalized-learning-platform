const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const Question = require('../src/models/Question');
const ExamSession = require('../src/models/ExamSession');

const TOPICS = { Physics: ['Mechanics', 'Waves'], Chemistry: ['Organic', 'Inorganic'], Biology: ['Genetics', 'Ecology'] };

const buildQuestions = (count = 6) => {
  const subjects = Object.keys(TOPICS);
  return Array.from({ length: count }, (_, i) => {
    const subject = subjects[i % subjects.length];
    return {
      examType: 'NEET',
      subject,
      topic: TOPICS[subject][i % 2],
      subtopic: 'Basics',
      difficulty: 'Medium',
      difficultyLevel: 'Moderate',
      yearTag: 'Mock',
      weightage: 'Medium',
      text: `${subject} question ${i + 1}`,
      conceptTested: 'Concept',
      commonMistake: 'Rushing',
      solvingTimeEstimate: 60,
      difficultyReason: 'Balanced',
      options: ['A', 'B', 'C', 'D'],
      correctAnswerIndex: i % 4,
      correctAnswer: ['A', 'B', 'C', 'D'][i % 4],
      mistakeType: 'concept',
      explanation: 'Because.',
    };
  });
};

const registerUser = async (email) => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Proctor Tester', email, password: 'pass1234', targetExam: 'NEET' });
  return { token: res.body.token };
};

// Sessions are built directly so these tests exercise the proctoring endpoints in isolation
// from question-selection logic.
const createSession = async ({ token, overrides = {} }) => {
  const userId = jwt.verify(token, process.env.JWT_SECRET).id;
  const questions = await Question.insertMany(buildQuestions());
  const session = await ExamSession.create({
    user: userId,
    examType: 'NEET',
    mode: 'section-wise',
    sectionSubject: 'Physics',
    strictNavigation: false,
    status: 'active',
    questionCount: questions.length,
    timeLimitSec: 3600,
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600 * 1000),
    questionOrder: questions.map((q) => ({
      question: q._id,
      subject: q.subject,
      topic: q.topic,
      subtopic: 'Basics',
      difficulty: 'Medium',
      difficultyLevel: 'Moderate',
      yearTag: 'Mock',
      weightage: 'Medium',
      conceptTested: 'Concept',
    })),
    ...overrides,
  });
  return String(session._id);
};

const report = (token, sessionId, eventId, type = 'WINDOW_BLUR') =>
  request(app)
    .post(`/api/exams/sessions/${sessionId}/violations`)
    .set('Authorization', `Bearer ${token}`)
    .send({ eventId, type });

const submit = (token, sessionId, body) => {
  const req = request(app).post(`/api/exams/sessions/${sessionId}/submit`).set('Authorization', `Bearer ${token}`);
  return body === undefined ? req : req.send(body);
};

describe('Exam focus proctoring', () => {
  let token;
  let sessionId;

  beforeEach(async () => {
    ({ token } = await registerUser(`proctor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`));
    sessionId = await createSession({ token });
  });

  test('counts each distinct event once and is idempotent per eventId', async () => {
    const first = await report(token, sessionId, 'evt-1', 'TAB_HIDDEN');
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ recorded: true, violationCount: 1, maximumViolations: 5, limitReached: false });

    const retry = await report(token, sessionId, 'evt-1', 'TAB_HIDDEN');
    expect(retry.body).toMatchObject({ recorded: false, reason: 'DUPLICATE_EVENT', violationCount: 1 });

    const second = await report(token, sessionId, 'evt-2');
    expect(second.body).toMatchObject({ recorded: true, violationCount: 2 });
  });

  test('caps at the maximum and flags limitReached on the fifth violation', async () => {
    let last;
    for (let i = 1; i <= 5; i += 1) {
      last = await report(token, sessionId, `evt-${i}`);
    }
    expect(last.body).toMatchObject({ recorded: true, violationCount: 5, limitReached: true });

    const beyond = await report(token, sessionId, 'evt-6');
    expect(beyond.body).toMatchObject({ recorded: false, reason: 'LIMIT_REACHED', violationCount: 5, limitReached: true });

    const stored = await ExamSession.findById(sessionId).lean();
    expect(stored.violationCount).toBe(5);
    expect(stored.violationEvents).toHaveLength(5);
  });

  // Relies on MongoDB's single-document atomicity for findOneAndUpdate.
  test('concurrent reports can never push the count past the maximum', async () => {
    const results = await Promise.all(
      Array.from({ length: 9 }, (_, i) => report(token, sessionId, `race-${i}`, 'TAB_HIDDEN'))
    );
    results.forEach((res) => expect(res.status).toBe(200));
    expect(results.filter((res) => res.body.recorded)).toHaveLength(5);

    const stored = await ExamSession.findById(sessionId).lean();
    expect(stored.violationCount).toBe(5);
  });

  test('rejects malformed reports and other users\' sessions', async () => {
    const noId = await request(app)
      .post(`/api/exams/sessions/${sessionId}/violations`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'WINDOW_BLUR' });
    expect(noId.status).toBe(400);

    const badType = await report(token, sessionId, 'evt-x', 'CAMERA_UNAVAILABLE');
    expect(badType.status).toBe(400);

    const other = await registerUser(`other-${Date.now()}@test.com`);
    const foreign = await report(other.token, sessionId, 'evt-y');
    expect(foreign.status).toBe(404);

    const stored = await ExamSession.findById(sessionId).lean();
    expect(stored.violationCount).toBe(0);
  });

  test('session state exposes violation metadata (so a refresh cannot reset it)', async () => {
    await report(token, sessionId, 'evt-1');
    await report(token, sessionId, 'evt-2');

    const res = await request(app).get(`/api/exams/sessions/${sessionId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      violationCount: 2,
      maximumViolations: 5,
      autoSubmitted: false,
      autoSubmitReason: null,
    });
  });

  test('MAX_VIOLATIONS submit is persisted only when the server count reached the limit', async () => {
    for (let i = 1; i <= 5; i += 1) {
      await report(token, sessionId, `evt-${i}`);
    }
    const res = await submit(token, sessionId, { reason: 'MAX_VIOLATIONS', violationCount: 5 });
    expect(res.status).toBe(200);
    expect(res.body.proctoring).toEqual({
      violationCount: 5,
      maximumViolations: 5,
      presenceWarningCount: 0,
      maximumPresenceWarnings: 5,
      autoSubmitted: true,
      autoSubmitReason: 'MAX_VIOLATIONS',
    });

    const stored = await ExamSession.findById(sessionId).lean();
    expect(stored).toMatchObject({ status: 'submitted', autoSubmitted: true, autoSubmitReason: 'MAX_VIOLATIONS', violationCount: 5 });
    // Existing scoring output is untouched.
    expect(res.body.scoreSummary).toBeDefined();
  });

  test('a forged MAX_VIOLATIONS reason is ignored when the count is below the limit', async () => {
    await report(token, sessionId, 'evt-1');
    const res = await submit(token, sessionId, { reason: 'MAX_VIOLATIONS' });
    expect(res.status).toBe(200);
    expect(res.body.proctoring).toMatchObject({ violationCount: 1, autoSubmitted: false, autoSubmitReason: null });
  });

  test('client claimed count can raise (never lower) the stored count when reports were lost', async () => {
    await report(token, sessionId, 'evt-1');
    await report(token, sessionId, 'evt-2');
    const res = await submit(token, sessionId, { reason: 'MAX_VIOLATIONS', violationCount: 5 });
    expect(res.body.proctoring).toMatchObject({ violationCount: 5, autoSubmitted: true, autoSubmitReason: 'MAX_VIOLATIONS' });

    const lowered = await createSession({ token });
    for (let i = 1; i <= 3; i += 1) await report(token, lowered, `low-${i}`);
    const res2 = await submit(token, lowered, { reason: 'MANUAL', violationCount: 0 });
    expect(res2.body.proctoring.violationCount).toBe(3);
  });

  test('legacy manual submit with no body still works and is not flagged as auto-submitted', async () => {
    const res = await submit(token, sessionId);
    expect(res.status).toBe(200);
    expect(res.body.proctoring).toMatchObject({ violationCount: 0, autoSubmitted: false, autoSubmitReason: null });
  });

  test('TIME_EXPIRED is only persisted when the timer has genuinely run out', async () => {
    const early = await submit(token, sessionId, { reason: 'TIME_EXPIRED' });
    expect(early.body.proctoring.autoSubmitted).toBe(false);

    const expired = await createSession({ token, overrides: { expiresAt: new Date(Date.now() - 1000) } });
    const late = await submit(token, expired, { reason: 'TIME_EXPIRED' });
    expect(late.body.proctoring).toMatchObject({ autoSubmitted: true, autoSubmitReason: 'TIME_EXPIRED' });
  });

  test('violations after submission are ignored and a repeated submit is idempotent', async () => {
    const first = await submit(token, sessionId, { reason: 'MANUAL' });
    const again = await submit(token, sessionId, { reason: 'MAX_VIOLATIONS', violationCount: 5 });
    expect(again.status).toBe(200);
    expect(again.body.proctoring).toEqual(first.body.proctoring);

    const late = await report(token, sessionId, 'late-1');
    expect(late.body).toMatchObject({ recorded: false, reason: 'SESSION_NOT_ACTIVE', violationCount: 0 });
  });

  describe('presence warnings (no person in front of the camera)', () => {
    test('are a separate counter: they never change the focus count, and vice versa', async () => {
      await report(token, sessionId, 'focus-1', 'TAB_HIDDEN');
      const p1 = await report(token, sessionId, 'presence-1', 'NO_PERSON');
      expect(p1.body).toMatchObject({
        recorded: true,
        violationCount: 1,
        presenceWarningCount: 1,
        maximumPresenceWarnings: 5,
        presenceLimitReached: false,
      });

      const p2 = await report(token, sessionId, 'presence-2', 'NO_PERSON');
      expect(p2.body).toMatchObject({ violationCount: 1, presenceWarningCount: 2 });

      const f2 = await report(token, sessionId, 'focus-2', 'WINDOW_BLUR');
      expect(f2.body).toMatchObject({ violationCount: 2, presenceWarningCount: 2 });
    });

    test('are idempotent per eventId and capped at the maximum', async () => {
      let last;
      for (let i = 1; i <= 5; i += 1) {
        last = await report(token, sessionId, `presence-${i}`, 'NO_PERSON');
      }
      expect(last.body).toMatchObject({ recorded: true, presenceWarningCount: 5, presenceLimitReached: true });

      const dup = await report(token, sessionId, 'presence-5', 'NO_PERSON');
      expect(dup.body).toMatchObject({ recorded: false, reason: 'DUPLICATE_EVENT', presenceWarningCount: 5 });

      const beyond = await report(token, sessionId, 'presence-6', 'NO_PERSON');
      expect(beyond.body).toMatchObject({ recorded: false, reason: 'LIMIT_REACHED', presenceWarningCount: 5 });

      // The focus counter still has room.
      const focus = await report(token, sessionId, 'focus-1', 'TAB_HIDDEN');
      expect(focus.body).toMatchObject({ recorded: true, violationCount: 1 });
    });

    test('session state exposes the presence metadata (so a refresh cannot reset it)', async () => {
      await report(token, sessionId, 'presence-1', 'NO_PERSON');
      const res = await request(app).get(`/api/exams/sessions/${sessionId}`).set('Authorization', `Bearer ${token}`);
      expect(res.body).toMatchObject({ presenceWarningCount: 1, maximumPresenceWarnings: 5, violationCount: 0 });
    });

    test('PRESENCE_LIMIT submit is persisted only when the server count reached the limit', async () => {
      for (let i = 1; i <= 5; i += 1) {
        await report(token, sessionId, `presence-${i}`, 'NO_PERSON');
      }
      const res = await submit(token, sessionId, { reason: 'PRESENCE_LIMIT', presenceWarningCount: 5 });
      expect(res.status).toBe(200);
      expect(res.body.proctoring).toMatchObject({
        presenceWarningCount: 5,
        violationCount: 0,
        autoSubmitted: true,
        autoSubmitReason: 'PRESENCE_LIMIT',
      });

      const stored = await ExamSession.findById(sessionId).lean();
      expect(stored).toMatchObject({ status: 'submitted', autoSubmitted: true, autoSubmitReason: 'PRESENCE_LIMIT' });
    });

    test('a forged PRESENCE_LIMIT reason is ignored below the limit; a claimed count can only raise', async () => {
      await report(token, sessionId, 'presence-1', 'NO_PERSON');
      const forged = await submit(token, sessionId, { reason: 'PRESENCE_LIMIT' });
      expect(forged.body.proctoring).toMatchObject({ presenceWarningCount: 1, autoSubmitted: false, autoSubmitReason: null });

      const other = await createSession({ token });
      await report(token, other, 'p-1', 'NO_PERSON');
      await report(token, other, 'p-2', 'NO_PERSON');
      const raised = await submit(token, other, { reason: 'PRESENCE_LIMIT', presenceWarningCount: 5 });
      expect(raised.body.proctoring).toMatchObject({ presenceWarningCount: 5, autoSubmitReason: 'PRESENCE_LIMIT' });

      const lowered = await createSession({ token });
      for (let i = 1; i <= 3; i += 1) await report(token, lowered, `low-${i}`, 'NO_PERSON');
      const kept = await submit(token, lowered, { reason: 'MANUAL', presenceWarningCount: 0 });
      expect(kept.body.proctoring.presenceWarningCount).toBe(3);
    });
  });
});