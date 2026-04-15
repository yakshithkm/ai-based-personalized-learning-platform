const request = require('supertest');
const http = require('http');
const app = require('../src/app');
const Question = require('../src/models/Question');
const ExamAuditLog = require('../src/models/ExamAuditLog');

const SUBJECT_TOPICS = {
  Physics: ['Mechanics', 'Waves', 'Electrostatics', 'Optics'],
  Chemistry: ['Physical Chemistry', 'Organic Chemistry', 'Inorganic Chemistry', 'Thermodynamics'],
  Biology: ['Genetics', 'Human Physiology', 'Ecology', 'Plant Biology'],
  Mathematics: ['Algebra', 'Calculus', 'Coordinate Geometry', 'Probability'],
};

const buildQuestion = ({ examType, subject, idx }) => {
  const topic = SUBJECT_TOPICS[subject][idx % SUBJECT_TOPICS[subject].length];
  const difficulty = idx % 3 === 0 ? 'Easy' : idx % 3 === 1 ? 'Medium' : 'Hard';
  return {
    examType,
    subject,
    topic,
    subtopic: `${topic} Basics`,
    difficulty,
    difficultyLevel: difficulty === 'Easy' ? 'Easy' : difficulty === 'Hard' ? 'Tough' : 'Moderate',
    yearTag: idx % 10 < 4 ? 'Previous Year' : idx % 10 < 7 ? 'Mock' : 'Conceptual',
    weightage: idx % 10 < 4 ? 'High' : idx % 10 < 8 ? 'Medium' : 'Low',
    text: `${examType} ${subject} Q${idx + 1}: Solve scenario ${idx + 1}`,
    conceptTested: `${subject} - ${topic}`,
    commonMistake: `Students rush ${topic} transformations under pressure.`,
    solvingTimeEstimate: 60 + (idx % 5) * 8,
    difficultyReason: 'Balanced exam pattern by concept depth and computational load.',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAnswerIndex: idx % 4,
    correctAnswer: ['Option A', 'Option B', 'Option C', 'Option D'][idx % 4],
    mistakeType: idx % 2 === 0 ? 'concept' : 'calculation',
    explanation: `Explanation for ${subject} ${topic} question ${idx + 1}`,
  };
};

const createExamQuestions = async ({ examType, distribution }) => {
  const docs = [];
  Object.entries(distribution).forEach(([subject, count]) => {
    for (let i = 0; i < count; i += 1) {
      docs.push(buildQuestion({ examType, subject, idx: i }));
    }
  });
  await Question.insertMany(docs);
};

const registerAndLogin = async ({ targetExam = 'NEET', email = 'examtest@example.com' } = {}) => {
  const payload = {
    name: 'Exam Tester',
    email,
    password: 'pass1234',
    targetExam,
  };

  const registerRes = await request(app).post('/api/auth/register').send(payload);
  return registerRes.body.token;
};

const buildIntentId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const submitAnswerSecurely = async ({
  token,
  sessionId,
  sessionToken,
  requestNonce,
  questionIndex,
  questionId,
  selectedAnswerIndex,
  timeTakenSec,
  intentId = buildIntentId(),
}) => request(app)
  .patch(`/api/exams/sessions/${sessionId}/answer`)
  .set('Authorization', `Bearer ${token}`)
  .set('x-exam-session-token', sessionToken)
  .set('x-exam-request-nonce', requestNonce)
  .send({
    questionIndex,
    questionId,
    selectedAnswerIndex,
    timeTakenSec,
    intentId,
  });

const startHttpServer = () => new Promise((resolve) => {
  const server = http.createServer(app);
  server.listen(0, () => resolve(server));
});

