const request = require('supertest');
const app = require('../src/app');
const Question = require('../src/models/Question');
const ExamSession = require('../src/models/ExamSession');

const SUBJECT_TOPICS = {
  Physics: ['Mechanics', 'Waves', 'Electrostatics', 'Optics'],
};

const buildQuestion = ({ examType, subject, idx }) => {
  const topic = SUBJECT_TOPICS[subject][idx % SUBJECT_TOPICS[subject].length];
  const difficulty = idx % 3 === 0 ? 'Easy' : idx % 3 === 1 ? 'Medium' : 'Hard';
  const options = ['Option A', 'Option B', 'Option C', 'Option D'];

  return {
    examType,
    subject,
    topic,
    subtopic: `${topic} Basics`,
    difficulty,
    difficultyLevel: difficulty === 'Easy' ? 'Easy' : difficulty === 'Hard' ? 'Tough' : 'Moderate',
    yearTag: idx % 2 === 0 ? 'Previous Year' : 'Mock',
    weightage: idx % 3 === 0 ? 'High' : 'Medium',
    text: `${examType} ${subject} Q${idx + 1}: Scenario ${idx + 1}`,
    conceptTested: `${subject} - ${topic}`,
    commonMistake: `Common mistake ${idx + 1}`,
    solvingTimeEstimate: 60 + (idx % 5) * 5,
    difficultyReason: 'Stress-test question generated for ordering tests.',
    options,
    correctAnswerIndex: idx % 4,
    correctAnswer: options[idx % 4],
    mistakeType: idx % 2 === 0 ? 'concept' : 'calculation',
    explanation: `Explanation ${idx + 1}`,
  };
};

const createPhysicsQuestions = async ({ examType, count = 45 }) => {
  const docs = [];
  for (let i = 0; i < count; i += 1) {
    docs.push(buildQuestion({ examType, subject: 'Physics', idx: i }));
  }
  await Question.insertMany(docs);
};

const registerAndLogin = async ({ targetExam = 'JEE', email }) => {
  const payload = {
    name: 'Stress Tester',
    email,
    password: 'pass1234',
    targetExam,
  };

  const registerRes = await request(app).post('/api/auth/register').send(payload);
  expect(registerRes.status).toBe(201);
  return registerRes.body.token;
};

const startSession = async ({ token, examType = 'JEE', sectionSubject = 'Physics' }) => {
  const startRes = await request(app)
    .post('/api/exams/sessions')
    .set('Authorization', `Bearer ${token}`)
    .send({
      mode: 'section-wise',
      examType,
      sectionSubject,
      strictNavigation: false,
    });

  expect(startRes.status).toBe(201);
  return startRes.body;
};

const submitIntent = ({
  token,
  sessionId,
  sessionToken,
  requestNonce,
  questionIndex,
  questionId,
  selectedAnswerIndex,
  intentId,
  intentSeq,
  testDelay,
}) => {
  let req = request(app)
    .patch(`/api/exams/sessions/${sessionId}/answer`)
    .set('Authorization', `Bearer ${token}`)
    .set('x-exam-session-token', sessionToken)
    .set('x-exam-request-nonce', requestNonce)
    .send({
      questionIndex,
      questionId,
      selectedAnswerIndex,
      timeTakenSec: 42,
      intentId,
      intentSeq,
    });

  if (Number.isInteger(testDelay) && testDelay > 0) {
    req = req.query({ testDelay });
  }

  return req;
};

const getStoredAnswer = async (sessionId, questionIndex = 0) => {
  const session = await ExamSession.findById(sessionId).lean();
  const response = session.responses.find((entry) => entry.questionIndex === questionIndex);
  return { session, response };
};

