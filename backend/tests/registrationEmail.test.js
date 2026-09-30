const request = require('supertest');
const app = require('../src/app');
const { sendRegistrationConfirmationEmail } = require('../src/services/emailService');

jest.mock('../src/services/emailService', () => ({
  sendLoginConfirmationEmail: jest.fn().mockResolvedValue({ sent: true }),
  sendRegistrationConfirmationEmail: jest.fn().mockResolvedValue({ sent: true }),
  isSmtpConfigured: jest.fn().mockReturnValue(true),
}));

const waitForMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

const registerPayload = (overrides = {}) => ({
  name: 'Welcome Tester',
  email: `welcome-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
  password: 'pass1234',
  targetExam: 'NEET',
  ...overrides,
});

describe('Registration confirmation email', () => {
  beforeEach(() => {
    sendRegistrationConfirmationEmail.mockClear();
  });

  test('a successful registration triggers the registration confirmation email service', async () => {
    const payload = registerPayload();

    const res = await request(app).post('/api/auth/register').send(payload);

    expect(res.status).toBe(201);
    await waitForMicrotasks();
    expect(sendRegistrationConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(sendRegistrationConfirmationEmail.mock.calls[0][0].email).toBe(payload.email);
  });

  test('a failed registration (duplicate email) does not trigger the email service', async () => {
    const payload = registerPayload();
    await request(app).post('/api/auth/register').send(payload);
    sendRegistrationConfirmationEmail.mockClear();

    const res = await request(app).post('/api/auth/register').send(payload);

    expect(res.status).toBe(400);
    await waitForMicrotasks();
    expect(sendRegistrationConfirmationEmail).not.toHaveBeenCalled();
  });

  test('a failed registration (missing required fields) does not trigger the email service', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'incomplete@test.com', password: 'pass1234' });

    expect(res.status).toBe(400);
    await waitForMicrotasks();
    expect(sendRegistrationConfirmationEmail).not.toHaveBeenCalled();
  });

  test('registration email failure does not make registration fail, and no SMTP details leak in the response', async () => {
    sendRegistrationConfirmationEmail.mockRejectedValueOnce(new Error('SMTP connection refused'));

    const res = await request(app).post('/api/auth/register').send(registerPayload());

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(JSON.stringify(res.body)).not.toMatch(/SMTP/i);
  });
});