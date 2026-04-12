const request = require('supertest');
const app = require('../src/app');
const Question = require('../src/models/Question');

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

describe('Exam simulation system', () => {
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
    expect(startRes.body.blueprintDiagnostics.subjectTargets.Biology).toBe(90);
    expect(startRes.body.blueprintDiagnostics.pyqCount).toBeGreaterThan(0);
    console.log('BLUEPRINT_DISTRIBUTION_LOG', {
      targets: startRes.body.blueprintDiagnostics.subjectTargets,
      selectedCounts: startRes.body.blueprintDiagnostics.selectedSubjectCounts,
      subjectSharePct: startRes.body.blueprintDiagnostics.subjectSharePct,
      pyqSharePct: startRes.body.blueprintDiagnostics.pyqSharePct,
    });

    const sessionId = startRes.body.sessionId;
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

      const answerRes = await request(app)
        .patch(`/api/exams/sessions/${sessionId}/answer`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionIndex: idx,
          selectedAnswerIndex,
          timeTakenSec: 45 + (idx % 5) * 4,
        });

      expect(answerRes.status).toBe(200);
      expect(answerRes.body.responses.length).toBe(idx + 1);
    }

    const outOfOrderRes = await request(app)
      .patch(`/api/exams/sessions/${sessionId}/answer`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        questionIndex: 35,
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

    const expectedUnattempted = 180 - (correct + wrong);
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
    expect(startRes.body.blueprintDiagnostics.subjectTargets.Physics).toBe(45);
  });
});
