const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const request = require('supertest');

const app = require('../src/app');
const Attempt = require('../src/models/Attempt');
const Mistake = require('../src/models/Mistake');
const Question = require('../src/models/Question');
const Performance = require('../src/models/Performance');
const { analyzePerformance } = require('../src/services/analysisService');
const { getAdaptiveAnalytics } = require('../src/services/analyticsService');
const {
  classifyMistake,
  buildWhyGotWrong,
  buildImprovementTip,
  buildConfidenceInsight,
} = require('../src/services/feedbackService');
const {
  evaluateAdaptiveDifficulty,
  computeDifficultyScore,
} = require('../src/services/adaptiveDifficultyService');
const { getRecommendedQuestions } = require('../src/services/recommendationService');

const createQuestion = async (overrides = {}) => {
  const payload = {
    examType: 'JEE',
    subject: 'Mathematics',
    topic: 'Algebra',
    subtopic: 'Linear Equations',
    difficulty: 'Medium',
    text: `Q-${Math.random().toString(36).slice(2)}: Solve for x`,
    conceptTested: 'Algebra - Linear Equations',
    commonMistake: 'Students often swap signs when moving terms across equals.',
    solvingTimeEstimate: 60,
    difficultyReason: 'Requires two-step symbolic manipulation and sign care.',
    options: ['1', '2', '3', '4'],
    correctAnswer: '2',
    correctAnswerIndex: 1,
    mistakeType: 'concept',
    explanation:
      'Identify the linear form, isolate x by balancing both sides, verify by substitution, and reject options that fail the original equation.',
    ...overrides,
  };

  return Question.create(payload);
};

const registerUser = async ({
  name = 'Validator User',
  email = `validator_${Math.random().toString(36).slice(2)}@test.com`,
  password = 'pass1234',
  targetExam = 'JEE',
} = {}) => {
  const res = await request(app).post('/api/auth/register').send({
    name,
    email,
    password,
    targetExam,
  });

  return {
    token: res.body.token,
    userId: res.body.user._id,
    user: res.body.user,
  };
};

const authPost = (token, url, body) =>
  request(app).post(url).set('Authorization', `Bearer ${token}`).send(body);

const authGet = (token, url) => request(app).get(url).set('Authorization', `Bearer ${token}`);

