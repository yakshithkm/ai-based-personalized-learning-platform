const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const UsageCounter = require('../src/models/UsageCounter');
const generateToken = require('../src/utils/generateToken');
const { reserveUsage, getPeriodKey } = require('../src/services/tier/usageService');

let seq = 0;
const makeUser = async (tier = 'FREE', overrides = {}) => {
  seq += 1;
  const user = await User.create({
    name: `Tier ${tier}`, email: `tier_${tier.toLowerCase()}_${seq}@test.com`, password: 'pass1234',
    targetExam: 'JEE', tier, ...overrides,
  });
  return { user, token: generateToken(user._id) };
};
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const spend = (user, key, count, period = 'day') =>
  UsageCounter.create({ user: user._id, key, period: getPeriodKey(period), count, expiresAt: new Date(Date.now() + 864e5 * 3) });

describe('tier identity & anti-tampering', () => {
  test('new registrations are FREE even if the body asks for more', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Sneaky', email: 'sneaky@test.com', password: 'pass1234', tier: 'PREMIUM',
      subscriptionStatus: 'ACTIVE', isAdmin: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.user.tier).toBe('FREE');
    const stored = await User.findOne({ email: 'sneaky@test.com' });
    expect(stored.tier).toBe('FREE');
    expect(stored.isAdmin).toBe(false);
  });

  test('login and /auth/profile report the server-side tier', async () => {
    await makeUser('PRO', { email: 'pro_login@test.com' });
    const login = await request(app).post('/api/auth/login').send({ email: 'pro_login@test.com', password: 'pass1234' });
    expect(login.body.user.tier).toBe('PRO');
    const profile = await request(app).get('/api/auth/profile').set(auth(login.body.token));
    expect(profile.body.user.tier).toBe('PRO');
    expect(profile.body.user).not.toHaveProperty('subscriptionProvider');
  });

  test('no self-service endpoint can raise a tier', async () => {
    const { user, token } = await makeUser('FREE');
    await request(app).patch('/api/auth/preferences').set(auth(token)).send({ language: 'en', tier: 'PREMIUM' });
    const attempts = [
      request(app).post('/api/tier/checkout').set(auth(token)).send({ tier: 'PREMIUM' }),
      request(app).patch(`/api/admin/students/${user._id}/tier`).set(auth(token)).send({ tier: 'PREMIUM' }),
    ];
    const [checkout, adminAttempt] = await Promise.all(attempts);
    expect(checkout.status).toBe(501); // honest: no payment provider, nothing purchased
    expect(checkout.body.code).toBe('PAYMENT_NOT_CONFIGURED');
    expect(adminAttempt.status).toBe(403);
    expect((await User.findById(user._id)).tier).toBe('FREE');
  });

  test('a forged tier header / body / query does not change what the server grants', async () => {
    const { token } = await makeUser('FREE');
    const res = await request(app)
      .get('/api/recommendations/mistake-recovery?tier=PREMIUM')
      .set({ ...auth(token), 'x-user-tier': 'PREMIUM' });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, code: 'TIER_UPGRADE_REQUIRED', requiredTier: 'PRO', currentTier: 'FREE' });
  });

  test('expired subscription is treated as FREE and reported', async () => {
    const { token } = await makeUser('PRO', { subscriptionStatus: 'ACTIVE', subscriptionEndDate: new Date('2020-01-01') });
    const me = await request(app).get('/api/tier/me').set(auth(token));
    expect(me.body.tier).toBe('FREE');
    expect(me.body.subscription).toMatchObject({ expired: true, status: 'EXPIRED', storedTier: 'PRO' });
    const res = await request(app).get('/api/recommendations/mistake-recovery').set(auth(token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SUBSCRIPTION_EXPIRED');
  });
});

