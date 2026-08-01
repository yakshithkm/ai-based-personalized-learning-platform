const mongoose = require('mongoose');
const request = require('supertest');

const app = require('../src/app');
const Attempt = require('../src/models/Attempt');
const Mistake = require('../src/models/Mistake');
const Question = require('../src/models/Question');
const { getRecommendedQuestions } = require('../src/services/recommendationService');
const { getAdaptiveAnalytics } = require('../src/services/analyticsService');
const {
  buildImprovementTip,
  buildWhyGotWrong,
  classifyMistake,
} = require('../src/services/feedbackService');

const TOPIC_BANK = [
  ['Mathematics', 'Algebra', 'Linear Equations'],
  ['Mathematics', 'Calculus', 'Differentiation'],
  ['Mathematics', 'Probability', 'Events'],
  ['Mathematics', 'Trigonometry', 'Identities'],
  ['Mathematics', 'Geometry', 'Circles'],
  ['Mathematics', 'Coordinate Geometry', 'Straight Lines'],
];

const createQuestion = async (overrides = {}) => {
  const payload = {
    examType: 'JEE',
    subject: 'Mathematics',
    topic: 'Algebra',
    subtopic: 'Linear Equations',
    difficulty: 'Medium',
    text: `Adversarial Q-${Math.random().toString(36).slice(2)}`,
    conceptTested: 'Algebra - Linear Equations',
    commonMistake: 'Students misread constraints and rush symbolic transformations.',
    solvingTimeEstimate: 60,
    difficultyReason: 'Requires two-step reasoning and distractor elimination.',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'B',
    correctAnswerIndex: 1,
    mistakeType: 'concept',
    explanation:
      'Start from the defining condition, isolate the changing variable carefully, verify each option against the original condition, and reject numerically plausible but logically invalid distractors.',
    ...overrides,
  };

  return Question.create(payload);
};

const createQuestionBank = async ({ perTopic = 10 } = {}) => {
  const questions = [];
  let i = 0;

  for (const [subject, topic, subtopic] of TOPIC_BANK) {
    for (let k = 0; k < perTopic; k += 1) {
      i += 1;
      const difficulty = i % 3 === 0 ? 'Hard' : i % 2 === 0 ? 'Medium' : 'Easy';
      const correctAnswerIndex = i % 4;
      const options = ['11', '22', '33', '44'];
      const conceptTested = `${topic} - ${subtopic}`;
      const q = await createQuestion({
        subject,
        topic,
        subtopic,
        conceptTested,
        text: `${topic}/${subtopic} item ${i}`,
        difficulty,
        options,
        correctAnswer: options[correctAnswerIndex],
        correctAnswerIndex,
        solvingTimeEstimate: difficulty === 'Hard' ? 95 : difficulty === 'Medium' ? 70 : 45,
      });
      questions.push(q);
    }
  }

  return questions;
};

const registerUser = async ({
  name = 'Adversarial User',
  email = `adversarial_${Math.random().toString(36).slice(2)}@test.com`,
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
  };
};

const submitAttempt = async ({ token, questionId, selectedAnswerIndex, timeTakenSec = 60 }) => {
  return request(app)
    .post('/api/attempts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      questionId: String(questionId),
      selectedAnswerIndex,
      timeTakenSec,
      sessionId: 'adversarial-session',
      questionIndex: 1,
      totalQuestions: 1,
      sessionMode: 'practice',
    });
};

const recommendationSignature = (recs = []) =>
  recs.slice(0, 5).map((r) => `${r.topic}/${r.subtopic}/${r._id}`).join('|');

const sampleItems = (items, size) => {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, size);
};

