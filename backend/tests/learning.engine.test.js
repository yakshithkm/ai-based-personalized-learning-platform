const mongoose = require('mongoose');
const LearningRecommendation = require('../src/models/LearningRecommendation');
const LearningContent = require('../src/models/LearningContent');
const Question = require('../src/models/Question');
const { getLearningBundle } = require('../src/services/learning');
const { buildLearnerProfile, classifyLevel, dayKey } = require('../src/services/learning/learnerProfile');
const { scoreContent, rankContents, targetDifficulty } = require('../src/services/learning/ranking');
const { detectNeeds } = require('../src/services/learning/needDetection');
const { polishExplanation } = require('../src/services/learning/aiExplainer');
const { learningContentSeeds } = require('../src/data/learning-content');
const {
  createUser, createQuestions, addAttempts, addOpenMistakes, createContent, allItems, HOUR,
} = require('./helpers/learningFixtures');

describe('Learning-content recommendation engine', () => {
  // ------------------------------------------------------------------ Test 1
  test('1) new user with no attempts gets a balanced cold-start path (one topic per exam subject)', async () => {
    const user = await createUser({ targetExam: 'JEE' });
    await createQuestions(4, { subject: 'Physics', topic: 'Current Electricity' });
    await createQuestions(3, { subject: 'Chemistry', topic: 'Solutions' });
    await createQuestions(2, { subject: 'Mathematics', topic: 'Sets' });
    await createQuestions(2, { subject: 'Biology', topic: 'Cell Cycle', examType: 'JEE' }); // not a JEE subject
    const intro = await createContent({ title: 'Intro CE', topic: 'Current Electricity' });
    await createContent({ title: 'Hard CE', topic: 'Current Electricity', contentType: 'article', difficulty: 'Hard' });

    const bundle = await getLearningBundle(user);

    expect(bundle.mode).toBe('cold-start');
    expect(bundle.welcome.message).toMatch(/baseline/i);
    expect(bundle.startingPath.map((p) => p.subject).sort()).toEqual(['Chemistry', 'Mathematics', 'Physics']);
    const primary = bundle.learnNext.primary;
    expect(primary.recommendationReason).toBe('cold-start');
    expect(primary.score).toBeGreaterThanOrEqual(0);
    expect(primary.score).toBeLessThanOrEqual(100);
    // introduction before difficulty: the easy intro, never the hard article
    expect(primary.content.id).toBe(String(intro._id));
    // topics without any study material still get an honest practice-only starting point
    const gaps = allItems(bundle).filter((i) => i.contentGap);
    expect(gaps.map((g) => g.target.topic).sort()).toEqual(['Sets', 'Solutions']);
    gaps.forEach((g) => expect(g.reason).toMatch(/do not have study material/i));
  });

  // ------------------------------------------------------------------ Test 2
  test('2) weak topic: recommends an introduction first, with a truthful data-derived reason', async () => {
    const user = await createUser();
    await createQuestions(6, { topic: 'Current Electricity' });
    await addAttempts(user, { correct: 6, wrong: 8, time: 96 });
    const intro = await createContent({ title: 'CE intro', contentType: 'concept', difficulty: 'Easy' });
    await createContent({ title: 'CE example', contentType: 'example', difficulty: 'Medium' });
    await createContent({ title: 'CE advanced', contentType: 'article', difficulty: 'Hard' });

    const bundle = await getLearningBundle(user);
    const primary = bundle.learnNext.primary;

    expect(bundle.mode).toBe('personalized');
    expect(primary.recommendationReason).toBe('weak-topic');
    expect(primary.content.id).toBe(String(intro._id));
    expect(primary.signals.accuracy).toBeLessThan(60);
    // the explanation quotes the same numbers the signals hold
    expect(primary.reason).toContain(`${Math.round(primary.signals.accuracy)}%`);
    expect(primary.reason).toContain('14 attempts');
    expect(primary.reason).toContain('96s per question');
    expect(primary.priority).toBe('high');
    // learning path: concept -> example -> easy practice -> medium practice; advanced is not offered
    expect(primary.path.map((s) => s.stage)).toEqual(['introduction', 'worked-example', 'practice', 'practice']);
    expect(primary.path.filter((s) => s.kind === 'practice').map((s) => s.difficulty)).toEqual(['Easy', 'Medium']);
    expect(primary.path[0].status).toBe('next');
    expect(allItems(bundle).some((i) => i.content?.title === 'CE advanced' && i.score >= 60)).toBe(false);
  });

  // ------------------------------------------------------------------ Test 3
  test('3) repeated mistakes in one concept produce a mistake-recovery recommendation for that concept', async () => {
    const user = await createUser();
    await createQuestions(4, { topic: 'Current Electricity' });
    await addAttempts(user, { concept: "Kirchhoff's Laws", correct: 5, wrong: 5 });
    await addOpenMistakes(user, { concept: "Kirchhoff's Laws", count: 3 });
    const example = await createContent({
      title: "Kirchhoff's worked example",
      concept: "Kirchhoff's Laws",
      contentType: 'example',
      difficulty: 'Medium',
    });

    const bundle = await getLearningBundle(user);
    const item = allItems(bundle).find((i) => i.content?.id === String(example._id));

    expect(item).toBeDefined();
    expect(item.recommendationReason).toBe('mistake-recovery');
    expect(item.target).toMatchObject({ concept: "Kirchhoff's Laws", granularity: 'concept' });
    expect(item.reason).toContain('3 unresolved mistakes');
    expect(item.reason).toContain("Kirchhoff's Laws");
    expect(item.signals.openMistakes).toBe(3);
  });

  // ------------------------------------------------------------------ Test 4
  test('4) high mastery: advanced material, and beginner content is not recommended', async () => {
    const user = await createUser();
    await createQuestions(4, { topic: 'Current Electricity' });
    await addAttempts(user, { correct: 23, wrong: 2 });
    await createContent({ title: 'Beginner intro', contentType: 'concept', difficulty: 'Easy' });
    const advanced = await createContent({ title: 'Advanced circuits', contentType: 'article', difficulty: 'Hard' });

    const bundle = await getLearningBundle(user);
    const primary = bundle.learnNext.primary;

    expect(bundle.mode).toBe('personalized');
    expect(primary.content.id).toBe(String(advanced._id));
    expect(primary.recommendationReason).toBe('advanced-challenge');
    expect(primary.reason).toMatch(/maintained \d+% accuracy/);
    expect(allItems(bundle).some((i) => i.content?.title === 'Beginner intro')).toBe(false);
  });

  // ------------------------------------------------------------------ Test 5 (engine part; API part in learning.api.test.js)
  test('5) partially completed content is surfaced under Continue Learning', async () => {
    const user = await createUser();
    await createQuestions(4, { topic: 'Current Electricity' });
    await createQuestions(4, { subject: 'Chemistry', topic: 'Solutions' });
    await addAttempts(user, { correct: 3, wrong: 9 });
    await addAttempts(user, { subject: 'Chemistry', topic: 'Solutions', correct: 5, wrong: 6 });
    await createContent({ title: 'CE intro' });
    const sol = await createContent({ title: 'Solutions intro', subject: 'Chemistry', topic: 'Solutions' });

    const first = await getLearningBundle(user);
    const solItem = allItems(first).find((i) => i.content?.id === String(sol._id));
    expect(solItem).toBeDefined();

    // Simulate the lifecycle through the service layer.
    const lifecycle = require('../src/services/learning/lifecycle');
    await lifecycle.startRecommendation(user, solItem.id);
    await lifecycle.updateProgress(user, solItem.id, { progressPercent: 60, timeSpentSec: 120 });

    const second = await getLearningBundle(user);
    const cont = second.sections.continueLearning.find((i) => i.id === solItem.id);
    expect(cont).toBeDefined();
    expect(cont.progress.progressPercent).toBe(60);
    expect(cont.reason).toMatch(/60% of the way/);
  });

  // ------------------------------------------------------------------ Test 6
  test('6) recently recommended but ignored content is rotated out; recommendation history is deduplicated', async () => {
    const user = await createUser();
    await createQuestions(4, { topic: 'Current Electricity' });
    await addAttempts(user, { correct: 4, wrong: 8 });
    const a = await createContent({ title: 'Intro A', qualityScore: 85 });
    const b = await createContent({ title: 'Intro B', qualityScore: 80 });

    const first = await getLearningBundle(user);
    expect(first.learnNext.primary.content.id).toBe(String(a._id));
    await getLearningBundle(user); // same day again

    // one open episode per content, refreshed rather than duplicated
    const docsA = await LearningRecommendation.find({ user: user._id, content: a._id });
    expect(docsA).toHaveLength(1);
    expect(docsA[0].impressions).toBe(2);
    expect(docsA[0].servedDays).toHaveLength(1);

    // pretend A was shown (and ignored) on three earlier days
    const days = [3, 2, 1].map((n) => dayKey(new Date(Date.now() - n * 24 * HOUR)));
    await LearningRecommendation.updateOne({ _id: docsA[0]._id }, { $set: { servedDays: [...days, dayKey(new Date())] } });

    const later = await getLearningBundle(user);
    expect(later.learnNext.primary.content.id).toBe(String(b._id));

    const scoreOfA = async () => {
      const profile = await buildLearnerProfile(user);
      const ranked = rankContents({ contents: [a.toObject(), b.toObject()], needs: detectNeeds(profile), profile });
      return ranked.find((e) => String(e.content._id) === String(a._id)).score;
    };
    const penalized = await scoreOfA();
    // engaging with it removes the "shown but ignored" penalty (18 points for 3 ignored days)
    await LearningRecommendation.updateOne({ _id: docsA[0]._id }, { $set: { clickedAt: new Date() } });
    const engaged = await scoreOfA();
    expect(engaged - penalized).toBeGreaterThanOrEqual(17);
  });

  test('6b) concurrent page loads never create duplicate recommendation episodes', async () => {
    await LearningRecommendation.init(); // make sure the partial unique index exists
    const user = await createUser();
    await createQuestions(4, { topic: 'Current Electricity' });
    await addAttempts(user, { correct: 4, wrong: 8 });
    const c = await createContent({ title: 'Solo intro' });

    const bundles = await Promise.all(Array.from({ length: 6 }, () => getLearningBundle(user)));
    bundles.forEach((b) => expect(b.learnNext.primary.content.id).toBe(String(c._id)));

    expect(await LearningRecommendation.countDocuments({ user: user._id, content: c._id, open: true })).toBe(1);
    const ids = new Set(bundles.map((b) => b.learnNext.primary.id));
    expect(ids.size).toBe(1); // every request sees the same stable recommendation id
  });

  // ------------------------------------------------------------------ Test 7
  test('7) prerequisite weakness: the foundation is recommended before the dependent topic', async () => {
    const user = await createUser();
    await createQuestions(3, { subject: 'Mathematics', topic: 'Relations' });
    await createQuestions(3, { subject: 'Mathematics', topic: 'Functions' });
    await addAttempts(user, { subject: 'Mathematics', topic: 'Relations', correct: 4, wrong: 6 });
    await addAttempts(user, { subject: 'Mathematics', topic: 'Functions', correct: 3, wrong: 7 });
    const relations = await createContent({ title: 'Relations intro', subject: 'Mathematics', topic: 'Relations' });
    const functions = await createContent({ title: 'Functions intro', subject: 'Mathematics', topic: 'Functions', prerequisites: ['Relations'] });

    const bundle = await getLearningBundle(user);
    const primary = bundle.learnNext.primary;

    expect(primary.content.id).toBe(String(relations._id));
    expect(primary.recommendationReason).toBe('prerequisite');
    expect(primary.reason).toMatch(/Functions builds on Relations/);
    const fnItem = allItems(bundle).find((i) => i.content?.id === String(functions._id));
    if (fnItem) expect(fnItem.score).toBeLessThan(primary.score);

    // once the prerequisite is solid, the target concept is recommended directly
    await addAttempts(user, { subject: 'Mathematics', topic: 'Relations', correct: 20, wrong: 0, endHoursAgo: 0 });
    const later = await getLearningBundle(user);
    expect(later.learnNext.primary.content.id).toBe(String(functions._id));
  });

  // ------------------------------------------------------------------ Test 8
  test('8) multiple weak subjects are all represented and feed the daily plan', async () => {
    const user = await createUser();
    const spec = [
      ['Physics', 'Current Electricity', 3, 7],
      ['Chemistry', 'Solutions', 4, 8],
      ['Mathematics', 'Sets', 4, 6],
    ];
    for (const [subject, topic, correct, wrong] of spec) {
      await createQuestions(3, { subject, topic });
      await addAttempts(user, { subject, topic, correct, wrong });
      await createContent({ title: `${topic} intro`, subject, topic });
    }

    const bundle = await getLearningBundle(user);
    const subjects = new Set(allItems(bundle).map((i) => i.target.subject));
    expect(subjects).toEqual(new Set(['Physics', 'Chemistry', 'Mathematics']));
    expect(bundle.dailyPlan.items.length).toBeGreaterThanOrEqual(2);
    expect(bundle.dailyPlan.totalMinutes).toBeLessThanOrEqual(bundle.dailyPlan.budgetMinutes);
    expect(new Set(bundle.dailyPlan.items.map((i) => i.topic).filter(Boolean)).size).toBeGreaterThanOrEqual(2);
  });

  // ------------------------------------------------------------------ Test 9
  test('9) insufficient content: falls back to honest practice-only recommendations', async () => {
    const user = await createUser();
    await createQuestions(8, { subject: 'Chemistry', topic: 'Solutions' });
    await addAttempts(user, { subject: 'Chemistry', topic: 'Solutions', correct: 4, wrong: 8 });

    const bundle = await getLearningBundle(user);
    const primary = bundle.learnNext.primary;

    expect(primary.kind).toBe('practice');
    expect(primary.contentGap).toBe(true);
    expect(primary.content).toBeNull();
    expect(primary.recommendationReason).toBe('weak-topic');
    expect(primary.reason).toMatch(/do not have study material for Solutions/);
    expect(primary.practice.route).toContain('mode=content-practice');
    expect(primary.score).toBeGreaterThan(0);
    expect(primary.score).toBeLessThanOrEqual(100);
    expect(bundle.dailyPlan.items[0].type).toBe('practice');
  });

  test('9b) disabled or deleted content is never recommended', async () => {
    const user = await createUser();
    await createQuestions(4, { topic: 'Current Electricity' });
    await addAttempts(user, { correct: 3, wrong: 9 });
    const c = await createContent({ title: 'To be disabled' });
    expect((await getLearningBundle(user)).learnNext.primary.content.id).toBe(String(c._id));

    await LearningContent.updateOne({ _id: c._id }, { $set: { isActive: false } });
    const bundle = await getLearningBundle(user);
    expect(bundle.learnNext.primary.kind).toBe('practice'); // content gap now
    expect(allItems(bundle).some((i) => i.content?.id === String(c._id))).toBe(false);
  });

  // ------------------------------------------------------------------ Test 10
  test('10) works when the AI/LLM is unavailable (and never trusts unfaithful AI text)', async () => {
    const user = await createUser();
    await createQuestions(4, { topic: 'Current Electricity' });
    await addAttempts(user, { correct: 3, wrong: 9 });
    await createContent({ title: 'CE intro' });

    // (a) AI enabled by flag but no API key configured
    const oldFlag = process.env.LEARNING_AI_EXPLANATIONS;
    const oldKey = process.env.GEMINI_API_KEY;
    process.env.LEARNING_AI_EXPLANATIONS = 'true';
    delete process.env.GEMINI_API_KEY;
    const noKey = await getLearningBundle(user);
    expect(noKey.learnNext.primary.reasonSource).toBe('rules');

    // (b) explainer throws
    const throwing = await getLearningBundle(user, { aiExplainer: async () => { throw new Error('503 unavailable'); } });
    expect(throwing.learnNext.primary.reasonSource).toBe('rules');
    expect(throwing.learnNext.primary.reason).toMatch(/accuracy in Current Electricity/);

    // (c) explainer returns something -> accepted only through the guarded polisher
    const polished = await getLearningBundle(user, { aiExplainer: async (text) => `Friendly: ${text}` });
    expect(polished.learnNext.primary.reasonSource).toBe('ai-polished');
    expect(polished.learnNext.primary.priority).toBe(noKey.learnNext.primary.priority);
    expect(polished.learnNext.primary.score).toBe(noKey.learnNext.primary.score);

    process.env.LEARNING_AI_EXPLANATIONS = oldFlag;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;

    // the guarded polisher rejects unfaithful, linked or failing output
    const original = 'Your accuracy in Sets is 42% across 15 attempts.';
    const gen = (text) => async function* stream() { yield text; };
    expect(await polishExplanation(original, { streamReply: gen('You are at 42% over 15 attempts in Sets.') })).toMatch(/42%/);
    expect(await polishExplanation(original, { streamReply: gen('You are at 80% over 15 attempts.') })).toBeNull();
    expect(await polishExplanation(original, { streamReply: gen('42% of 15 attempts, see https://x.example') })).toBeNull();
    expect(await polishExplanation(original, { streamReply: async function* fail() { throw new Error('down'); } })).toBeNull();
  });
});

