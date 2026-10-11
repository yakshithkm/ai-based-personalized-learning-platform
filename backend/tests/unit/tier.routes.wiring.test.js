// Exercises the REAL express app + routers with only the user lookup stubbed, so no MongoDB is
// needed. Every request below must be refused by the tier layer BEFORE any controller/DB code
// runs - which is exactly the property being verified.
jest.mock('../../src/models/User', () => {
  const store = new Map();
  const model = {
    __store: store,
    findById: (id) => ({ select: async () => store.get(String(id)) || null }),
  };
  return model;
});
const request = require('supertest');
const User = require('../../src/models/User');
const generateToken = require('../../src/utils/generateToken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit_secret';
const app = require('../../src/app');

const add = (id, fields) => {
  User.__store.set(id, { _id: id, name: id, email: `${id}@t.com`, isAdmin: false, ...fields });
  return { Authorization: `Bearer ${generateToken(id)}` };
};
const FREE = () => add('free1', { tier: 'FREE' });
const PRO = () => add('pro1', { tier: 'PRO' });
const LEGACY = () => add('legacy1', {}); // pre-migration user: no tier field at all
const EXPIRED = () => add('exp1', { tier: 'PREMIUM', subscriptionStatus: 'ACTIVE', subscriptionEndDate: new Date('2020-01-01') });

const FREE_BLOCKED = [
  ['get', '/api/recommendations/mistake-recovery', 'PRO'],
  ['get', '/api/recommendations/challenges', 'PREMIUM'],
  ['get', '/api/recommendations/focus-session', 'PRO'],
  ['get', '/api/gamification/history', 'PRO'],
  ['get', '/api/exams/sessions/64b64b64b64b64b64b64b64b/report', 'PRO'],
  ['get', '/api/exams/sessions/64b64b64b64b64b64b64b64b/certificate', 'PRO'],
];

describe.each(FREE_BLOCKED)('Free user, direct call: %s %s', (method, path, requiredTier) => {
  test(`403 TIER_UPGRADE_REQUIRED (needs ${requiredTier})`, async () => {
    const res = await request(app)[method](path).set(FREE());
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, code: 'TIER_UPGRADE_REQUIRED', requiredTier, currentTier: 'FREE' });
  });
  test('a legacy user with no tier field is treated as FREE (same refusal)', async () => {
    const res = await request(app)[method](path).set(LEGACY());
    expect(res.status).toBe(403);
    expect(res.body.currentTier).toBe('FREE');
  });
  test('an expired Premium subscription is refused as SUBSCRIPTION_EXPIRED', async () => {
    const res = await request(app)[method](path).set(EXPIRED());
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'SUBSCRIPTION_EXPIRED', currentTier: 'FREE' });
  });
  test('client-supplied tier hints change nothing', async () => {
    const res = await request(app)[method](path + '?tier=PREMIUM').set({ ...FREE(), 'x-tier': 'PREMIUM' });
    expect(res.status).toBe(403);
  });
  test('unauthenticated -> 401', async () => {
    expect((await request(app)[method](path)).status).toBe(401);
  });
});

test('Pro user is refused on a Premium-only endpoint with the right body', async () => {
  const res = await request(app).get('/api/recommendations/challenges').set(PRO());
  expect(res.status).toBe(403);
  expect(res.body).toMatchObject({ requiredTier: 'PREMIUM', currentTier: 'PRO', code: 'TIER_UPGRADE_REQUIRED' });
});

test('a non-admin cannot reach the admin tier endpoint, whatever tier they hold', async () => {
  const res = await request(app).patch('/api/admin/students/64b64b64b64b64b64b64b64b/tier').set(add('pre1', { tier: 'PREMIUM' })).send({ tier: 'PREMIUM' });
  expect(res.status).toBe(403);
});

test('plans endpoint is public and checkout is an honest 501 that grants nothing', async () => {
  const plans = await request(app).get('/api/tier/plans');
  expect(plans.status).toBe(200);
  expect(plans.body.paymentConfigured).toBe(false);
  const res = await request(app).post('/api/tier/checkout').set(FREE()).send({ tier: 'PRO' });
  expect(res.status).toBe(501);
  expect(res.body.code).toBe('PAYMENT_NOT_CONFIGURED');
});
