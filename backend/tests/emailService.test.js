jest.mock('nodemailer');
const nodemailer = require('nodemailer');

// emailService caches its transporter at module scope, so each test clears
// only that module from the require cache (not the mocked 'nodemailer'
// module itself) and re-requires it fresh.
const loadEmailService = () => {
  jest.resetModules();
  // Re-registering the mock after resetModules keeps `nodemailer` (the
  // reference captured above) as the exact instance emailService will get.
  jest.doMock('nodemailer', () => nodemailer);
  // eslint-disable-next-line global-require
  return require('../src/services/emailService');
};

describe('emailService', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.clearAllMocks();
  });

  test('does not attempt to send (and does not throw) when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.MAIL_FROM;

    const sendMail = jest.fn();
    nodemailer.createTransport.mockReturnValue({ sendMail });

    const { sendLoginConfirmationEmail } = loadEmailService();
    const result = await sendLoginConfirmationEmail({ name: 'Test User', email: 'test@example.com' });

    expect(result).toEqual({ sent: false, reason: 'smtp_not_configured' });
    expect(sendMail).not.toHaveBeenCalled();
  });

  test('sends via the configured SMTP transport when fully configured', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'user@example.com';
    process.env.SMTP_PASSWORD = 'super-secret';
    process.env.MAIL_FROM = 'TutorMind <noreply@tutormind.test>';

    const sendMail = jest.fn().mockResolvedValue({ messageId: 'abc' });
    nodemailer.createTransport.mockReturnValue({ sendMail });

    const { sendLoginConfirmationEmail } = loadEmailService();
    const result = await sendLoginConfirmationEmail({ name: 'Test User', email: 'test@example.com' });

    expect(result).toEqual({ sent: true });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const sentMessage = sendMail.mock.calls[0][0];
    expect(sentMessage.to).toBe('test@example.com');
    expect(sentMessage.subject).toBe('TutorMind Login Confirmation');
  });

  test('never throws when the SMTP transport itself fails, and never leaks the credential', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'user@example.com';
    process.env.SMTP_PASSWORD = 'super-secret';
    process.env.MAIL_FROM = 'TutorMind <noreply@tutormind.test>';

    const sendMail = jest.fn().mockRejectedValue(new Error('535 Authentication failed for super-secret'));
    nodemailer.createTransport.mockReturnValue({ sendMail });

    const { sendLoginConfirmationEmail } = loadEmailService();
    const result = await sendLoginConfirmationEmail({ name: 'Test User', email: 'test@example.com' });

    expect(result).toEqual({ sent: false, reason: 'send_failed' });
    expect(JSON.stringify(result)).not.toMatch(/super-secret/);
  });

  test('sendRegistrationConfirmationEmail sends a welcome email via the configured SMTP transport', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'user@example.com';
    process.env.SMTP_PASSWORD = 'super-secret';
    process.env.MAIL_FROM = 'TutorMind <noreply@tutormind.test>';

    const sendMail = jest.fn().mockResolvedValue({ messageId: 'abc' });
    nodemailer.createTransport.mockReturnValue({ sendMail });

    const { sendRegistrationConfirmationEmail } = loadEmailService();
    const result = await sendRegistrationConfirmationEmail({
      name: 'Test User',
      email: 'test@example.com',
      targetExam: 'JEE',
    });

    expect(result).toEqual({ sent: true });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const sentMessage = sendMail.mock.calls[0][0];
    expect(sentMessage.to).toBe('test@example.com');
    expect(sentMessage.subject).toBe('Welcome to TutorMind!');
  });

  test('sendRegistrationConfirmationEmail does not throw when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.MAIL_FROM;

    const sendMail = jest.fn();
    nodemailer.createTransport.mockReturnValue({ sendMail });

    const { sendRegistrationConfirmationEmail } = loadEmailService();
    const result = await sendRegistrationConfirmationEmail({ name: 'Test User', email: 'test@example.com' });

    expect(result).toEqual({ sent: false, reason: 'smtp_not_configured' });
    expect(sendMail).not.toHaveBeenCalled();
  });
});