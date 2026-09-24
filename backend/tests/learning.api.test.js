const request = require('supertest');
const app = require('../src/app');
const LearningContent = require('../src/models/LearningContent');
const LearningContentProgress = require('../src/models/LearningContentProgress');
const LearningRecommendation = require('../src/models/LearningRecommendation');
const QuestionRecommendationLog = require('../src/models/QuestionRecommendationLog');
const { buildLearnerProfile } = require('../src/services/learning/learnerProfile');
const { getQuestionHistory } = require('../src/services/learning/history');
const {
  createUser, tokenFor, createQuestions, addAttempts, createContent, allItems,
} = require('./helpers/learningFixtures');

const get = (token, url) => request(app).get(url).set('Authorization', `Bearer ${token}`);
const post = (token, url, body = {}) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body);

// A weak Current Electricity student with an intro + example, returned with token and content.
const setupWeakStudent = async () => {
  const user = await createUser();
  const token = tokenFor(user);
  await createQuestions(8, { topic: 'Current Electricity', difficulty: 'Easy' });
  await createQuestions(8, { topic: 'Current Electricity', difficulty: 'Medium' });
  await addAttempts(user, { correct: 4, wrong: 8 });
  const intro = await createContent({ title: 'CE intro', contentType: 'concept', difficulty: 'Easy' });
  const example = await createContent({ title: 'CE example', contentType: 'example', difficulty: 'Medium' });
  return { user, token, intro, example };
};