describe('Intelligence Refactor Strict Behavioral Validation', () => {
  test('1) analytics integrity and responsibility coverage', async () => {
    const userId = new mongoose.Types.ObjectId();

    const weakQuestion = await createQuestion({
      topic: 'Algebra',
      subtopic: 'Linear Equations',
      conceptTested: 'Algebra - Linear Equations',
      options: ['1', '2', '3', '4'],
      correctAnswer: '2',
      correctAnswerIndex: 1,
    });

    const strongQuestion = await createQuestion({
      topic: 'Calculus',
      subtopic: 'Differentiation',
      conceptTested: 'Calculus - Differentiation',
      options: ['5', '6', '7', '8'],
      correctAnswer: '6',
      correctAnswerIndex: 1,
    });

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    await Attempt.insertMany([
      {
        user: userId,
        question: weakQuestion._id,
        subject: 'Mathematics',
        topic: 'Algebra',
        subtopic: 'Linear Equations',
        conceptTested: 'Algebra - Linear Equations',
        difficulty: 'Medium',
        selectedAnswerIndex: 0,
        isCorrect: false,
        timeTakenSec: 95,
        expectedSolvingTimeSec: 60,
        responsePace: 'slow',
        adaptiveDifficultyBefore: 'Medium',
        adaptiveDifficultyAfter: 'Easy',
        createdAt: new Date(now - 2 * day),
      },
      {
        user: userId,
        question: weakQuestion._id,
        subject: 'Mathematics',
        topic: 'Algebra',
        subtopic: 'Linear Equations',
        conceptTested: 'Algebra - Linear Equations',
        difficulty: 'Medium',
        selectedAnswerIndex: 3,
        isCorrect: false,
        timeTakenSec: 100,
        expectedSolvingTimeSec: 60,
        responsePace: 'slow',
        adaptiveDifficultyBefore: 'Easy',
        adaptiveDifficultyAfter: 'Easy',
        createdAt: new Date(now - day),
      },
      {
        user: userId,
        question: strongQuestion._id,
        subject: 'Mathematics',
        topic: 'Calculus',
        subtopic: 'Differentiation',
        conceptTested: 'Calculus - Differentiation',
        difficulty: 'Medium',
        selectedAnswerIndex: 1,
        isCorrect: true,
        timeTakenSec: 40,
        expectedSolvingTimeSec: 60,
        responsePace: 'fast',
        adaptiveDifficultyBefore: 'Medium',
        adaptiveDifficultyAfter: 'Hard',
        createdAt: new Date(now - 2 * day),
      },
      {
        user: userId,
        question: strongQuestion._id,
        subject: 'Mathematics',
        topic: 'Calculus',
        subtopic: 'Differentiation',
        conceptTested: 'Calculus - Differentiation',
        difficulty: 'Medium',
        selectedAnswerIndex: 1,
        isCorrect: true,
        timeTakenSec: 35,
        expectedSolvingTimeSec: 60,
        responsePace: 'fast',
        adaptiveDifficultyBefore: 'Hard',
        adaptiveDifficultyAfter: 'Hard',
        createdAt: new Date(now),
      },
    ]);

    const analysis = await analyzePerformance(userId);
    const analytics = await getAdaptiveAnalytics(userId);

    console.log('ANALYTICS_INTEGRITY_LOG', {
      hasWeakTopicPriority: analytics.weakTopicPriority.length > 0,
      suggestedFocusTopic: analytics.suggestedFocusTopic,
      currentStreak: analytics.habit.currentStreak,
      nextAction: analytics.nextAction,
      weakTopics: analysis.weakTopics,
      strongTopics: analysis.strongTopics,
      improvementInsight: analytics.improvementInsight,
    });

    console.log('WEEKLY_REPORT_SAMPLE', analytics.studentInsightLayer.weeklyPerformanceReport);
    console.log('STUDY_PLAN_SAMPLE', analytics.studentInsightLayer.studyStrategy);
    console.log('BEHAVIOR_INSIGHT_SAMPLE', analytics.studentInsightLayer.behaviorAnalysis);

    expect(analysis.weakTopics.some((entry) => entry.includes('Algebra'))).toBe(true);
    expect(analysis.strongTopics.some((entry) => entry.includes('Calculus'))).toBe(true);
    expect(analytics.habit).toHaveProperty('currentStreak');
    expect(analytics.nextAction).toHaveProperty('reason');
    expect(analytics.improvementInsight).toHaveProperty('text');
    expect(analytics.suggestedFocusTopic).toBeTruthy();
    expect(analytics.studentInsightLayer).toHaveProperty('weeklyPerformanceReport');
    expect(analytics.studentInsightLayer).toHaveProperty('studyStrategy');
    expect(analytics.studentInsightLayer).toHaveProperty('behaviorAnalysis');
    expect(analytics.studentInsightLayer).toHaveProperty('consistencyScore');
    expect(analytics.studentInsightLayer).toHaveProperty('improvementTrajectory');
    expect(Array.isArray(analytics.studentInsightLayer.mentorVoice)).toBe(true);
  });

  test('2) adaptive feedback quality differs by mistake type', async () => {
    const base = {
      isCorrect: false,
      topic: 'Algebra',
      conceptTested: 'Algebra - Linear Equations',
      expectedTimeSec: 60,
      commonMistakePattern: '',
    };

    const conceptType = classifyMistake({
      ...base,
      timeTakenSec: 70,
      selectedAnswerText: 'Option A conceptual distractor',
      repeatedMistakeCount: 3,
      questionCommonMistake: 'Students misread conceptual constraints.',
    });

    const calcType = classifyMistake({
      ...base,
      timeTakenSec: 68,
      selectedAnswerText: '13',
      repeatedMistakeCount: 0,
      questionCommonMistake: 'Calculation and arithmetic sign issues are common.',
    });

    const guessType = classifyMistake({
      ...base,
      timeTakenSec: 8,
      selectedAnswerText: '2',
      repeatedMistakeCount: 0,
      questionCommonMistake: 'Rushing causes random choices.',
    });

    const conceptWhy = buildWhyGotWrong({
      ...base,
      mistakeType: conceptType,
      selectedAnswerText: 'Option A conceptual distractor',
    });
    const calcWhy = buildWhyGotWrong({
      ...base,
      mistakeType: calcType,
      selectedAnswerText: '13',
    });
    const guessWhy = buildWhyGotWrong({
      ...base,
      mistakeType: guessType,
      selectedAnswerText: '2',
    });

    const conceptTip = buildImprovementTip({
      ...base,
      difficulty: 'Medium',
      timeTakenSec: 70,
      selectedAnswerText: 'Option A conceptual distractor',
      mistakeType: conceptType,
    });
    const calcTip = buildImprovementTip({
      ...base,
      difficulty: 'Medium',
      timeTakenSec: 68,
      selectedAnswerText: '13',
      mistakeType: calcType,
    });
    const guessTip = buildImprovementTip({
      ...base,
      difficulty: 'Medium',
      timeTakenSec: 8,
      selectedAnswerText: '2',
      mistakeType: guessType,
    });

    console.log('FEEDBACK_DIFFERENTIATION_LOG', {
      concept: { type: conceptType, why: conceptWhy, tip: conceptTip },
      calculation: { type: calcType, why: calcWhy, tip: calcTip },
      guess: { type: guessType, why: guessWhy, tip: guessTip },
    });

    expect(conceptType).toBe('Concept Error');
    expect(calcType).toBe('Calculation Error');
    expect(guessType).toBe('Careless Mistake');

    expect(new Set([conceptWhy, calcWhy, guessWhy]).size).toBe(3);
    expect(new Set([conceptTip, calcTip, guessTip]).size).toBe(3);
  });

  test('3) adaptive difficulty behavior is smooth and predictable', async () => {
    const runFlow = (label, steps) => {
      let currentDifficulty = 'Medium';
      const logs = [];

      steps.forEach((step, index) => {
        const score = computeDifficultyScore({
          topicAccuracy: step.topicAccuracy,
          timeTakenSec: step.timeTakenSec,
          expectedTimeSec: step.expectedTimeSec,
          recentStreak: step.recentStreak,
          mistakeFrequency: step.mistakeFrequency,
        });

        const next = evaluateAdaptiveDifficulty({
          currentDifficulty,
          topicAccuracy: step.topicAccuracy,
          isCorrect: step.isCorrect,
          timeTakenSec: step.timeTakenSec,
          expectedTimeSec: step.expectedTimeSec,
          recentStreak: step.recentStreak,
          mistakeFrequency: step.mistakeFrequency,
        });

        logs.push({
          step: index + 1,
          inputAccuracy: step.topicAccuracy,
          isCorrect: step.isCorrect,
          score,
          from: currentDifficulty,
          to: next,
        });

        currentDifficulty = next;
      });

      console.log(`ADAPTIVE_DIFFICULTY_${label}`, logs);
      return currentDifficulty;
    };

    const fiveCorrectFinal = runFlow(
      'FIVE_CORRECT',
      Array.from({ length: 5 }).map((_, idx) => ({
        topicAccuracy: 78 + idx * 3,
        isCorrect: true,
        timeTakenSec: 35,
        expectedTimeSec: 60,
        recentStreak: idx + 1,
        mistakeFrequency: 0,
      }))
    );

    const fiveWrongFinal = runFlow(
      'FIVE_WRONG',
      Array.from({ length: 5 }).map((_, idx) => ({
        topicAccuracy: 45 - idx * 4,
        isCorrect: false,
        timeTakenSec: 95,
        expectedTimeSec: 60,
        recentStreak: 0,
        mistakeFrequency: 5,
      }))
    );

    const mixedFinal = runFlow('MIXED', [
      { topicAccuracy: 60, isCorrect: true, timeTakenSec: 60, expectedTimeSec: 60, recentStreak: 1, mistakeFrequency: 1 },
      { topicAccuracy: 58, isCorrect: false, timeTakenSec: 65, expectedTimeSec: 60, recentStreak: 0, mistakeFrequency: 1 },
      { topicAccuracy: 61, isCorrect: true, timeTakenSec: 58, expectedTimeSec: 60, recentStreak: 1, mistakeFrequency: 1 },
      { topicAccuracy: 59, isCorrect: false, timeTakenSec: 63, expectedTimeSec: 60, recentStreak: 0, mistakeFrequency: 1 },
      { topicAccuracy: 62, isCorrect: true, timeTakenSec: 60, expectedTimeSec: 60, recentStreak: 1, mistakeFrequency: 1 },
    ]);

    expect(fiveCorrectFinal).toBe('Hard');
    expect(fiveWrongFinal).toBe('Easy');
    expect(['Medium', 'Easy', 'Hard']).toContain(mixedFinal);
  });

  test('4) recommendation priority and rationale quality', async () => {
    const userId = new mongoose.Types.ObjectId();

    const weakOldQuestion = await createQuestion({
      topic: 'Algebra',
      subtopic: 'Linear Equations',
      conceptTested: 'Algebra - Linear Equations',
      text: 'Weak old topic attempted question',
    });

    await createQuestion({
      topic: 'Algebra',
      subtopic: 'Linear Equations',
      conceptTested: 'Algebra - Linear Equations',
      text: 'Weak old topic fresh candidate question',
    });

    const weakRecentQuestion = await createQuestion({
      topic: 'Algebra',
      subtopic: 'Expressions',
      conceptTested: 'Algebra - Expressions',
      text: 'Weak recent topic attempted question',
    });

    await createQuestion({
      topic: 'Algebra',
      subtopic: 'Expressions',
      conceptTested: 'Algebra - Expressions',
      text: 'Weak recent topic fresh candidate question',
    });

    const mistakeQuestion = await createQuestion({
      topic: 'Probability',
      subtopic: 'Events',
      conceptTested: 'Probability - Events',
      text: 'Mistake review question',
    });

    await createQuestion({
      topic: 'Trigonometry',
      subtopic: 'Identities',
      conceptTested: 'Trigonometry - Identities',
      text: 'New topic candidate',
    });

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    await Attempt.insertMany([
      {
        user: userId,
        question: weakOldQuestion._id,
        subject: 'Mathematics',
        topic: 'Algebra',
        subtopic: 'Linear Equations',
        conceptTested: 'Algebra - Linear Equations',
        difficulty: 'Medium',
        selectedAnswerIndex: 0,
        isCorrect: false,
        timeTakenSec: 90,
        expectedSolvingTimeSec: 60,
        responsePace: 'slow',
        adaptiveDifficultyBefore: 'Medium',
        adaptiveDifficultyAfter: 'Easy',
        createdAt: new Date(now - 12 * day),
      },
      {
        user: userId,
        question: weakRecentQuestion._id,
        subject: 'Mathematics',
        topic: 'Algebra',
        subtopic: 'Expressions',
        conceptTested: 'Algebra - Expressions',
        difficulty: 'Medium',
        selectedAnswerIndex: 0,
        isCorrect: false,
        timeTakenSec: 90,
        expectedSolvingTimeSec: 60,
        responsePace: 'slow',
        adaptiveDifficultyBefore: 'Medium',
        adaptiveDifficultyAfter: 'Easy',
        createdAt: new Date(now - 1 * day),
      },
    ]);

    await Mistake.create({
      user: userId,
      question: mistakeQuestion._id,
      subject: 'Mathematics',
      topic: 'Probability',
      subtopic: 'Events',
      conceptTested: 'Probability - Events',
      difficulty: 'Medium',
      mistakeType: 'Concept Error',
      selectedAnswerIndex: 0,
      selectedAnswerText: 'Wrong',
      timeTakenSec: 75,
      expectedTimeSec: 60,
      timeDeltaSec: 15,
      isSlowCorrect: false,
      repetitionStage: 0,
      nextReviewAt: new Date(now - 2 * day),
      retryCount: 1,
      improvedOnRetry: false,
      resolved: false,
      lastAttemptCorrect: false,
      lastReviewedAt: new Date(now - 2 * day),
    });

    const result = await getRecommendedQuestions({
      userId,
      targetExam: 'JEE',
      limit: 10,
    });

    const reasons = result.recommendations.map((r) => r.recommendationReason);

    console.log('RECOMMENDATION_ENGINE_LOG', {
      priorityOrder: result.priorityOrder,
      reasons,
      top3: result.recommendations.slice(0, 3).map((r) => ({
        topic: `${r.subject}-${r.topic}-${r.subtopic}`,
        reason: r.recommendationReason,
        why: r.reason,
      })),
    });

    expect(result.priorityOrder).toEqual(['weak-topic', 'mistake-review', 'new-topic']);
    expect(reasons).toContain('weak-topic');
    expect(reasons).toContain('mistake-review');
    expect(reasons).toContain('new-topic');

    const weakEntries = result.recommendations.filter((r) => r.recommendationReason === 'weak-topic');
    if (weakEntries.length > 1) {
      expect(weakEntries[0].subtopic).toBe('Linear Equations');
    }

    result.recommendations.forEach((rec) => {
      expect(typeof rec.reason).toBe('string');
      expect(rec.reason.length).toBeGreaterThan(20);
      expect(rec.reason).not.toBe('Selected to keep your session balanced.');
    });
  });

  test('5) seed data quality from DB sample of 50', async () => {
    const seedDir = path.join(__dirname, '..', 'src', 'data', 'question-seeds');
    const files = fs.readdirSync(seedDir).filter((name) => name.endsWith('.json'));

    const docs = files.flatMap((file) => {
      const content = fs.readFileSync(path.join(seedDir, file), 'utf8');
      return JSON.parse(content);
    });

    await Question.insertMany(docs);

    const sample = await Question.aggregate([{ $sample: { size: 50 } }]);

    const issues = [];
    sample.forEach((q) => {
      if (!q.conceptTested || !q.subtopic) issues.push(`missing concept/subtopic: ${q._id}`);
      if (!q.explanation || q.explanation.length < 80) issues.push(`shallow explanation: ${q._id}`);
      if (typeof q.solvingTimeEstimate !== 'number' || q.solvingTimeEstimate < 20 || q.solvingTimeEstimate > 180) {
        issues.push(`unrealistic solvingTimeEstimate: ${q._id}`);
      }
    });

    console.log('SEED_QUALITY_LOG', {
      sampled: sample.length,
      issuesCount: issues.length,
      examples: sample.slice(0, 3).map((q) => ({
        topic: q.topic,
        conceptTested: q.conceptTested,
        solvingTimeEstimate: q.solvingTimeEstimate,
        explanationLen: (q.explanation || '').length,
      })),
    });

    expect(sample.length).toBe(50);
    expect(issues).toEqual([]);
  });

  test('6) end-to-end user flow: practice -> mistakes -> recommendations -> next session analytics', async () => {
    const { token, userId } = await registerUser({ targetExam: 'JEE' });

    const q = await createQuestion({
      topic: 'Probability',
      subtopic: 'Events',
      conceptTested: 'Probability - Events',
      difficulty: 'Medium',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'B',
      correctAnswerIndex: 1,
      solvingTimeEstimate: 60,
      commonMistake: 'Students confuse dependent and independent event logic.',
    });

    await authPost(token, '/api/attempts', {
      questionId: String(q._id),
      selectedAnswerIndex: 0,
      timeTakenSec: 72,
      sessionId: 's1',
      questionIndex: 1,
      totalQuestions: 4,
      sessionMode: 'practice',
    });

    let mistakes = await Mistake.find({ user: userId }).sort({ createdAt: -1 });
    expect(mistakes.length).toBeGreaterThan(0);
    expect(mistakes[0].repetitionStage).toBe(0);

    await authPost(token, '/api/attempts', {
      questionId: String(q._id),
      selectedAnswerIndex: 1,
      timeTakenSec: 55,
      sessionId: 's1',
      questionIndex: 2,
      totalQuestions: 4,
      sessionMode: 'practice',
    });
    mistakes = await Mistake.find({ user: userId, question: q._id, resolved: false }).sort({ createdAt: -1 });
    expect(mistakes[0].repetitionStage).toBe(1);

    await authPost(token, '/api/attempts', {
      questionId: String(q._id),
      selectedAnswerIndex: 1,
      timeTakenSec: 50,
      sessionId: 's1',
      questionIndex: 3,
      totalQuestions: 4,
      sessionMode: 'practice',
    });
    mistakes = await Mistake.find({ user: userId, question: q._id, resolved: false }).sort({ createdAt: -1 });
    expect(mistakes[0].repetitionStage).toBe(2);

    await authPost(token, '/api/attempts', {
      questionId: String(q._id),
      selectedAnswerIndex: 1,
      timeTakenSec: 48,
      sessionId: 's1',
      questionIndex: 4,
      totalQuestions: 4,
      sessionMode: 'practice',
    });

    const resolvedMistakes = await Mistake.find({ user: userId, question: q._id, resolved: true });
    expect(resolvedMistakes.length).toBeGreaterThan(0);

    const openMistake = await Mistake.create({
      user: userId,
      question: q._id,
      subject: 'Mathematics',
      topic: 'Probability',
      subtopic: 'Events',
      conceptTested: 'Probability - Events',
      difficulty: 'Medium',
      mistakeType: 'Concept Error',
      selectedAnswerIndex: 0,
      selectedAnswerText: 'A',
      timeTakenSec: 80,
      expectedTimeSec: 60,
      timeDeltaSec: 20,
      isSlowCorrect: false,
      repetitionStage: 1,
      nextReviewAt: new Date(Date.now() - 3600 * 1000),
      retryCount: 2,
      improvedOnRetry: false,
      resolved: false,
      lastAttemptCorrect: false,
      lastReviewedAt: new Date(Date.now() - 3600 * 1000),
    });

    const recommendationResponse = await authGet(token, '/api/recommendations/me');
    const analyticsResponse = await authGet(token, '/api/analytics/me');
    const mistakeBankResponse = await authGet(token, '/api/attempts/mistake-bank');

    console.log('E2E_SYSTEM_LOG', {
      openDueMistake: {
        id: String(openMistake._id),
        repetitionStage: openMistake.repetitionStage,
        nextReviewAt: openMistake.nextReviewAt,
      },
      recommendationReasons: recommendationResponse.body.recommendations?.map((r) => r.recommendationReason),
      nextAction: analyticsResponse.body.nextAction,
      habit: analyticsResponse.body.habit,
      mistakeBankSummary: mistakeBankResponse.body.summary,
    });

    expect(recommendationResponse.status).toBe(200);
    expect(analyticsResponse.status).toBe(200);
    expect(mistakeBankResponse.status).toBe(200);

    expect((mistakeBankResponse.body.summary?.totalMistakes || 0)).toBeGreaterThan(0);
    expect(analyticsResponse.body.habit).toHaveProperty('currentStreak');
    expect(analyticsResponse.body.nextAction).toHaveProperty('label');
    expect(analyticsResponse.body.nextAction).toHaveProperty('reason');
  });
});
