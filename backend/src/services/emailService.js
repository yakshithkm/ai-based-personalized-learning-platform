const nodemailer = require('nodemailer');

// Lazily built and cached - importing this module must never throw just
// because SMTP env vars aren't set yet (e.g. in tests, or before an operator
// has configured mail). Every send call re-checks configuration instead of
// failing at require-time.
let cachedTransporter = null;

const isSmtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.MAIL_FROM);

const getTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
  });

  return cachedTransporter;
};

const formatLoginTime = (date) =>
  date.toLocaleString('en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });

// Sends the "you just signed in" confirmation email. Never throws - a mail
// failure must not be able to fail the login it's reporting on. Callers
// should still log the returned { sent: false, error } result themselves for
// their own visibility; this function only guarantees it won't throw.
const sendLoginConfirmationEmail = async (user) => {
  if (!isSmtpConfigured()) {
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const loginTime = formatLoginTime(new Date());
  const subject = 'TutorMind Login Confirmation';
  const text = `Hi ${user.name},

Your TutorMind account was successfully signed in.

Login time: ${loginTime}

If this was you, no action is required.

If you did not recognize this login, please secure your account immediately.

Regards,
TutorMind Team`;

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #0f172a; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #4f46e5; margin-bottom: 4px;">TutorMind</h2>
      <p>Hi ${user.name},</p>
      <p>Your TutorMind account was successfully signed in.</p>
      <p style="background: #f1f5f9; padding: 10px 14px; border-radius: 8px;">
        <strong>Login time:</strong> ${loginTime}
      </p>
      <p>If this was you, no action is required.</p>
      <p>If you did not recognize this login, please secure your account immediately.</p>
      <p style="color: #64748b; margin-top: 24px;">Regards,<br />TutorMind Team</p>
    </div>
  `;

  try {
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM,
      to: user.email,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (error) {
    // Never expose SMTP internals to the caller/API response - only the
    // backend log gets the detail.
    // eslint-disable-next-line no-console
    console.error('Failed to send login confirmation email:', error.message);
    return { sent: false, reason: 'send_failed' };
  }
};

// Sends the "your account was created" welcome email after successful
// registration. Same contract as sendLoginConfirmationEmail: never throws -
// a mail failure must not be able to fail the registration it's reporting on.
const sendRegistrationConfirmationEmail = async (user) => {
  if (!isSmtpConfigured()) {
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const subject = 'Welcome to TutorMind!';
  const text = `Hi ${user.name},

Your TutorMind account has been created successfully.

Email: ${user.email}
Target exam: ${user.targetExam}

You're all set to start practicing, track your progress, and prepare smarter for your exam.

Regards,
TutorMind Team`;

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #0f172a; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #4f46e5; margin-bottom: 4px;">TutorMind</h2>
      <p>Hi ${user.name},</p>
      <p>Your TutorMind account has been created successfully.</p>
      <p style="background: #f1f5f9; padding: 10px 14px; border-radius: 8px;">
        <strong>Email:</strong> ${user.email}<br />
        <strong>Target exam:</strong> ${user.targetExam}
      </p>
      <p>You're all set to start practicing, track your progress, and prepare smarter for your exam.</p>
      <p style="color: #64748b; margin-top: 24px;">Regards,<br />TutorMind Team</p>
    </div>
  `;

  try {
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM,
      to: user.email,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to send registration confirmation email:', error.message);
    return { sent: false, reason: 'send_failed' };
  }
};

module.exports = {
  sendLoginConfirmationEmail,
  sendRegistrationConfirmationEmail,
  isSmtpConfigured,
};