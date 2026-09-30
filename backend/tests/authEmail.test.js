const request = require('supertest');
const app = require('../src/app');
const { sendLoginConfirmationEmail } = require('../src/services/emailService');

jest.mock('../src/services/emailService', () => ({
  sendLoginConfirmationEmail: jest.fn().mockResolvedValue({ sent: true }),
  sendRegistrationConfirmationEmail: jest.fn().mockResolvedValue({ sent: true }),
  isSmtpConfigured: jest.fn().mockReturnValue(true),
}));

const waitForMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

const registerPayload = (overrides = {}) => ({
  name: 'Email Tester',
  email: `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
  password: 'pass1234',
  targetExam: 'JEE',
  ...overrides,
});

describe('Login confirmation email', () => {
  beforeEach(() => {
    sendLoginConfirmationEmail.mockClear();
  });

  test('a successful login triggers the login confirmation email service', async () => {
    const payload = registerPayload();
    await request(app).post('/api/auth/register').send(payload);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: payload.password });

    expect(res.status).toBe(200);
    await waitForMicrotasks();
    expect(sendLoginConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(sendLoginConfirmationEmail.mock.calls[0][0].email).toBe(payload.email);
  });

  test('a failed login (wrong password) does not trigger the email service', async () => {
    const payload = registerPayload();
    await request(app).post('/api/auth/register').send(payload);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    await waitForMicrotasks();
    expect(sendLoginConfirmationEmail).not.toHaveBeenCalled();
  });

  test('a failed login (unknown email) does not trigger the email service', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'whatever1' });

    expect(res.status).toBe(401);
    await waitForMicrotasks();
    expect(sendLoginConfirmationEmail).not.toHaveBeenCalled();
  });

  test('an admin account hitting the student login endpoint does not trigger the email service', async () => {
    // Admin accounts always reject at the student login endpoint (see
    // authController.loginUser) before the email step is ever reached.
    const User = require('../src/models/User');
    const admin = await User.create({
      name: 'Admin Tester',
      email: `admin-${Date.now()}@test.com`,
      password: 'adminpass1',
      isAdmin: true,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: 'adminpass1' });

    expect(res.status).toBe(403);
    await waitForMicrotasks();
    expect(sendLoginConfirmationEmail).not.toHaveBeenCalled();
  });

  test('email service failure does not make login fail, and no SMTP details leak in the response', async () => {
    sendLoginConfirmationEmail.mockRejectedValueOnce(new Error('SMTP connection refused'));

    const payload = registerPayload();
    await request(app).post('/api/auth/register').send(payload);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: payload.password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(JSON.stringify(res.body)).not.toMatch(/SMTP/i);
  });

  test('login response never includes SMTP credentials or internal email errors', async () => {
    const payload = registerPayload();
    await request(app).post('/api/auth/register').send(payload);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: payload.password });

    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/SMTP_PASSWORD/i);
    expect(body).not.toMatch(/smtp_pass/i);
  });
});