describe('feature gating by tier (direct API calls)', () => {
  test('Free: refused on Pro / Premium endpoints', async () => {
    const { token } = await makeUser('FREE');
    const get = (p) => request(app).get(p).set(auth(token));
    expect((await get('/api/recommendations/mistake-recovery')).status).toBe(403);
    expect((await get('/api/recommendations/challenges')).body.requiredTier).toBe('PREMIUM');
    expect((await get('/api/recommendations/focus-session')).status).toBe(403);
    expect((await get('/api/gamification/history')).status).toBe(403);
    expect((await get('/api/exams/sessions/64b64b64b64b64b64b64b64b/report')).status).toBe(403);
  });

  test('Pro: Pro endpoints open, Premium-only endpoints refused', async () => {
    const { token } = await makeUser('PRO');
    const get = (p) => request(app).get(p).set(auth(token));
    expect((await get('/api/recommendations/mistake-recovery')).status).toBe(200);
    expect((await get('/api/gamification/history')).status).toBe(200);
    const challenges = await get('/api/recommendations/challenges');
    expect(challenges.status).toBe(403);
    expect(challenges.body).toMatchObject({ requiredTier: 'PREMIUM', currentTier: 'PRO' });
  });

  test('Premium: everything open', async () => {
    const { token } = await makeUser('PREMIUM');
    const get = (p) => request(app).get(p).set(auth(token));
    expect((await get('/api/recommendations/challenges')).status).toBe(200);
    expect((await get('/api/recommendations/mistake-recovery')).status).toBe(200);
    expect((await get('/api/gamification/history')).status).toBe(200);
  });

  test('every metered / gated route still demands authentication first', async () => {
    for (const [method, path] of [
      ['get', '/api/tier/me'], ['post', '/api/attempts'], ['post', '/api/ai/explain'],
      ['post', '/api/exams/sessions'], ['get', '/api/recommendations/challenges'],
    ]) {
      // eslint-disable-next-line no-await-in-loop
      expect((await request(app)[method](path)).status).toBe(401);
    }
  });

  test('/analytics/me strips advanced analytics for Free but not Pro', async () => {
    const free = await makeUser('FREE');
    const pro = await makeUser('PRO');
    const f = await request(app).get('/api/analytics/me').set(auth(free.token));
    const p = await request(app).get('/api/analytics/me').set(auth(pro.token));
    expect(f.body.tierAccess).toMatchObject({ advancedAnalytics: false });
    expect(f.body.topicMastery).toEqual([]);
    expect(f.body).not.toHaveProperty('benchmark');
    expect(p.body.tierAccess).toMatchObject({ advancedAnalytics: true });
    expect(p.body).toHaveProperty('benchmark');
  });
});

describe('usage limits (server-side, per tier, auto-resetting)', () => {
  test('Free practice quota: spent quota blocks attempts AND question fetches', async () => {
    const { user, token } = await makeUser('FREE');
    await spend(user, 'PRACTICE', 20);
    const attempt = await request(app).post('/api/attempts').set(auth(token)).send({});
    expect(attempt.status).toBe(429);
    expect(attempt.body).toMatchObject({ code: 'USAGE_LIMIT_REACHED', usageKey: 'PRACTICE', limit: 20, requiredTier: 'PRO' });
    expect((await request(app).get('/api/questions').set(auth(token))).status).toBe(429);
  });

  test('the same usage is under the limit on Pro (limit follows the DB tier)', async () => {
    const { user, token } = await makeUser('PRO');
    await spend(user, 'PRACTICE', 20);
    const attempt = await request(app).post('/api/attempts').set(auth(token)).send({});
    expect(attempt.status).toBe(400); // got past the quota; fails validation (empty body)
    const row = await UsageCounter.findOne({ user: user._id, key: 'PRACTICE' });
    expect(row.count).toBe(20); // the failed request was refunded
  });

  test('AI quota is enforced on direct calls; a failed request does not burn it', async () => {
    const { user, token } = await makeUser('FREE');
    await spend(user, 'AI', 5);
    const blocked = await request(app).post('/api/ai/explain').set(auth(token)).send({ questionId: 'x', message: 'hi' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.usageKey).toBe('AI');

    const other = await makeUser('FREE');
    const bad = await request(app).post('/api/ai/explain').set(auth(other.token)).send({ message: 'hi' });
    expect(bad.status).toBe(400);
    const row = await UsageCounter.findOne({ user: other.user._id, key: 'AI' });
    expect(!row || row.count === 0).toBe(true);
  });

  test('exam credits are monthly; a spent allowance blocks starting a simulation', async () => {
    const { user, token } = await makeUser('FREE');
    await spend(user, 'EXAMS', 2, 'month');
    const res = await request(app).post('/api/exams/sessions').set(auth(token)).send({ mode: 'full-length' });
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ usageKey: 'EXAMS', limit: 2 });
  });

  test('yesterday\'s usage does not count today (period key, no reset job)', async () => {
    const { user, token } = await makeUser('FREE');
    await UsageCounter.create({ user: user._id, key: 'PRACTICE', period: '2000-01-01', count: 20, expiresAt: new Date(Date.now() + 864e5) });
    const me = await request(app).get('/api/tier/me').set(auth(token));
    expect(me.body.usage.PRACTICE.used).toBe(0);
  });

  test('atomic: 30 concurrent reservations against a limit of 20 admit exactly 20', async () => {
    const { user } = await makeUser('FREE');
    const results = await Promise.all(
      Array.from({ length: 30 }, () => reserveUsage({ userId: user._id, tier: 'FREE', usageKey: 'PRACTICE' }))
    );
    expect(results.filter((r) => r.ok)).toHaveLength(20);
    expect((await UsageCounter.findOne({ user: user._id, key: 'PRACTICE' })).count).toBe(20);
  });

  test('Premium is "unlimited" in the API but still bounded by the fair-use ceiling', async () => {
    const { user, token } = await makeUser('PREMIUM');
    const me = await request(app).get('/api/tier/me').set(auth(token));
    expect(me.body.limits.aiPerDay).toBeNull();
    expect(me.body.usage.AI).toMatchObject({ unlimited: true, limit: null });
    const first = await reserveUsage({ userId: user._id, tier: 'PREMIUM', usageKey: 'AI' });
    expect(first.ok).toBe(true);
    expect(first.limit).toBeLessThan(Infinity);
  });
});