describe('Exam simulation system', () => {
  test('enforces single active session per user', async () => {
    await createExamQuestions({
      examType: 'NEET',
      distribution: {
        Physics: 60,
        Chemistry: 60,
        Biology: 120,
      },
    });

    const token = await registerAndLogin({
      targetExam: 'NEET',
      email: 'single-active@test.com',
    });

    const firstStart = await request(app)
      .post('/api/exams/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        mode: 'full-length',
        examType: 'NEET',
        strictNavigation: true,
      });

    expect(firstStart.status).toBe(201);

    const secondStart = await request(app)
      .post('/api/exams/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        mode: 'full-length',
        examType: 'NEET',
        strictNavigation: true,
      });

    expect(secondStart.status).toBe(409);
    expect(secondStart.body.message).toMatch(/active exam session already exists/i);
  });

  test('full-length mock lifecycle: strict flow, scoring, analysis, and follow-up plan', async () => {
    await createExamQuestions({
      examType: 'NEET',
      distribution: {
        Physics: 60,
        Chemistry: 60,
        Biology: 120,
      },
    });

    const token = await registerAndLogin({
      targetExam: 'NEET',
      email: 'fullmock@test.com',
    });

    const startRes = await request(app)
      .post('/api/exams/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        mode: 'full-length',
        examType: 'NEET',
        strictNavigation: true,
      });

    expect(startRes.status).toBe(201);
    expect(startRes.body.mode).toBe('full-length');
    expect(startRes.body.examType).toBe('NEET');
    expect(startRes.body.questionCount).toBe(180);
    expect(startRes.body.timeLimitSec).toBeGreaterThanOrEqual(10800);
    expect(startRes.body.behavior.hintsEnabled).toBe(false);
    expect(startRes.body.behavior.explanationsEnabled).toBe(false);
    expect(startRes.body.behavior.resultsVisibleBeforeSubmit).toBe(false);
    expect(startRes.body.behavior.modeExplanation).toMatch(/Exam mode simulates real test pressure/i);
    expect(startRes.body.questions.length).toBe(180);
    expect(startRes.body.questions[0].correctAnswer).toBeUndefined();
    expect(startRes.body.questions[0].correctAnswerIndex).toBeUndefined();
    expect(startRes.body.questions[0].yearTag).toBeDefined();
    expect(startRes.body.questions[0].difficultyLevel).toBeDefined();
    expect(startRes.body.questions[0].weightage).toBeDefined();
    expect(startRes.body.blueprintDiagnostics).toBeDefined();
    expect(startRes.body.blueprintDiagnostics.requestedCounts.Biology).toBe(90);
    expect(startRes.body.blueprintDiagnostics.actualTotal).toBe(startRes.body.questions.length);
    expect(startRes.body.blueprintDiagnostics.actualTotal).toBeGreaterThanOrEqual(54);
    expect(startRes.body.blueprintDiagnostics.pyqCount).toBeGreaterThan(0);
    expect(startRes.body.blueprintDiagnostics.pyqActual).toBeDefined();
    expect(typeof startRes.body.blueprintDiagnostics.scalingApplied).toBe('boolean');
    expect(Array.isArray(startRes.body.blueprintDiagnostics.warnings)).toBe(true);
    console.log('BLUEPRINT_DISTRIBUTION_LOG', {
      requested: startRes.body.blueprintDiagnostics.requestedCounts,
      targets: startRes.body.blueprintDiagnostics.subjectTargets,
      selectedCounts: startRes.body.blueprintDiagnostics.actualCounts,
      deficits: startRes.body.blueprintDiagnostics.deficits,
      subjectSharePct: startRes.body.blueprintDiagnostics.subjectSharePct,
      pyqSharePct: startRes.body.blueprintDiagnostics.pyqSharePct,
      warnings: startRes.body.blueprintDiagnostics.warnings,
    });

    const sessionId = startRes.body.sessionId;
    const sessionToken = startRes.body.sessionToken;
    let requestNonce = startRes.body.requestNonce;
    expect(sessionToken).toBeDefined();
    expect(requestNonce).toBeDefined();
    const firstTwenty = startRes.body.questions.slice(0, 20);
    const questionDocs = await Question.find({ _id: { $in: firstTwenty.map((q) => q._id) } }).lean();
    const correctIndexMap = new Map(questionDocs.map((q) => [String(q._id), q.correctAnswerIndex]));

    let correct = 0;
    let wrong = 0;

    for (let idx = 0; idx < firstTwenty.length; idx += 1) {
      const q = firstTwenty[idx];
      const expectedIndex = correctIndexMap.get(String(q._id));
      const selectedAnswerIndex = idx % 3 === 0 ? expectedIndex : (expectedIndex + 1) % 4;
      if (selectedAnswerIndex === expectedIndex) {
        correct += 1;
      } else {
        wrong += 1;
      }

      const answerRes = await submitAnswerSecurely({
        token,
        sessionId,
        sessionToken,
        requestNonce,
        questionIndex: idx,
        questionId: q._id,
        selectedAnswerIndex,
        timeTakenSec: 45 + (idx % 5) * 4,
      });

      expect(answerRes.status).toBe(200);
      expect(answerRes.body.responses.length).toBe(idx + 1);
      requestNonce = answerRes.body.requestNonce;
    }

    const outOfOrderRes = await submitAnswerSecurely({
      token,
      sessionId,
      sessionToken,
      requestNonce,
      questionIndex: 35,
      questionId: startRes.body.questions[35]._id,
      selectedAnswerIndex: 1,
      timeTakenSec: 60,
    });

    expect(outOfOrderRes.status).toBe(400);
    expect(outOfOrderRes.body.message).toMatch(/Strict navigation enabled/i);

    const submitRes = await request(app)
      .post(`/api/exams/sessions/${sessionId}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(submitRes.status).toBe(200);

    const expectedUnattempted = startRes.body.questions.length - (correct + wrong);
    const expectedScore = correct * 4 + wrong * -1;

    expect(submitRes.body.scoreSummary.correct).toBe(correct);
    expect(submitRes.body.scoreSummary.wrong).toBe(wrong);
    expect(submitRes.body.scoreSummary.unattempted).toBe(expectedUnattempted);
    expect(submitRes.body.scoreSummary.totalScore).toBe(expectedScore);
    expect(submitRes.body.scoreSummary.rawScore).toBe(expectedScore);
    expect(typeof submitRes.body.scoreSummary.normalizedScore).toBe('number');
    expect(submitRes.body.scoreSummary.scoring.correct).toBe(4);
    expect(submitRes.body.scoreSummary.scoring.wrong).toBe(-1);
    expect(submitRes.body.scoreSummary.scoring.unattempted).toBe(0);
    expect(submitRes.body.scoreSummary.maxScore / 4).toBe(startRes.body.questions.length);

    expect(submitRes.body.scoreSummary.percentileEstimate).toBeGreaterThan(1);
    expect(submitRes.body.scoreSummary.rankRange.low).toBeGreaterThan(0);
    expect(submitRes.body.scoreSummary.rankRange.high).toBeGreaterThanOrEqual(
      submitRes.body.scoreSummary.rankRange.low
    );

    expect(submitRes.body.postTestAnalysis.strongSubjects.length).toBeGreaterThan(0);
    expect(submitRes.body.postTestAnalysis.weakSubjects.length).toBeGreaterThan(0);
    expect(submitRes.body.postTestAnalysis.timeSpentPerSubject.length).toBeGreaterThan(0);
    expect(submitRes.body.postTestAnalysis.accuracyPerSubject.length).toBeGreaterThan(0);
    expect(submitRes.body.postTestAnalysis.improvementProjection.gainIfFixed).toBeGreaterThanOrEqual(5);
    expect(submitRes.body.postTestAnalysis.improvementProjection.message).toMatch(/score can improve by/i);
    expect(submitRes.body.scoreInterpretation.scoreBand).toBeDefined();
    expect(submitRes.body.scoreInterpretation.rankMessage).toMatch(/Likely rank range/i);
    expect(submitRes.body.scoreInterpretation.whyThisRank).toMatch(/rank = totalCandidates/i);
    expect(submitRes.body.scoreInterpretation.howScoreCompares).toMatch(/normalized/i);
    expect(['low', 'medium', 'high']).toContain(submitRes.body.scoreInterpretation.confidenceLevel);
    expect(submitRes.body.blueprintDiagnostics).toBeDefined();
    expect(submitRes.body.blueprintDiagnostics.pyqSharePct).toBeGreaterThan(0);
    console.log('MOCK_BREAKDOWN_LOG', {
      score: submitRes.body.scoreSummary,
      subjectAccuracy: submitRes.body.postTestAnalysis.accuracyPerSubject,
      yearTagMix: submitRes.body.blueprintDiagnostics.yearTagMix,
      difficultyLevelMix: submitRes.body.blueprintDiagnostics.difficultyLevelMix,
    });
    console.log('SCORE_INTERPRETATION_SAMPLE', submitRes.body.scoreInterpretation);

    expect(submitRes.body.adaptiveFollowUp.weakSubjects).toBeDefined();
    expect(submitRes.body.adaptiveFollowUp.repeatedMistakes).toBeDefined();
    expect(submitRes.body.adaptiveFollowUp.nextPracticePlan.length).toBeGreaterThan(0);
  });

  test('section-wise mode returns subject-only test with adaptive profile behavior preserved', async () => {
    await createExamQuestions({
      examType: 'CET',
      distribution: {
        Physics: 80,
        Chemistry: 80,
        Mathematics: 80,
        Biology: 80,
      },
    });

    const token = await registerAndLogin({
      targetExam: 'CET',
      email: 'sectionmode@test.com',
    });

    const startRes = await request(app)
      .post('/api/exams/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        mode: 'section-wise',
        examType: 'CET',
        sectionSubject: 'Physics',
        strictNavigation: false,
      });

    expect(startRes.status).toBe(201);
    expect(startRes.body.mode).toBe('section-wise');
    expect(startRes.body.sectionSubject).toBe('Physics');
    expect(startRes.body.questionCount).toBe(45);
    expect(startRes.body.questions.length).toBe(45);
    expect(new Set(startRes.body.questions.map((q) => q.subject))).toEqual(new Set(['Physics']));
    expect(startRes.body.strictNavigation).toBe(false);
    expect(startRes.body.behavior.hintsEnabled).toBe(false);
    expect(startRes.body.blueprintDiagnostics.requestedCounts.Physics).toBe(45);
    expect(startRes.body.blueprintDiagnostics.actualTotal).toBeGreaterThanOrEqual(14);
    expect(startRes.body.blueprintDiagnostics.pyqActual).toBeDefined();
  });

  test('gracefully degrades with shortages and still returns valid exam session', async () => {
    await createExamQuestions({
      examType: 'JEE',
      distribution: {
        Physics: 20,
        Chemistry: 18,
        Mathematics: 16,
      },
    });

    const token = await registerAndLogin({
      targetExam: 'JEE',
      email: 'graceful-shortage@test.com',
    });

    const startRes = await request(app)
      .post('/api/exams/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        mode: 'full-length',
        examType: 'JEE',
        strictNavigation: true,
      });

    expect(startRes.status).toBe(201);
    expect(startRes.body.questionCount).toBe(startRes.body.questions.length);
    expect(startRes.body.questions.length).toBeGreaterThanOrEqual(54);
    expect(startRes.body.blueprintDiagnostics).toBeDefined();
    expect(startRes.body.blueprintDiagnostics.scalingApplied).toBe(true);
    expect(Array.isArray(startRes.body.blueprintDiagnostics.warnings)).toBe(true);
    expect(startRes.body.blueprintDiagnostics.warnings.length).toBeGreaterThan(0);
    expect(startRes.body.generationNotice).toMatch(/slightly adjusted mock test/i);
    expect(startRes.body.blueprintDiagnostics.pyqActual).toBeDefined();
  });

  test('rejects duplicate answer submissions and supports idempotent final submit', async () => {
    await createExamQuestions({
      examType: 'NEET',
      distribution: {
        Physics: 60,
        Chemistry: 60,
        Biology: 120,
      },
    });

    const token = await registerAndLogin({
      targetExam: 'NEET',
      email: 'idempotent-submit@test.com',
    });

    const startRes = await request(app)
      .post('/api/exams/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        mode: 'full-length',
        examType: 'NEET',
        strictNavigation: true,
      });

    expect(startRes.status).toBe(201);
    const sessionId = startRes.body.sessionId;
    const sessionToken = startRes.body.sessionToken;
    let requestNonce = startRes.body.requestNonce;

    const firstAnswer = await submitAnswerSecurely({
      token,
      sessionId,
      sessionToken,
      requestNonce,
      questionIndex: 0,
      questionId: startRes.body.questions[0]._id,
      selectedAnswerIndex: 1,
      timeTakenSec: 10,
    });

    expect(firstAnswer.status).toBe(200);
    requestNonce = firstAnswer.body.requestNonce;

    const duplicateAnswer = await submitAnswerSecurely({
      token,
      sessionId,
      sessionToken,
      requestNonce,
      questionIndex: 0,
      questionId: startRes.body.questions[0]._id,
      selectedAnswerIndex: 2,
      timeTakenSec: 10,
    });

    expect(duplicateAnswer.status).toBe(409);
    expect(duplicateAnswer.body.message).toMatch(/duplicate answer submission|obsolete intent/i);

    const firstSubmit = await request(app)
      .post(`/api/exams/sessions/${sessionId}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(firstSubmit.status).toBe(200);

    const secondSubmit = await request(app)
      .post(`/api/exams/sessions/${sessionId}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(secondSubmit.status).toBe(200);
    expect(secondSubmit.body.sessionId).toBe(firstSubmit.body.sessionId);
    expect(secondSubmit.body.scoreSummary.totalScore).toBe(firstSubmit.body.scoreSummary.totalScore);

    const auditCount = await ExamAuditLog.countDocuments({ sessionId });
    expect(auditCount).toBeGreaterThan(0);
  });

  test('serializes rapid clicks so only the latest answer survives and stale nonce replays fail', async () => {
    await createExamQuestions({
      examType: 'NEET',
      distribution: {
        Physics: 60,
        Chemistry: 60,
        Biology: 120,
      },
    });

    const token = await registerAndLogin({
      targetExam: 'NEET',
      email: 'rapid-clicks@test.com',
    });

    const startRes = await request(app)
      .post('/api/exams/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        mode: 'full-length',
        examType: 'NEET',
        strictNavigation: false,
      });

    expect(startRes.status).toBe(201);

    const server = await startHttpServer();
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}/api`;

    try {
      const sessionToken = startRes.body.sessionToken;
      const initialNonce = startRes.body.requestNonce;
      const [firstQuestion, secondQuestion] = startRes.body.questions.slice(0, 2);

      const firstController = new AbortController();
      const firstRequest = fetch(`${baseUrl}/exams/sessions/${startRes.body.sessionId}/answer`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-exam-session-token': sessionToken,
          'x-exam-request-nonce': initialNonce,
        },
        body: JSON.stringify({
          questionIndex: 0,
          questionId: firstQuestion._id,
          selectedAnswerIndex: 0,
          timeTakenSec: 10,
          intentId: buildIntentId(),
        }),
        signal: firstController.signal,
      });

      firstController.abort();

      let firstAborted = false;
      try {
        await firstRequest;
      } catch (error) {
        firstAborted = error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
      }
      expect(firstAborted).toBe(true);

      const refreshedAfterAbort = await request(app)
        .get(`/api/exams/sessions/${startRes.body.sessionId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(refreshedAfterAbort.status).toBe(200);

      const latestNonce = refreshedAfterAbort.body.requestNonce || initialNonce;
      const answerRes = await fetch(`${baseUrl}/exams/sessions/${startRes.body.sessionId}/answer`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-exam-session-token': sessionToken,
          'x-exam-request-nonce': latestNonce,
        },
        body: JSON.stringify({
          questionIndex: 1,
          questionId: secondQuestion._id,
          selectedAnswerIndex: 2,
          timeTakenSec: 12,
          intentId: buildIntentId(),
        }),
      });

      expect(answerRes.status).toBe(200);
      const answerBody = await answerRes.json();
      expect(answerBody.requestNonce).toBeDefined();

      const replayRes = await fetch(`${baseUrl}/exams/sessions/${startRes.body.sessionId}/answer`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-exam-session-token': sessionToken,
          'x-exam-request-nonce': latestNonce,
        },
        body: JSON.stringify({
          questionIndex: 1,
          questionId: secondQuestion._id,
          selectedAnswerIndex: 3,
          timeTakenSec: 12,
          intentId: buildIntentId(),
        }),
      });

      expect([400, 401, 409, 429]).toContain(replayRes.status);

      const finalState = await request(app)
        .get(`/api/exams/sessions/${startRes.body.sessionId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(finalState.status).toBe(200);
      const question0Answer = finalState.body.responses.find((entry) => entry.questionIndex === 0);
      const question1Answer = finalState.body.responses.find((entry) => entry.questionIndex === 1);

      expect(question0Answer).toBeUndefined();
      expect(question1Answer?.selectedAnswerIndex).toBe(2);
      expect(finalState.body.requestNonce).toBe(answerBody.requestNonce);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
