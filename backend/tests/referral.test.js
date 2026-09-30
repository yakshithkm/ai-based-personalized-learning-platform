const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Referral = require('../src/models/Referral');

jest.mock('../src/services/emailService', () => ({
  sendLoginConfirmationEmail: jest.fn().mockResolvedValue({ sent: true }),
  sendRegistrationConfirmationEmail: jest.fn().mockResolvedValue({ sent: true }),
  isSmtpConfigured: jest.fn().mockReturnValue(false),
}));

const registerPayload = (overrides = {}) => ({
  name: 'Referral Tester',
  email: `referral-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
  password: 'pass1234',
  targetExam: 'JEE',
  ...overrides,
});

describe('Referral / Invite Friends', () => {
  test('every newly registered user receives a unique referral code', async () => {
    const res = await request(app).post('/api/auth/register').send(registerPayload());

    expect(res.status).toBe(201);
    expect(res.body.user.referralCode).toBeDefined();
    expect(typeof res.body.user.referralCode).toBe('string');
    expect(res.body.user.referralCode.length).toBeGreaterThan(0);
  });

  test('referral codes are unique across users', async () => {
    const resA = await request(app).post('/api/auth/register').send(registerPayload());
    const resB = await request(app).post('/api/auth/register').send(registerPayload());

    expect(resA.body.user.referralCode).not.toBe(resB.body.user.referralCode);
  });

  test('registering with a valid referral code creates a Referral record and updates stats', async () => {
    const referrerRes = await request(app).post('/api/auth/register').send(registerPayload());
    const referrerCode = referrerRes.body.user.referralCode;
    const referrerToken = referrerRes.body.token;

    const referredRes = await request(app)
      .post('/api/auth/register')
      .send(registerPayload({ ref: referrerCode }));

    expect(referredRes.status).toBe(201);

    const referralDoc = await Referral.findOne({ referralCode: referrerCode });
    expect(referralDoc).not.toBeNull();
    expect(referralDoc.referredUser.toString()).toBe(referredRes.body.user._id.toString());

    const summaryRes = await request(app)
      .get('/api/referrals/me')
      .set('Authorization', `Bearer ${referrerToken}`);

    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.referralCode).toBe(referrerCode);
    expect(summaryRes.body.friendsInvited).toBe(1);
    expect(summaryRes.body.successfulSignups).toBe(1);
  });

  test('an invalid/unknown referral code is ignored and registration still succeeds', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(registerPayload({ ref: 'NOTREAL1' }));

    expect(res.status).toBe(201);
    const referralCount = await Referral.countDocuments({});
    expect(referralCount).toBe(0);
  });

  test('a user cannot end up with duplicate referral credit', async () => {
    const referrerRes = await request(app).post('/api/auth/register').send(registerPayload());
    const referrerCode = referrerRes.body.user.referralCode;

    const referredRes = await request(app)
      .post('/api/auth/register')
      .send(registerPayload({ ref: referrerCode }));

    // Directly attempting a second Referral record for the same referredUser
    // must be rejected by the unique index, regardless of API-level checks.
    await expect(
      Referral.create({
        referrer: referrerRes.body.user._id,
        referredUser: referredRes.body.user._id,
        referralCode: referrerCode,
      })
    ).rejects.toThrow();

    const count = await Referral.countDocuments({ referredUser: referredRes.body.user._id });
    expect(count).toBe(1);
  });

  test('users created before the referral feature existed get a code lazily backfilled on login', async () => {
    // Simulate a pre-existing user by clearing the referralCode a normal
    // registration would have generated.
    const payload = registerPayload();
    await request(app).post('/api/auth/register').send(payload);
    await User.updateOne({ email: payload.email }, { $unset: { referralCode: '' } });

    const before = await User.findOne({ email: payload.email });
    expect(before.referralCode).toBeUndefined();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: payload.password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.referralCode).toBeDefined();
  });

  test('GET /api/referrals/me requires authentication', async () => {
    const res = await request(app).get('/api/referrals/me');
    expect(res.status).toBe(401);
  });
});