describe('admin tier management', () => {
  const makeAdmin = () => makeUser('FREE', { isAdmin: true, email: `admin_${Date.now()}@test.com` });

  test('admin can move a student between tiers; students list and detail show it', async () => {
    const admin = await makeAdmin();
    const { user } = await makeUser('FREE');
    const res = await request(app).patch(`/api/admin/students/${user._id}/tier`).set(auth(admin.token)).send({ tier: 'PRO' });
    expect(res.status).toBe(200);
    expect(res.body.student.tier).toBe('PRO');
    expect((await User.findById(user._id)).tier).toBe('PRO');

    const list = await request(app).get('/api/admin/students?tier=PRO').set(auth(admin.token));
    expect(list.body.students.map((s) => s.tier)).toContain('PRO');
    const detail = await request(app).get(`/api/admin/students/${user._id}`).set(auth(admin.token));
    expect(detail.body.student).toMatchObject({ tier: 'PRO', subscriptionStatus: 'ACTIVE' });
    expect(detail.body.usage).toHaveProperty('PRACTICE');
  });

  test('rejects invalid tiers, admin targets, and locks demo accounts', async () => {
    const admin = await makeAdmin();
    const { user } = await makeUser('FREE');
    const demo = await makeUser('PRO', { isDemo: true });
    const patch = (id, body) => request(app).patch(`/api/admin/students/${id}/tier`).set(auth(admin.token)).send(body);
    expect((await patch(user._id, { tier: 'GOLD' })).status).toBe(400);
    expect((await patch(user._id, { tier: 'pro' })).status).toBe(400);
    expect((await patch(admin.user._id, { tier: 'PRO' })).status).toBe(404);
    const locked = await patch(demo.user._id, { tier: 'FREE' });
    expect(locked.status).toBe(409);
    expect(locked.body.code).toBe('DEMO_ACCOUNT_LOCKED');
    expect((await User.findById(demo.user._id)).tier).toBe('PRO');
  });

  test('a demo account is subject to the same limits as everyone else', async () => {
    const demo = await makeUser('FREE', { isDemo: true });
    await spend(demo.user, 'PRACTICE', 20);
    expect((await request(app).post('/api/attempts').set(auth(demo.token)).send({})).status).toBe(429);
    expect((await request(app).get('/api/recommendations/challenges').set(auth(demo.token))).status).toBe(403);
    expect((await request(app).patch(`/api/admin/students/${demo.user._id}/tier`).set(auth(demo.token)).send({ tier: 'PREMIUM' })).status).toBe(403);
  });
});

describe('plans & checkout placeholder', () => {
  test('GET /api/tier/plans is public and carries the matrix; checkout never grants anything', async () => {
    const plans = await request(app).get('/api/tier/plans');
    expect(plans.status).toBe(200);
    expect(plans.body.plans.map((p) => p.tier)).toEqual(['FREE', 'PRO', 'PREMIUM']);
    expect(plans.body.matrix.ADVANCED_AI_TUTOR).toEqual({ FREE: 'NONE', PRO: 'NONE', PREMIUM: 'FULL' });
    expect(plans.body.paymentConfigured).toBe(false);

    const { user, token } = await makeUser('PRO');
    expect((await request(app).post('/api/tier/checkout').set(auth(token)).send({ tier: 'PRO' })).status).toBe(400);
    expect((await request(app).post('/api/tier/checkout').set(auth(token)).send({ tier: 'PREMIUM' })).status).toBe(501);
    expect((await User.findById(user._id)).tier).toBe('PRO');
  });
});

describe('pricing-page plan selection is never an entitlement', () => {
  test('a client-supplied plan on register is ignored; account starts FREE', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Plan Picker', email: 'planpicker@test.com', password: 'pass1234', plan: 'PREMIUM', selectedPlan: 'PRO',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.tier).toBe('FREE');
    expect((await User.findOne({ email: 'planpicker@test.com' })).tier).toBe('FREE');
  });

  test('checkout rejects FREE / unknown / missing plans and never changes the tier', async () => {
    const { user, token } = await makeUser('FREE');
    for (const tier of ['FREE', 'ADMIN', 'GOLD', '', undefined, 123]) {
      const res = await request(app).post('/api/tier/checkout').set(auth(token)).send({ tier });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_UPGRADE_TARGET');
    }
    const ok = await request(app).post('/api/tier/checkout').set(auth(token)).send({ tier: 'pro' });
    expect(ok.status).toBe(501); // valid target, but no payment provider: honest, nothing granted
    expect((await User.findById(user._id)).tier).toBe('FREE');
    expect((await request(app).post('/api/tier/checkout').send({ tier: 'PRO' })).status).toBe(401);
  });
});