describe('Learning recommendation API', () => {
  test('endpoints require authentication and return consistent shapes', async () => {
    expect((await request(app).get('/api/recommendations/learn-next')).status).toBe(401);

    const { token } = await setupWeakStudent();
    const learnNext = await get(token, '/api/recommendations/learn-next');
    expect(learnNext.status).toBe(200);
    expect(learnNext.body).toMatchObject({ source: 'learning-recommendation-engine', section: 'learnNext' });
    const primary = learnNext.body.learnNext.primary;
    expect(primary).toMatchObject({ kind: 'content', recommendationReason: 'weak-topic', priority: 'high' });
    expect(primary.id).toMatch(/^[a-f0-9]{24}$/);
    expect(primary.content).not.toHaveProperty('body'); // list payloads never carry the body

    for (const [path, section] of [['weak-areas', 'weakAreas'], ['mistake-recovery', 'mistakeRecovery'], ['challenges', 'challenges']]) {
      const res = await get(token, `/api/recommendations/${path}`);
      expect(res.status).toBe(200);
      expect(res.body.section).toBe(section);
      expect(Array.isArray(res.body.items)).toBe(true);
    }

    const plan = await get(token, '/api/recommendations/daily-plan');
    expect(plan.status).toBe(200);
    expect(plan.body.dailyPlan.items.length).toBeGreaterThan(0);
    plan.body.dailyPlan.items.forEach((i, idx) => expect(i.order).toBe(idx + 1));

    const full = await get(token, '/api/recommendations/learning');
    expect(full.status).toBe(200);
    expect(full.body).toHaveProperty('sections.weakAreas');
    expect(full.body).toHaveProperty('dailyPlan');
    expect(full.body).toHaveProperty('improvements');
  });

  test('/me keeps its question payload, adds learning only on request, and history is persisted in MongoDB', async () => {
    const { user, token } = await setupWeakStudent();

    const plain = await get(token, '/api/recommendations/me');
    expect(plain.status).toBe(200);
    expect(Array.isArray(plain.body.recommendations)).toBe(true);
    expect(plain.body.recommendations.length).toBeGreaterThan(0);
    expect(plain.body).not.toHaveProperty('learning');
    plain.body.recommendations.forEach((q) => expect(q).not.toHaveProperty('correctAnswer'));

    const persisted = await QuestionRecommendationLog.countDocuments({ user: user._id });
    expect(persisted).toBe(plain.body.recommendations.length);
    const history = await getQuestionHistory(user._id);
    expect(history).toHaveLength(persisted);
    expect(new Date(history[0].createdAt) <= new Date(history[history.length - 1].createdAt)).toBe(true);

    const withLearning = await get(token, '/api/recommendations/me?include=learning');
    expect(withLearning.body.learning.learnNext.primary.recommendationReason).toBe('weak-topic');
    expect(withLearning.body.recommendations.length).toBeGreaterThan(0);
  });

  test('start -> progress -> complete -> feedback lifecycle updates progress, history and future ranking', async () => {
    const { user, token, intro } = await setupWeakStudent();
    const primary = (await get(token, '/api/recommendations/learn-next')).body.learnNext.primary;
    expect(primary.content.id).toBe(String(intro._id));

    // progress before start is rejected
    expect((await post(token, `/api/recommendations/${primary.id}/progress`, { progressPercent: 10 })).status).toBe(409);

    const started = await post(token, `/api/recommendations/${primary.id}/start`);
    expect(started.status).toBe(200);
    expect(started.body.content.body).toContain('study text'); // body served only on open
    expect(started.body.progress.status).toBe('in-progress');
    let rec = await LearningRecommendation.findById(primary.id);
    expect(rec.status).toBe('started');
    expect(rec.clickedAt).toBeTruthy();
    expect(rec.before.attempts).toBeGreaterThan(0); // "before" snapshot captured

    // validation
    expect((await post(token, `/api/recommendations/${primary.id}/progress`, { progressPercent: 140 })).status).toBe(400);
    expect((await post(token, `/api/recommendations/${primary.id}/progress`, { timeSpentSec: -5 })).status).toBe(400);
    expect((await post(token, `/api/recommendations/${primary.id}/progress`, {})).status).toBe(400);

    const p1 = await post(token, `/api/recommendations/${primary.id}/progress`, { progressPercent: 60, timeSpentSec: 120 });
    expect(p1.body.progress).toMatchObject({ progressPercent: 60, timeSpentSec: 120 });
    const p2 = await post(token, `/api/recommendations/${primary.id}/progress`, { progressPercent: 30, timeSpentSec: 20 });
    expect(p2.body.progress.progressPercent).toBe(60); // never goes backwards
    expect(p2.body.progress.timeSpentSec).toBe(140);

    const done = await post(token, `/api/recommendations/${primary.id}/complete`, { timeSpentSec: 40 });
    expect(done.status).toBe(200);
    expect(done.body.progress).toMatchObject({ status: 'completed', progressPercent: 100, timeSpentSec: 180 });
    expect(done.body.practice.route).toContain(`rec=${primary.id}`);
    rec = await LearningRecommendation.findById(primary.id);
    expect(rec).toMatchObject({ status: 'completed', open: false });
    const again = await post(token, `/api/recommendations/${primary.id}/complete`);
    expect(again.body.alreadyCompleted).toBe(true);

    // feedback: validated, stored on both the progress row and the recommendation
    expect((await post(token, `/api/recommendations/${primary.id}/feedback`, { helpful: 'yes' })).status).toBe(400);
    expect((await post(token, `/api/recommendations/${primary.id}/feedback`, { difficulty: 'meh' })).status).toBe(400);
    expect((await post(token, `/api/recommendations/${primary.id}/feedback`, {})).status).toBe(400);
    const fb = await post(token, `/api/recommendations/${primary.id}/feedback`, { helpful: true, difficulty: 'too-difficult', rating: 4 });
    expect(fb.status).toBe(200);
    const progress = await LearningContentProgress.findOne({ user: user._id, content: intro._id });
    expect(progress).toMatchObject({ helpful: true, difficultyFeedback: 'too-difficult', rating: 4 });

    // completed content no longer leads Learn Next; the next step of the path does
    const next = (await get(token, '/api/recommendations/learn-next')).body.learnNext.primary;
    expect(next.content.id).not.toBe(String(intro._id));
    expect(next.path.find((s) => s.contentId === String(intro._id)).status).toBe('completed');
  });

  test('ownership, disabled content and skipping', async () => {
    const { token, intro } = await setupWeakStudent();
    const stranger = tokenFor(await createUser());
    const primary = (await get(token, '/api/recommendations/learn-next')).body.learnNext.primary;

    expect((await post(stranger, `/api/recommendations/${primary.id}/start`)).status).toBe(404);
    expect((await get(token, '/api/recommendations/not-an-id')).status).toBe(400);

    // disabled after being recommended -> 410 and the episode is closed
    await LearningContent.updateOne({ _id: intro._id }, { $set: { isActive: false } });
    const gone = await post(token, `/api/recommendations/${primary.id}/start`);
    expect(gone.status).toBe(410);
    expect((await LearningRecommendation.findById(primary.id)).open).toBe(false);

    // skipping records a skipped progress row and dismisses the episode
    await LearningContent.updateOne({ _id: intro._id }, { $set: { isActive: true } });
    const again = (await get(token, '/api/recommendations/learn-next')).body.learnNext.primary;
    const skipped = await post(token, `/api/recommendations/${again.id}/skip`);
    expect(skipped.status).toBe(200);
    expect(skipped.body.recommendation.status).toBe('dismissed');
    const progress = await LearningContentProgress.findOne({ content: intro._id });
    expect(progress).toMatchObject({ status: 'skipped', skipped: true });
  });

  test('practice set is filtered to the recommendation target, has no answers, and steps up in difficulty', async () => {
    const { token, user } = await setupWeakStudent();
    await createQuestions(3, { topic: 'Solutions', subject: 'Chemistry' }); // must never leak in
    const primary = (await get(token, '/api/recommendations/learn-next')).body.learnNext.primary;
    await post(token, `/api/recommendations/${primary.id}/start`);
    await post(token, `/api/recommendations/${primary.id}/complete`);

    const set1 = await get(token, `/api/recommendations/${primary.id}/practice?count=5`);
    expect(set1.status).toBe(200);
    expect(set1.body.step).toMatchObject({ index: 0, count: 5, difficulty: 'Easy' });
    expect(set1.body.questions).toHaveLength(5);
    set1.body.questions.forEach((q) => {
      expect(q.topic).toBe('Current Electricity');
      expect(q.subject).toBe('Physics');
      expect(q).not.toHaveProperty('correctAnswer');
      expect(q).not.toHaveProperty('correctAnswerIndex');
      expect(q.recommendationReason).toBe('content-practice');
    });
    expect(set1.body.questions.filter((q) => q.difficulty === 'Easy').length).toBe(5);

    // after 5 answered questions since completion the next ladder step (Medium) is served
    await addAttempts(user, { correct: 3, wrong: 2, afterMs: 500 });
    const set2 = await get(token, `/api/recommendations/${primary.id}/practice?count=5`);
    expect(set2.body.step).toMatchObject({ index: 1, difficulty: 'Medium' });
  });

  test('effectiveness compares accuracy before starting with practice after completing, without claiming causation', async () => {
    const { token, user } = await setupWeakStudent(); // 4/12 before = 33%
    const primary = (await get(token, '/api/recommendations/learn-next')).body.learnNext.primary;
    await post(token, `/api/recommendations/${primary.id}/start`);
    const done = await post(token, `/api/recommendations/${primary.id}/complete`);
    expect(done.body.effectiveness.available).toBe(false);
    expect(done.body.effectiveness.reason).toBe('not-enough-practice');

    await addAttempts(user, { correct: 4, wrong: 1, afterMs: 500 }); // 80% after
    const detail = await get(token, `/api/recommendations/${primary.id}`);
    const eff = detail.body.effectiveness;
    expect(eff.available).toBe(true);
    expect(eff.hasBaseline).toBe(true);
    expect(eff.before.accuracy).toBeLessThan(50);
    expect(eff.after).toMatchObject({ accuracy: 80, attempts: 5 });
    expect(eff.delta.accuracyPoints).toBeCloseTo(80 - eff.before.accuracy, 1);
    expect(eff.message).toMatch(/after|once you completed/i);
    expect(eff.message).not.toMatch(/because/i);

    const stored = await LearningRecommendation.findById(primary.id);
    expect(stored.after.attempts).toBe(5);
    expect(stored.practiceAttemptsAfter).toBe(5);

    // ...and it shows up in the bundle, together with the "practice after learning" prompt logic
    const bundle = (await get(token, '/api/recommendations/learning')).body;
    expect(bundle.improvements[0].effectiveness.delta.accuracyPoints).toBe(eff.delta.accuracyPoints);
    expect(bundle.sections.practiceAfterLearning).toHaveLength(0); // 5 practice questions already answered
  });

  test('a completed item with no practice yet is offered under "Practice After Learning"', async () => {
    const { token } = await setupWeakStudent();
    const primary = (await get(token, '/api/recommendations/learn-next')).body.learnNext.primary;
    await post(token, `/api/recommendations/${primary.id}/start`);
    await post(token, `/api/recommendations/${primary.id}/complete`);
    const bundle = (await get(token, '/api/recommendations/learning')).body;
    const pal = bundle.sections.practiceAfterLearning;
    expect(pal).toHaveLength(1);
    expect(pal[0].id).toBe(primary.id);
    expect(pal[0].practice.route).toContain('mode=content-practice');
  });

  test('repeated "too difficult" feedback lowers the difficulty the engine targets', async () => {
    const { token, user } = await setupWeakStudent();
    for (const title of ['x1', 'x2']) {
      const c = await createContent({ title, contentType: 'notes', difficulty: 'Medium' });
      const rec = await LearningRecommendation.create({
        user: user._id, content: c._id, dedupeKey: `c:${c._id}`, kind: 'content', recommendationReason: 'weak-topic',
        target: { subject: 'Physics', topic: 'Current Electricity' },
      });
      await post(token, `/api/recommendations/${rec.id}/start`);
      await post(token, `/api/recommendations/${rec.id}/feedback`, { difficulty: 'too-difficult', helpful: false });
    }
    const profile = await buildLearnerProfile(user);
    expect(profile.feedback.difficultyBias).toBe(-1);
    expect(profile.feedback.typeAffinity.notes).toBeLessThan(0);
  });
});

