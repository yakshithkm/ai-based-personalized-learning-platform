const Referral = require('../models/Referral');

// Server-authoritative summary for the "Invite Friends" panel. The invite
// code always comes from the User document (never trusted from the client),
// and both counters are computed from real Referral records - there is no
// separate "invited but not signed up" state to track in this codebase, so
// both numbers reflect actual successful signups rather than a fabricated
// distinction.
const getMyReferralSummary = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user.referralCode) {
      // Lazily backfills a referral code for any account created before this
      // feature existed - the User pre-save hook generates it.
      await user.save();
    }

    const totalReferrals = await Referral.countDocuments({ referrer: user._id });

    return res.json({
      referralCode: user.referralCode,
      friendsInvited: totalReferrals,
      successfulSignups: totalReferrals,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getMyReferralSummary };