describe('Scoring properties', () => {
  const baseProfile = async () => {
    const user = await createUser();
    await createQuestions(3, { topic: 'Current Electricity' });
    await addAttempts(user, { correct: 3, wrong: 9 });
    return { user, profile: await buildLearnerProfile(user) };
  };

  test('scores are integers in 0..100 and fully deterministic', async () => {
    const { profile } = await baseProfile();
    const contents = [
      await createContent({ title: 'a' }),
      await createContent({ title: 'b', contentType: 'example', difficulty: 'Medium' }),
      await createContent({ title: 'c', contentType: 'article', difficulty: 'Hard', qualityScore: 0 }),
    ].map((c) => c.toObject());
    const needs = detectNeeds(profile);

    const first = rankContents({ contents, needs, profile });
    const second = rankContents({ contents, needs, profile });
    expect(first.map((e) => [String(e.content._id), e.score])).toEqual(second.map((e) => [String(e.content._id), e.score]));
    first.forEach((e) => {
      expect(Number.isInteger(e.score)).toBe(true);
      expect(e.score).toBeGreaterThanOrEqual(0);
      expect(e.score).toBeLessThanOrEqual(100);
    });
    // positive components can never exceed 100 in total
    const positive = Object.values(first[0].components).reduce((s, v) => s + v, 0);
    expect(positive).toBeLessThanOrEqual(100.5);
  });

  test('completed content is pushed down and level bands follow mastery with an accuracy guard', async () => {
    const { user, profile } = await baseProfile();
    const c = (await createContent({ title: 'done' })).toObject();
    const need = detectNeeds(profile).find((n) => n.type === 'weak-topic');
    const fresh = scoreContent({ content: c, need, profile });
    profile.progressByContent.set(String(c._id), { status: 'completed', completedAt: new Date(), content: c._id });
    const done = scoreContent({ content: c, need, profile });
    expect(done.score).toBeLessThan(fresh.score);
    expect(fresh.score - done.score).toBeGreaterThanOrEqual(Math.min(fresh.score, 55));

    expect(classifyLevel({ attempts: 0 })).toBe('new');
    expect(classifyLevel({ attempts: 20, accuracy: 85, mastery: 89 })).toBe('high');
    expect(classifyLevel({ attempts: 20, accuracy: 45, mastery: 58 })).toBe('low'); // volume cannot hide poor accuracy
    expect(classifyLevel({ attempts: 8, accuracy: 55, mastery: 50 })).toBe('developing');
    expect(classifyLevel({ attempts: 8, accuracy: 70, mastery: 70 })).toBe('proficient');
    void user;
  });

  test('same subject, different mastery -> different recommendations', async () => {
    const strong = await createUser();
    const weak = await createUser();
    await createQuestions(4, { topic: 'Current Electricity' });
    await addAttempts(strong, { correct: 23, wrong: 2 });
    await addAttempts(weak, { correct: 9, wrong: 11 });
    const intro = await createContent({ title: 'intro' });
    const adv = await createContent({ title: 'adv', contentType: 'article', difficulty: 'Hard' });

    const s = await getLearningBundle(strong);
    const w = await getLearningBundle(weak);
    expect(s.learnNext.primary.content.id).toBe(String(adv._id));
    expect(w.learnNext.primary.content.id).toBe(String(intro._id));
  });

  test('"too difficult" feedback lowers the target difficulty', () => {
    expect(targetDifficulty('proficient', 0)).toBe('Medium');
    expect(targetDifficulty('proficient', -1)).toBe('Easy');
    expect(targetDifficulty('low', -1)).toBe('Easy');
    expect(targetDifficulty('high', 1)).toBe('Hard');
  });
});