describe('Exam intent ordering stress tests', () => {
  test('Case A: out-of-order requests preserve the higher sequence', async () => {
    await createPhysicsQuestions({ examType: 'JEE' });
    const token = await registerAndLogin({
      targetExam: 'JEE',
      email: 'ordering-a@test.com',
    });
    const started = await startSession({ token });
    const currentQuestion = started.questions[0];
    const questionIndex = 0;
    const questionId = currentQuestion._id;

    const acceptedRes = await submitIntent({
      token,
      sessionId: started.sessionId,
      sessionToken: started.sessionToken,
      requestNonce: started.requestNonce,
      questionIndex,
      questionId,
      selectedAnswerIndex: 2,
      intentId: 'ordering-a-2',
      intentSeq: 2,
    });

    expect(acceptedRes.status).toBe(200);
    expect(acceptedRes.body.intentSeq).toBe(2);

    const rejectedRes = await submitIntent({
      token,
      sessionId: started.sessionId,
      sessionToken: started.sessionToken,
      requestNonce: acceptedRes.body.requestNonce,
      questionIndex,
      questionId,
      selectedAnswerIndex: 1,
      intentId: 'ordering-a-1',
      intentSeq: 1,
    });

    expect(rejectedRes.status).toBe(409);
    expect(rejectedRes.body.message).toMatch(/obso|stale|rejected/i);

    const { session, response } = await getStoredAnswer(started.sessionId, questionIndex);
    expect(response.selectedAnswerIndex).toBe(2);
    expect(response.questionIndex).toBe(0);
    expect(session.intentLedger[String(questionId)].lastAcceptedIntentSeq).toBe(2);
  });

  test('Case B: rapid overwrite keeps only the highest sequence', async () => {
    await createPhysicsQuestions({ examType: 'JEE' });
    const token = await registerAndLogin({
      targetExam: 'JEE',
      email: 'ordering-b@test.com',
    });
    const started = await startSession({ token });
    const questionId = started.questions[0]._id;

    const requests = [
      submitIntent({
        token,
        sessionId: started.sessionId,
        sessionToken: started.sessionToken,
        requestNonce: started.requestNonce,
        questionIndex: 0,
        questionId,
        selectedAnswerIndex: 0,
        intentId: 'ordering-b-1',
        intentSeq: 1,
        testDelay: 250,
      }),
      submitIntent({
        token,
        sessionId: started.sessionId,
        sessionToken: started.sessionToken,
        requestNonce: started.requestNonce,
        questionIndex: 0,
        questionId,
        selectedAnswerIndex: 1,
        intentId: 'ordering-b-2',
        intentSeq: 2,
        testDelay: 150,
      }),
      submitIntent({
        token,
        sessionId: started.sessionId,
        sessionToken: started.sessionToken,
        requestNonce: started.requestNonce,
        questionIndex: 0,
        questionId,
        selectedAnswerIndex: 2,
        intentId: 'ordering-b-3',
        intentSeq: 3,
        testDelay: 50,
      }),
      submitIntent({
        token,
        sessionId: started.sessionId,
        sessionToken: started.sessionToken,
        requestNonce: started.requestNonce,
        questionIndex: 0,
        questionId,
        selectedAnswerIndex: 3,
        intentId: 'ordering-b-4',
        intentSeq: 4,
        testDelay: 0,
      }),
    ];

    const results = await Promise.all(requests);
    const accepted = results.filter((result) => result.status === 200);
    expect(accepted.length).toBe(1);
    expect(accepted[0].body.intentSeq).toBe(4);

    const { session, response } = await getStoredAnswer(started.sessionId, 0);
    expect(session.responses).toHaveLength(1);
    expect(response.selectedAnswerIndex).toBe(3);
    expect(session.intentLedger[String(questionId)].lastAcceptedIntentSeq).toBe(4);
  });

  test('Case C: duplicate intentId is cached and does not double-write', async () => {
    await createPhysicsQuestions({ examType: 'JEE' });
    const token = await registerAndLogin({
      targetExam: 'JEE',
      email: 'ordering-c@test.com',
    });
    const started = await startSession({ token });
    const questionId = started.questions[0]._id;
    const intentId = 'ordering-c-dup';

    const firstRes = await submitIntent({
      token,
      sessionId: started.sessionId,
      sessionToken: started.sessionToken,
      requestNonce: started.requestNonce,
      questionIndex: 0,
      questionId,
      selectedAnswerIndex: 2,
      intentId,
      intentSeq: 1,
    });

    expect(firstRes.status).toBe(200);

    const secondRes = await submitIntent({
      token,
      sessionId: started.sessionId,
      sessionToken: started.sessionToken,
      requestNonce: started.requestNonce,
      questionIndex: 0,
      questionId,
      selectedAnswerIndex: 2,
      intentId,
      intentSeq: 1,
    });

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.intentId).toBe(intentId);
    expect(secondRes.body.intentSeq).toBe(1);
    expect(secondRes.body.savedAnswer.selectedAnswerIndex).toBe(2);

    const { session, response } = await getStoredAnswer(started.sessionId, 0);
    expect(session.responses).toHaveLength(1);
    expect(response.selectedAnswerIndex).toBe(2);
    expect(session.intentLedger[String(questionId)].processedIntents[intentId]).toBeDefined();
  });

  test('Race condition: delayed older intent cannot overwrite a newer one', async () => {
    await createPhysicsQuestions({ examType: 'JEE' });
    const token = await registerAndLogin({
      targetExam: 'JEE',
      email: 'ordering-race@test.com',
    });
    const started = await startSession({ token });
    const questionId = started.questions[0]._id;

    const [slowRequest, fastRequest] = await Promise.all([
      submitIntent({
        token,
        sessionId: started.sessionId,
        sessionToken: started.sessionToken,
        requestNonce: started.requestNonce,
        questionIndex: 0,
        questionId,
        selectedAnswerIndex: 0,
        intentId: 'race-1',
        intentSeq: 1,
        testDelay: 500,
      }),
      submitIntent({
        token,
        sessionId: started.sessionId,
        sessionToken: started.sessionToken,
        requestNonce: started.requestNonce,
        questionIndex: 0,
        questionId,
        selectedAnswerIndex: 1,
        intentId: 'race-2',
        intentSeq: 2,
        testDelay: 0,
      }),
    ]);

    expect(fastRequest.status).toBe(200);
    expect(fastRequest.body.intentSeq).toBe(2);
    expect(slowRequest.status).toBe(409);

    const { session, response } = await getStoredAnswer(started.sessionId, 0);
    expect(response.selectedAnswerIndex).toBe(1);
    expect(session.intentLedger[String(questionId)].lastAcceptedIntentSeq).toBe(2);
  });

  test('logs intent rejection details for obsolete sequence rejection', async () => {
    await createPhysicsQuestions({ examType: 'JEE' });
    const token = await registerAndLogin({
      targetExam: 'JEE',
      email: 'ordering-log@test.com',
    });
    const started = await startSession({ token });
    const questionId = started.questions[0]._id;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const acceptedRes = await submitIntent({
      token,
      sessionId: started.sessionId,
      sessionToken: started.sessionToken,
      requestNonce: started.requestNonce,
      questionIndex: 0,
      questionId,
      selectedAnswerIndex: 2,
      intentId: 'log-seq-2',
      intentSeq: 2,
    });
    expect(acceptedRes.status).toBe(200);

    const rejectedRes = await submitIntent({
      token,
      sessionId: started.sessionId,
      sessionToken: started.sessionToken,
      requestNonce: acceptedRes.body.requestNonce,
      questionIndex: 0,
      questionId,
      selectedAnswerIndex: 1,
      intentId: 'log-seq-1',
      intentSeq: 1,
    });

    expect(rejectedRes.status).toBe(409);
    expect(warnSpy).toHaveBeenCalledWith(
      '[exam-intent-rejection]',
      expect.objectContaining({
        questionId: String(questionId),
        incomingSeq: 1,
        lastAcceptedSeq: 2,
        reason: 'obsolete-intent-seq',
      })
    );

    warnSpy.mockRestore();
  });
});
