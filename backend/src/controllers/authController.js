const User = require('../models/User');
const Referral = require('../models/Referral');
const generateToken = require('../utils/generateToken');
const { normalizeExamType } = require('../config/examSubjectMap');
const { sendLoginConfirmationEmail, sendRegistrationConfirmationEmail } = require('../services/emailService');
const {
  getUserLastEvent,
  trackProductEvent,
  dayKey,
} = require('../services/eventTrackingService');

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  targetExam: user.targetExam,
  isAdmin: Boolean(user.isAdmin),
  isDemo: Boolean(user.isDemo),
  referralCode: user.referralCode,
});

const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, targetExam, exam, ref } = req.body;
    const normalizedExam = normalizeExamType(targetExam || exam || '');

    if (!name || !email || !password) {
      res.status(400);
      throw new Error('Name, email and password are required');
    }

    const exists = await User.findOne({ email });
    if (exists) {
      res.status(400);
      throw new Error('User already exists with this email');
    }

    // Referral is resolved server-side, from the database, before the new
    // account is created - the client only ever supplies the code string, never
    // a referrer id or referral status. An unknown/invalid code is silently
    // ignored rather than blocking registration.
    let referrer = null;
    const normalizedRef = typeof ref === 'string' ? ref.trim().toUpperCase() : '';
    if (normalizedRef) {
      referrer = await User.findOne({ referralCode: normalizedRef });
    }

    const user = await User.create({
      name,
      email,
      password,
      targetExam: normalizedExam || 'JEE',
    });

    // Self-referral is structurally impossible here (the referrer has to already
    // exist before this brand-new user does), but the check stays as defense in depth.
    if (referrer && referrer._id.toString() !== user._id.toString()) {
      try {
        await Referral.create({
          referrer: referrer._id,
          referredUser: user._id,
          referralCode: normalizedRef,
        });
      } catch (referralError) {
        // E11000 here means a Referral record already exists for this
        // referredUser (the unique index) - never let that block or duplicate
        // the registration that already succeeded.
        if (referralError?.code !== 11000) {
          // eslint-disable-next-line no-console
          console.error('Failed to record referral:', referralError.message);
        }
      }
    }

    // Fire-and-forget, same pattern as the login confirmation email: a
    // successful registration must never fail (or be delayed) because the
    // welcome email couldn't be sent. sendRegistrationConfirmationEmail never
    // throws, but this is additionally not awaited so a slow SMTP server
    // can't hold up the registration response either.
    sendRegistrationConfirmationEmail(user).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Unexpected error sending registration confirmation email:', error.message);
    });

    return res.status(201).json({
      user: sanitizeUser(user),
      token: generateToken(user._id),
    });
  } catch (error) {
    return next(error);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error('Email and password are required');
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    // Admin accounts authenticate exclusively through POST /api/admin/login (see
    // adminAuthController.js) - the credentials are valid, but this isn't the
    // right door. Rejecting here (rather than letting the admin land inside the
    // student app) keeps the two roles' auth flows genuinely separate, as required,
    // and avoids the confusing state of an admin browsing as a fake "student" with
    // no real practice history.
    if (user.isAdmin) {
      res.status(403);
      throw new Error('This account is an admin account. Please sign in at /admin/login instead.');
    }

    const normalizedExam = normalizeExamType(user.targetExam || user.exam || '');

    if (normalizedExam && user.targetExam !== normalizedExam) {
      user.targetExam = normalizedExam;
      await user.save();
    }

    if (!user.referralCode) {
      // Lazy backfill for accounts created before the referral feature existed -
      // the User model's pre-save hook generates the code.
      await user.save();
    }

    const lastEvent = await getUserLastEvent(user._id);
    if (lastEvent?.createdAt) {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      if (dayKey(lastEvent.createdAt) === dayKey(yesterday)) {
        await trackProductEvent({
          userId: user._id,
          eventType: 'returned_next_day',
          metadata: { previousActiveDay: dayKey(yesterday) },
        });
      }
    }

    // Fire-and-forget: a successful login must never fail (or be delayed)
    // because the confirmation email couldn't be sent. sendLoginConfirmationEmail
    // never throws, but this is additionally not awaited so a slow SMTP server
    // can't hold up the login response either.
    sendLoginConfirmationEmail(user).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Unexpected error sending login confirmation email:', error.message);
    });

    return res.json({
      user: sanitizeUser(user),
      token: generateToken(user._id),
    });
  } catch (error) {
    return next(error);
  }
};

const getProfile = async (req, res) => {
  res.json({ user: req.user });
};

module.exports = { registerUser, loginUser, getProfile };