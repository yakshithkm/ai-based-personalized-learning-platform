const mongoose = require('mongoose');

// One document per successful referred registration. `referredUser` is unique
// so a given user can be credited to at most one referrer, ever - this is
// what prevents duplicate referral credit and a user's referrer being changed
// after the fact (there is no update path; the record is only ever created
// once, at registration).
const referralSchema = new mongoose.Schema(
  {
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    referredUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    referralCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Referral', referralSchema);