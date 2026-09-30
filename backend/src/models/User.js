const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const generateReferralCode = require('../utils/generateReferralCode');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    targetExam: {
      type: String,
      enum: ['NEET', 'JEE', 'CET'],
      default: 'JEE',
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isDemo: {
      type: Boolean,
      default: false,
    },
    // Stable, auto-generated invite code for the "Invite Friends" feature (see
    // referralController.js / Referral model). Sparse+unique so existing users
    // predating this feature don't collide on a shared `null` before they get
    // one lazily backfilled (see loginUser / getMyReferralSummary).
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function save(next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  return next();
});

// Auto-generates a unique referral code for every user - new registrations get
// one immediately, and any pre-existing user without one receives it the next
// time they're saved (see the lazy backfill in loginUser / getMyReferralSummary),
// so no manual migration script is required.
userSchema.pre('save', async function assignReferralCode(next) {
  if (this.referralCode) {
    return next();
  }

  const Model = this.constructor;
  let code;
  let collision = true;
  while (collision) {
    code = generateReferralCode();
    // eslint-disable-next-line no-await-in-loop
    collision = Boolean(await Model.exists({ referralCode: code }));
  }
  this.referralCode = code;
  return next();
});

userSchema.methods.matchPassword = function matchPassword(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);