describe('Admin learning-content management', () => {
  const adminToken = async () => {
    const admin = await createUser({ isAdmin: true, email: `admin_${Date.now()}@test.com` });
    return tokenFor(admin);
  };
  const payload = (overrides = {}) => ({
    title: 'Ohm\'s law video', subject: 'Physics', topic: 'Current Electricity', contentType: 'video', difficulty: 'Easy',
    url: 'https://example.org/ohm', provider: 'Example', estimatedMinutes: 12, qualityScore: 90,
    prerequisites: ['Basic Kinematics'], learningObjectives: ['State Ohm\'s law'], examTypes: ['JEE', 'NEET'], ...overrides,
  });

  test('students cannot use admin content endpoints', async () => {
    const student = tokenFor(await createUser());
    expect((await get(student, '/api/admin/learning-content')).status).toBe(403);
    expect((await post(student, '/api/admin/learning-content', payload())).status).toBe(403);
  });

  test('create, validate, list with aggregate stats, edit, disable and guarded delete', async () => {
    const admin = await adminToken();

    const created = await post(admin, '/api/admin/learning-content', payload());
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ learningStage: 'explanation', provider: 'Example', hasBody: false });
    const id = created.body.id;

    // validation
    expect((await post(admin, '/api/admin/learning-content', payload({ url: 'javascript:alert(1)', title: 'bad url' }))).status).toBe(400);
    expect((await post(admin, '/api/admin/learning-content', payload({ url: '', body: '', title: 'no source' }))).status).toBe(400);
    expect((await post(admin, '/api/admin/learning-content', payload({ subject: 'History', title: 'bad subject' }))).status).toBe(400);
    expect((await post(admin, '/api/admin/learning-content', payload({ qualityScore: 400, title: 'bad q' }))).status).toBe(400);
    expect((await post(admin, '/api/admin/learning-content', payload())).status).toBe(409); // duplicate

    // a student engages with it -> stats are aggregate only
    const { token, user } = await setupWeakStudent();
    await LearningContent.updateOne({ title: 'CE intro' }, { $set: { isActive: false } });
    await LearningContent.updateOne({ _id: id }, { $set: { contentType: 'concept', learningStage: 'introduction' } });
    const primary = (await get(token, '/api/recommendations/learn-next')).body.learnNext.primary;
    expect(primary.content.id).toBe(id);
    await post(token, `/api/recommendations/${primary.id}/start`);
    await post(token, `/api/recommendations/${primary.id}/complete`, { timeSpentSec: 300 });
    await post(token, `/api/recommendations/${primary.id}/feedback`, { helpful: true });

    const list = await get(admin, '/api/admin/learning-content?subject=Physics&q=ohm');
    expect(list.status).toBe(200);
    const row = list.body.items.find((r) => r.id === id);
    expect(row.stats).toMatchObject({ timesRecommended: 1, learners: 1, completions: 1, completionRate: 100, helpfulRate: 100, clickRate: 100 });
    expect(row.stats.avgTimeSpentSec).toBeGreaterThanOrEqual(300);
    expect(JSON.stringify(list.body)).not.toContain(String(user._id)); // no student identifiers leak

    const edited = await request(app).put(`/api/admin/learning-content/${id}`).set('Authorization', `Bearer ${admin}`)
      .send({ difficulty: 'Hard', qualityScore: 55, prerequisites: 'Vectors, Basic Kinematics' });
    expect(edited.status).toBe(200);
    const detail = await get(admin, `/api/admin/learning-content/${id}`);
    expect(detail.body).toMatchObject({ difficulty: 'Hard', qualityScore: 55, prerequisites: ['Vectors', 'Basic Kinematics'] });

    // history exists -> delete refused, disabling works and removes it from recommendations
    const del = await request(app).delete(`/api/admin/learning-content/${id}`).set('Authorization', `Bearer ${admin}`);
    expect(del.status).toBe(409);
    const off = await request(app).put(`/api/admin/learning-content/${id}`).set('Authorization', `Bearer ${admin}`).send({ isActive: false });
    expect(off.body.isActive).toBe(false);
    const after = await get(token, '/api/recommendations/learning');
    expect(allItems(after.body).some((i) => i.content?.id === id)).toBe(false);

    // unused content can be deleted
    const spare = await post(admin, '/api/admin/learning-content', payload({ title: 'spare' }));
    expect((await request(app).delete(`/api/admin/learning-content/${spare.body.id}`).set('Authorization', `Bearer ${admin}`)).status).toBe(200);

    const meta = await get(admin, '/api/admin/learning-content/meta');
    expect(meta.body.contentTypes).toContain('formula-sheet');
    expect(meta.body.topicsBySubject.Physics).toContain('Current Electricity');
  });
});