describe('Curated seed content vs runtime logic', () => {
  test('every seed passes model validation and is retrievable + recommended for a weak student', async () => {
    const created = await LearningContent.insertMany(learningContentSeeds);
    expect(created).toHaveLength(learningContentSeeds.length);
    created.forEach((c) => expect(c.learningStage).toBeTruthy());

    const topics = new Map();
    learningContentSeeds.forEach((s) => topics.set(`${s.subject}::${s.topic}`, s));

    for (const s of topics.values()) {
      const user = await createUser({ targetExam: s.examTypes.includes('JEE') ? 'JEE' : 'NEET' });
      await createQuestions(2, { examType: user.targetExam, subject: s.subject, topic: s.topic });
      await addAttempts(user, { subject: s.subject, topic: s.topic, correct: 3, wrong: 9 });
      const bundle = await getLearningBundle(user);
      const item = allItems(bundle).find((i) => i.target.topic === s.topic);
      const label = `${s.subject}/${s.topic}`;
      if (!item) throw new Error(`No recommendation at all for ${label}`);
      if (item.kind !== 'content') throw new Error(`${label} was served as practice-only although seed content exists`);
      await mongoose.connection.collection('attempts').deleteMany({});
    }
    expect(await Question.countDocuments()).toBeGreaterThan(0);
  });
});