describe('Adversarial and Long-Horizon Intelligence Testing', () => {
  test('1A) guess-heavy user: detect guessing and avoid escalation', async () => {
    const questions = await createQuestionBank({ perTopic: 8 });
    const { token, userId } = await registerUser();

    const logs = [];

    for (let i = 0; i < 18; i += 1) {
      const q = questions[i % questions.length];
      const randomWrong = (q.correctAnswerIndex + 1 + (i % 3)) % 4;
      const res = await submitAttempt({
        token,
        questionId: q._id,
        selectedAnswerIndex: randomWrong,
        timeTakenSec: 7 + (i % 4),
      });

      logs.push({
        isCorrect: res.body.result?.isCorrect,
        confidenceInsight: res.body.result?.confidenceInsight,
        mistakeClassification: res.body.result?.mistakeClassification,
        improvementTip: res.body.result?.improvementTip,
      });
    }

    const recs = await getRecommendedQuestions({ userId, targetExam: 'JEE', limit: 10 });

    const guessSignals = logs.filter((l) => l.confidenceInsight === 'likely-guess').length;
    const carelessMistakes = logs.filter((l) => l.mistakeClassification === 'Careless Mistake').length;
    const hardRecs = recs.recommendations.filter((r) => r.difficulty === 'Hard').length;

    console.log('ADVERSARIAL_GUESS_HEAVY_LOG', {
      totalAttempts: logs.length,
      guessSignals,
      carelessMistakes,
      hardRecommendations: hardRecs,
      recommendationReasons: recs.recommendations.map((r) => r.recommendationReason),
    });

    expect(guessSignals).toBeGreaterThanOrEqual(12);
    expect(carelessMistakes).toBeGreaterThanOrEqual(10);
    expect(hardRecs).toBeLessThanOrEqual(1);
  });

  test('1B) overconfident but wrong: explicit misconception callout and corrective recs', async () => {
    const questions = await createQuestionBank({ perTopic: 8 });
    const { token, userId } = await registerUser();

    const targetConceptQuestions = questions.filter((q) => q.topic === 'Algebra').slice(0, 8);
    const logs = [];

    for (let i = 0; i < targetConceptQuestions.length; i += 1) {
      const q = targetConceptQuestions[i];
      const wrongIndex = (q.correctAnswerIndex + 1) % 4;
      const res = await submitAttempt({
        token,
        questionId: q._id,
        selectedAnswerIndex: wrongIndex,
        timeTakenSec: 20,
      });

      logs.push({
        why: res.body.result?.whyGotWrong,
        classification: res.body.result?.mistakeClassification,
        actionableFix: res.body.result?.actionableFix,
        correctivePressureActive: res.body.result?.correctivePressureActive,
        correctivePressureMessage: res.body.result?.correctivePressureMessage,
      });
    }

    const recs = await getRecommendedQuestions({ userId, targetExam: 'JEE', limit: 10 });

    const misconceptionCalls = logs.filter((l) => /misconception|concept/i.test(l.why || '')).length;
    const correctiveRecommendations = recs.recommendations.filter((r) =>
      ['weak-topic', 'mistake-review'].includes(r.recommendationReason)
    ).length;
    const correctivePressureTriggers = logs.filter((l) => l.correctivePressureActive).length;

    console.log('ADVERSARIAL_OVERCONFIDENT_WRONG_LOG', {
      misconceptionCalls,
      correctiveRecommendations,
      correctivePressureTriggers,
      correctivePressureMessages: logs
        .filter((l) => l.correctivePressureMessage)
        .map((l) => l.correctivePressureMessage)
        .slice(0, 2),
      recommendationReasons: recs.recommendations.map((r) => r.recommendationReason),
      whySamples: logs.slice(0, 3).map((l) => l.why),
    });

    expect(misconceptionCalls).toBeGreaterThanOrEqual(5);
    expect(correctiveRecommendations).toBeGreaterThanOrEqual(4);
    expect(correctivePressureTriggers).toBeGreaterThanOrEqual(2);
  });

  test('1C) inconsistent user: no aggressive oscillation', async () => {
    const questions = await createQuestionBank({ perTopic: 8 });
    const { token } = await registerUser();

    const sequence = [];
    for (let i = 0; i < 16; i += 1) {
      const q = questions[i % 4];
      const isCorrect = i % 2 === 0;
      const selectedAnswerIndex = isCorrect ? q.correctAnswerIndex : (q.correctAnswerIndex + 1) % 4;
      const res = await submitAttempt({
        token,
        questionId: q._id,
        selectedAnswerIndex,
        timeTakenSec: 55 + (i % 6),
      });

      sequence.push(res.body.adaptive?.nextDifficulty || 'Medium');
    }

    let flips = 0;
    for (let i = 1; i < sequence.length; i += 1) {
      if (sequence[i] !== sequence[i - 1]) flips += 1;
    }

    console.log('ADVERSARIAL_INCONSISTENT_USER_LOG', {
      sequence,
      flips,
    });

    expect(flips).toBeLessThanOrEqual(7);
  });

  test('1D) one-topic spammer: force exploration or flag imbalance', async () => {
    const questions = await createQuestionBank({ perTopic: 10 });
    const { token, userId } = await registerUser();

    const algebraOnly = questions.filter((q) => q.topic === 'Algebra').slice(0, 12);

    for (let i = 0; i < algebraOnly.length; i += 1) {
      const q = algebraOnly[i];
      await submitAttempt({
        token,
        questionId: q._id,
        selectedAnswerIndex: q.correctAnswerIndex,
        timeTakenSec: 42,
      });
    }

    const recs = await getRecommendedQuestions({ userId, targetExam: 'JEE', limit: 10 });
    const analytics = await getAdaptiveAnalytics(userId);

    const outsideTopicCount = recs.recommendations.filter((r) => r.topic !== 'Algebra').length;

    console.log('ADVERSARIAL_ONE_TOPIC_SPAM_LOG', {
      outsideTopicCount,
      recommendationTopics: recs.recommendations.map((r) => r.topic),
      nextAction: analytics.nextAction,
      focusToday: analytics.focusToday,
    });

    expect(outsideTopicCount).toBeGreaterThanOrEqual(2);
  });

  test('2) long-horizon 45-day simulation: evolution, resurfacing, no dead topics', async () => {
    const userId = new mongoose.Types.ObjectId();
    const questions = await createQuestionBank({ perTopic: 12 });
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const byTopic = new Map();
    questions.forEach((q) => {
      const key = `${q.topic}/${q.subtopic}`;
      if (!byTopic.has(key)) byTopic.set(key, []);
      byTopic.get(key).push(q);
    });

    const topicKeys = Array.from(byTopic.keys());
    const missedDaySet = new Set([5, 11, 17, 24, 33, 40]);

    for (let d = 0; d < 45; d += 1) {
      if (missedDaySet.has(d)) continue;

      const topicKey = topicKeys[d % topicKeys.length];
      const qList = byTopic.get(topicKey);
      const q = qList[d % qList.length];
      const improvingWindow = d > 15 && d < 30;
      const regressingWindow = d >= 30;

      const isCorrect = improvingWindow ? d % 5 !== 0 : regressingWindow ? d % 3 === 0 : d % 2 === 0;
      const selectedAnswerIndex = isCorrect ? q.correctAnswerIndex : (q.correctAnswerIndex + 1) % 4;

      await Attempt.create({
        user: userId,
        question: q._id,
        subject: q.subject,
        topic: q.topic,
        subtopic: q.subtopic,
        conceptTested: q.conceptTested,
        difficulty: q.difficulty,
        selectedAnswerIndex,
        isCorrect,
        timeTakenSec: isCorrect ? 52 : 78,
        expectedSolvingTimeSec: q.solvingTimeEstimate,
        responsePace: isCorrect ? 'on-time' : 'slow',
        adaptiveDifficultyBefore: 'Medium',
        adaptiveDifficultyAfter: 'Medium',
        createdAt: new Date(now - (45 - d) * dayMs),
      });
    }

    const weakResurfaceQuestion = questions.find((q) => q.topic === 'Probability');

    await Mistake.insertMany([
      {
        user: userId,
        question: weakResurfaceQuestion._id,
        subject: weakResurfaceQuestion.subject,
        topic: weakResurfaceQuestion.topic,
        subtopic: weakResurfaceQuestion.subtopic,
        conceptTested: weakResurfaceQuestion.conceptTested,
        difficulty: weakResurfaceQuestion.difficulty,
        mistakeType: 'Concept Error',
        selectedAnswerIndex: 0,
        selectedAnswerText: '11',
        timeTakenSec: 84,
        expectedTimeSec: 60,
        timeDeltaSec: 24,
        isSlowCorrect: false,
        repetitionStage: 0,
        nextReviewAt: new Date(now - dayMs),
        retryCount: 0,
        improvedOnRetry: false,
        resolved: false,
        lastAttemptCorrect: false,
      },
      {
        user: userId,
        question: weakResurfaceQuestion._id,
        subject: weakResurfaceQuestion.subject,
        topic: weakResurfaceQuestion.topic,
        subtopic: weakResurfaceQuestion.subtopic,
        conceptTested: weakResurfaceQuestion.conceptTested,
        difficulty: weakResurfaceQuestion.difficulty,
        mistakeType: 'Concept Error',
        selectedAnswerIndex: 0,
        selectedAnswerText: '11',
        timeTakenSec: 84,
        expectedTimeSec: 60,
        timeDeltaSec: 24,
        isSlowCorrect: false,
        repetitionStage: 1,
        nextReviewAt: new Date(now - 3 * dayMs),
        retryCount: 1,
        improvedOnRetry: false,
        resolved: false,
        lastAttemptCorrect: false,
      },
      {
        user: userId,
        question: weakResurfaceQuestion._id,
        subject: weakResurfaceQuestion.subject,
        topic: weakResurfaceQuestion.topic,
        subtopic: weakResurfaceQuestion.subtopic,
        conceptTested: weakResurfaceQuestion.conceptTested,
        difficulty: weakResurfaceQuestion.difficulty,
        mistakeType: 'Concept Error',
        selectedAnswerIndex: 0,
        selectedAnswerText: '11',
        timeTakenSec: 84,
        expectedTimeSec: 60,
        timeDeltaSec: 24,
        isSlowCorrect: false,
        repetitionStage: 2,
        nextReviewAt: new Date(now - 7 * dayMs),
        retryCount: 2,
        improvedOnRetry: false,
        resolved: false,
        lastAttemptCorrect: false,
      },
    ]);

    const snapshots = [];
    for (let i = 0; i < 12; i += 1) {
      const recs = await getRecommendedQuestions({ userId, targetExam: 'JEE', limit: 10 });
      snapshots.push({
        reasons: recs.recommendations.map((r) => r.recommendationReason),
        topics: recs.recommendations.map((r) => r.topic),
        ids: recs.recommendations.map((r) => String(r._id)),
      });
    }

    const topicDiversity = new Set(snapshots.flatMap((s) => s.topics)).size;
    const hasMistakeResurfacing = snapshots.some((s) => s.reasons.includes('mistake-review'));
    const uniqueListShapes = new Set(snapshots.map((s) => s.ids.slice(0, 5).join('|'))).size;

    console.log('LONG_HORIZON_45_DAY_LOG', {
      snapshots: snapshots.slice(0, 4),
      topicDiversity,
      hasMistakeResurfacing,
      uniqueListShapes,
      missedDays: Array.from(missedDaySet),
    });

    expect(topicDiversity).toBeGreaterThanOrEqual(4);
    expect(hasMistakeResurfacing).toBe(true);
    expect(uniqueListShapes).toBeGreaterThanOrEqual(3);
  });

  test('3) recommendation fatigue: 100 consecutive calls should not collapse into loops', async () => {
    const userId = new mongoose.Types.ObjectId();
    const questions = await createQuestionBank({ perTopic: 16 });

    for (let i = 0; i < 35; i += 1) {
      const q = questions[i];
      await Attempt.create({
        user: userId,
        question: q._id,
        subject: q.subject,
        topic: q.topic,
        subtopic: q.subtopic,
        conceptTested: q.conceptTested,
        difficulty: q.difficulty,
        selectedAnswerIndex: i % 2 === 0 ? q.correctAnswerIndex : (q.correctAnswerIndex + 1) % 4,
        isCorrect: i % 2 === 0,
        timeTakenSec: i % 2 === 0 ? 48 : 83,
        expectedSolvingTimeSec: q.solvingTimeEstimate,
        responsePace: i % 2 === 0 ? 'on-time' : 'slow',
        adaptiveDifficultyBefore: 'Medium',
        adaptiveDifficultyAfter: 'Medium',
      });
    }

    const allIds = [];
    const allTopics = [];
    const allReasons = [];
    const signatures = [];
    const diversityStats = [];
    const perSetDistinctTopics = [];

    for (let i = 0; i < 100; i += 1) {
      const recs = await getRecommendedQuestions({ userId, targetExam: 'JEE', limit: 10 });
      allIds.push(...recs.recommendations.map((r) => String(r._id)));
      allTopics.push(...recs.recommendations.map((r) => r.topic));
      allReasons.push(...recs.recommendations.map((r) => r.reason));
      signatures.push(recommendationSignature(recs.recommendations));
      diversityStats.push(recs.diversityDiagnostics || {});
      perSetDistinctTopics.push(new Set(recs.recommendations.map((r) => r.topic)).size);
    }

    const uniqueQuestionRatio = new Set(allIds).size / allIds.length;
    const uniqueTopicCount = new Set(allTopics).size;
    const uniqueReasonText = new Set(allReasons).size;
    const repeatedSignatureShare =
      signatures.filter((sig) => sig === signatures[0]).length / signatures.length;
    const avgDistinctTopicsPerSet =
      perSetDistinctTopics.reduce((sum, value) => sum + Number(value || 0), 0) /
      Math.max(perSetDistinctTopics.length, 1);
    const avgDistinctSubtopicsPerSet =
      diversityStats.reduce((sum, d) => sum + Number(d.distinctSubtopics || 0), 0) /
      Math.max(diversityStats.length, 1);

    console.log('RECOMMENDATION_FATIGUE_LOG', {
      uniqueQuestionRatio,
      uniqueTopicCount,
      uniqueReasonText,
      repeatedSignatureShare,
      avgDistinctTopicsPerSet,
      avgDistinctSubtopicsPerSet,
      diversityDiagnosticsSamples: diversityStats.slice(0, 3),
      sampleReasons: Array.from(new Set(allReasons)).slice(0, 6),
    });

    expect(uniqueQuestionRatio).toBeGreaterThan(0.08);
    expect(uniqueTopicCount).toBeGreaterThanOrEqual(4);
    expect(uniqueReasonText).toBeGreaterThanOrEqual(12);
    expect(repeatedSignatureShare).toBeLessThan(0.45);
    expect(avgDistinctTopicsPerSet).toBeGreaterThanOrEqual(3);
  });

  test('4) feedback realism + variation validation: 20 random questions x 3 mistake types', async () => {
    const questions = await createQuestionBank({ perTopic: 10 });
    const sample = sampleItems(questions, 20);

    const generated = [];

    sample.forEach((q, idx) => {
      const scenarios = [
        {
          mistakeType: 'Careless Mistake',
          selectedAnswerText: q.options[0],
          timeTakenSec: 8,
          repeatedMistakeCount: 0,
        },
        {
          mistakeType: 'Calculation Error',
          selectedAnswerText: '13',
          timeTakenSec: 72,
          repeatedMistakeCount: 0,
        },
        {
          mistakeType: 'Concept Error',
          selectedAnswerText: q.options[2],
          timeTakenSec: 66,
          repeatedMistakeCount: 3,
        },
      ];

      scenarios.forEach((scenario) => {
        const autoType = classifyMistake({
          isCorrect: false,
          timeTakenSec: scenario.timeTakenSec,
          expectedTimeSec: q.solvingTimeEstimate,
          selectedAnswerText: scenario.selectedAnswerText,
          repeatedMistakeCount: scenario.repeatedMistakeCount,
          questionCommonMistake: q.commonMistake,
        });

        const why = buildWhyGotWrong({
          isCorrect: false,
          topic: q.topic,
          conceptTested: q.conceptTested,
          commonMistakePattern: q.commonMistake,
          selectedAnswerText: scenario.selectedAnswerText,
          mistakeType: scenario.mistakeType,
        });

        const tip = buildImprovementTip({
          isCorrect: false,
          timeTakenSec: scenario.timeTakenSec,
          expectedTimeSec: q.solvingTimeEstimate,
          topic: q.topic,
          difficulty: q.difficulty,
          selectedAnswerText: scenario.selectedAnswerText,
          conceptTested: q.conceptTested,
          mistakeType: scenario.mistakeType,
        });

        generated.push({
          q: `${idx + 1}:${q.topic}/${q.subtopic}`,
          intendedType: scenario.mistakeType,
          autoType,
          why,
          tip,
          combined: `${why} || ${tip}`,
        });
      });
    });

    const uniqueCombined = new Set(generated.map((g) => g.combined)).size;
    const sentenceOpeners = generated.map((g) => `${g.why.split(' ')[0]} ${g.tip.split(' ')[0]}`);
    const uniqueSentenceOpeners = new Set(sentenceOpeners).size;
    const avgLength =
      generated.reduce((sum, g) => sum + g.combined.length, 0) / Math.max(generated.length, 1);

    console.log('FEEDBACK_REALISM_LOG', {
      generatedCount: generated.length,
      uniqueCombined,
      uniqueSentenceOpeners,
      avgLength,
      sample: generated.slice(0, 5),
    });

    expect(generated.length).toBe(60);
    expect(uniqueCombined).toBeGreaterThanOrEqual(28);
    expect(uniqueSentenceOpeners).toBeGreaterThanOrEqual(18);
    expect(avgLength).toBeGreaterThan(120);
  });

  test('5) system honesty under uncertainty: no overclaiming on sparse data', async () => {
    const { userId } = await registerUser();
    const questions = await createQuestionBank({ perTopic: 4 });

    const sparseUserAnalytics = await getAdaptiveAnalytics(userId);

    await Attempt.create({
      user: userId,
      question: questions[0]._id,
      subject: questions[0].subject,
      topic: questions[0].topic,
      subtopic: questions[0].subtopic,
      conceptTested: questions[0].conceptTested,
      difficulty: questions[0].difficulty,
      selectedAnswerIndex: questions[0].correctAnswerIndex,
      isCorrect: true,
      timeTakenSec: 45,
      expectedSolvingTimeSec: questions[0].solvingTimeEstimate,
      responsePace: 'fast',
      adaptiveDifficultyBefore: 'Medium',
      adaptiveDifficultyAfter: 'Medium',
    });

    await Attempt.create({
      user: userId,
      question: questions[1]._id,
      subject: questions[1].subject,
      topic: questions[1].topic,
      subtopic: questions[1].subtopic,
      conceptTested: questions[1].conceptTested,
      difficulty: questions[1].difficulty,
      selectedAnswerIndex: (questions[1].correctAnswerIndex + 1) % 4,
      isCorrect: false,
      timeTakenSec: 80,
      expectedSolvingTimeSec: questions[1].solvingTimeEstimate,
      responsePace: 'slow',
      adaptiveDifficultyBefore: 'Medium',
      adaptiveDifficultyAfter: 'Easy',
    });

    const lowDataAnalytics = await getAdaptiveAnalytics(userId);

    console.log('SYSTEM_HONESTY_LOG', {
      sparseUserBenchmark: sparseUserAnalytics.benchmark,
      lowDataBenchmark: lowDataAnalytics.benchmark,
      lowDataReadiness: lowDataAnalytics.readiness,
      lowDataMessages: {
        suggestedFocusTopic: lowDataAnalytics.suggestedFocusTopic,
        weakTopicMessage: lowDataAnalytics.emptyStateGuidance?.weakTopicMessage,
      },
    });

    expect(lowDataAnalytics.benchmark).toHaveProperty('message');
    expect(/insufficient|more data|early/i.test(lowDataAnalytics.benchmark.message)).toBe(true);
    expect(lowDataAnalytics.performance.strongTopics.length).toBe(0);
  });
});
