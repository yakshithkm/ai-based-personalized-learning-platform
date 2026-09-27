const User = require('../src/models/User');
const GamificationProfile = require('../src/models/GamificationProfile');
const { backfillUserGamification } = require('../src/services/gamification/backfillService');

// Bulk pre-warm: runs the one-time historical backfill (see
// services/gamification/backfillService.js) for every user up front, rather
// than paying the (small, one-time) cost on whichever request happens to hit
// it first. Useful to run once right after this feature ships, so no real
// user or demo account's first page load is the one that pays for their own
// backfill. Safe to re-run any time - already-backfilled users are a no-op.
const backfillAllUsers = async () => {
  const users = await User.find({}).select('_id email').lean();
  const results = [];

  for (const user of users) {
    // Sequential on purpose - keeps DB load light and keeps any one user's
    // failure from aborting the rest of the run.
    // eslint-disable-next-line no-await-in-loop
    const before = await GamificationProfile.findOne({ user: user._id }).select('historicalBackfillCompletedAt').lean();
    const alreadyDone = Boolean(before?.historicalBackfillCompletedAt);
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await backfillUserGamification(user._id);
      results.push({ email: user.email, ...result, alreadyDone });
    } catch (error) {
      results.push({ email: user.email, ran: false, error: error.message });
    }
  }

  return results;
};

module.exports = { backfillAllUsers };