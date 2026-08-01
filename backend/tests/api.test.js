const request = require('supertest');
const app = require('../src/app');

describe('API smoke tests', () => {
  test('GET /api/health returns backend status', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('POST /api/auth/register creates a user and returns token', async () => {
    const payload = {
      name: 'Integration Tester',
      email: 'integration@test.com',
      password: 'pass1234',
      targetExam: 'JEE',
    };

    const registerRes = await request(app).post('/api/auth/register').send(payload);

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.token).toBeDefined();
    expect(registerRes.body.user.email).toBe(payload.email);
  });

  test('POST /api/auth/login authenticates existing user', async () => {
    const payload = {
      name: 'Login Tester',
      email: 'login@test.com',
      password: 'pass1234',
      targetExam: 'NEET',
    };

    await request(app).post('/api/auth/register').send(payload);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: payload.email,
      password: payload.password,
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();
    expect(loginRes.body.user.targetExam).toBe('NEET');
  });
});
