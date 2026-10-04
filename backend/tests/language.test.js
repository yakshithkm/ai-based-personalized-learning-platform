const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const {
  normalizeLanguage,
  resolveRequestLanguage,
  SUPPORTED_CODES,
} = require('../src/config/languages');
const { buildLanguageDirective } = require('../src/services/ai/aiService');

jest.mock('../src/services/emailService', () => ({
  sendLoginConfirmationEmail: jest.fn().mockResolvedValue({ sent: true }),
  sendRegistrationConfirmationEmail: jest.fn().mockResolvedValue({ sent: true }),
  isSmtpConfigured: jest.fn().mockReturnValue(false),
}));

const registerPayload = (overrides = {}) => ({
  name: 'Language Tester',
  email: `lang-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
  password: 'pass1234',
  targetExam: 'JEE',
  ...overrides,
});

describe('language config helpers', () => {
  test('supports exactly the six UI languages', () => {
    expect(SUPPORTED_CODES).toEqual(['en', 'kn', 'hi', 'te', 'ta', 'ml']);
  });

  test('normalizes region tags and rejects unknown languages', () => {
    expect(normalizeLanguage('kn-IN')).toBe('kn');
    expect(normalizeLanguage(' HI ')).toBe('hi');
    expect(normalizeLanguage('fr')).toBeNull();
    expect(normalizeLanguage(undefined)).toBeNull();
  });

  test('request language: body wins, then Accept-Language, then English', () => {
    expect(resolveRequestLanguage({ body: { language: 'ta' }, headers: { 'accept-language': 'kn' } })).toBe('ta');
    expect(resolveRequestLanguage({ body: {}, headers: { 'accept-language': 'ml-IN,en;q=0.5' } })).toBe('ml');
    expect(resolveRequestLanguage({ body: {}, headers: { 'accept-language': 'fr-FR' } })).toBe('en');
    expect(resolveRequestLanguage({})).toBe('en');
  });
});

describe('AI language directive', () => {
  test('adds nothing for English', () => {
    expect(buildLanguageDirective('en')).toBe('');
    expect(buildLanguageDirective('xx')).toBe('');
  });

  test('instructs the model to answer in the selected language and keep technical terms', () => {
    const directive = buildLanguageDirective('kn');
    expect(directive).toContain('Kannada');
    expect(directive).toContain('ಕನ್ನಡ');
    expect(directive).toMatch(/technical terms/i);
  });
});

describe('preferred language on the user profile', () => {
  test('a new user has no stored preference by default', async () => {
    const res = await request(app).post('/api/auth/register').send(registerPayload());
    expect(res.status).toBe(201);
    expect(res.body.user.preferredLanguage).toBeNull();
  });

  test('registration stores a supported language and ignores an unsupported one', async () => {
    const ok = await request(app).post('/api/auth/register').send(registerPayload({ language: 'kn-IN' }));
    expect(ok.body.user.preferredLanguage).toBe('kn');

    const bad = await request(app).post('/api/auth/register').send(registerPayload({ language: 'klingon' }));
    expect(bad.status).toBe(201);
    expect(bad.body.user.preferredLanguage).toBeNull();
  });

  test('PATCH /api/auth/preferences saves the language and it is returned by /profile', async () => {
    const reg = await request(app).post('/api/auth/register').send(registerPayload());
    const auth = { Authorization: `Bearer ${reg.body.token}` };

    const patch = await request(app).patch('/api/auth/preferences').set(auth).send({ language: 'te' });
    expect(patch.status).toBe(200);
    expect(patch.body.user.preferredLanguage).toBe('te');

    const profile = await request(app).get('/api/auth/profile').set(auth);
    expect(profile.body.user.preferredLanguage).toBe('te');
    expect((await User.findById(reg.body.user._id)).preferredLanguage).toBe('te');
  });

  test('PATCH /api/auth/preferences rejects unsupported languages and unauthenticated calls', async () => {
    const reg = await request(app).post('/api/auth/register').send(registerPayload());
    const auth = { Authorization: `Bearer ${reg.body.token}` };

    const bad = await request(app).patch('/api/auth/preferences').set(auth).send({ language: 'xx' });
    expect(bad.status).toBe(400);

    const anon = await request(app).patch('/api/auth/preferences').send({ language: 'hi' });
    expect(anon.status).toBe(401);
  });
});