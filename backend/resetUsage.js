require('dotenv').config();

/**
 * Clears plan-usage counters (practice / AI / recommendations / exams) so quotas start from zero.
 * Does NOT touch attempts, XP, tiers or any other data.
 *
 *   npm run reset:usage -- free.demo@learning.com     one user
 *   npm run reset:usage -- --demo                     every demo account
 *   npm run reset:usage -- --all                      everyone
 */
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const User = require('./src/models/User');
const UsageCounter = require('./src/models/UsageCounter');

const run = async () => {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npm run reset:usage -- <email> | --demo | --all');
    process.exitCode = 1;
    return;
  }
  try {
    await connectDB();
    let filter;
    if (arg === '--all') filter = {};
    else if (arg === '--demo') {
      const ids = (await User.find({ isDemo: true }).select('_id').lean()).map((u) => u._id);
      filter = { user: { $in: ids } };
    } else {
      const user = await User.findOne({ email: arg.toLowerCase() }).select('_id').lean();
      if (!user) throw new Error(`No user with email ${arg}`);
      filter = { user: user._id };
    }
    const result = await UsageCounter.deleteMany(filter);
    console.log(`Cleared ${result.deletedCount} usage counter(s).`);
  } catch (error) {
    console.error('Reset failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();