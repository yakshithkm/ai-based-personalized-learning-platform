require('dotenv').config();

/**
 * One-off, idempotent migration for the tier system. Safe to run any number of times.
 *   1. Every user document without a `tier` gets tier FREE (+ ACTIVE status). New code already
 *      reads a missing tier as FREE, so this is for clean data / admin filters / indexes, not
 *      correctness - the app works before and after it runs.
 *   2. The legacy exam demo accounts (neet/cet/jee@learning.com, isDemo) are PREMIUM, matching
 *      src/data/demoProfiles.js, WITHOUT wiping their seeded data (unlike `npm run seed:demo`).
 * Real (non-demo) users are never upgraded here.
 */
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const User = require('./src/models/User');
const UsageCounter = require('./src/models/UsageCounter');
const { DEMO_PROFILES } = require('./src/data/demoProfiles');
const { applySubscription } = require('./src/services/tier/subscriptionService');

const run = async () => {
  try {
    await connectDB();

    const backfill = await User.updateMany(
      { tier: { $exists: false } },
      { $set: { tier: 'FREE', subscriptionStatus: 'ACTIVE' } }
    );
    console.log(`Backfilled tier=FREE on ${backfill.modifiedCount} user(s).`);

    for (const profile of DEMO_PROFILES) {
      // eslint-disable-next-line no-await-in-loop
      const user = await User.findOne({ email: profile.email, isDemo: true });
      if (user && (user.tier !== profile.tier || !user.subscriptionProvider)) {
        // eslint-disable-next-line no-await-in-loop
        await applySubscription(user._id, { tier: profile.tier, provider: 'demo' });
        console.log(`Provisioned demo ${profile.email} as ${profile.tier}.`);
      }
    }

    // Build the indexes (unique counter key + TTL cleanup) up front rather than lazily.
    await UsageCounter.init();
    await User.init();
    console.log('Done. Run "npm run seed:demo" to create the Free / Pro / Premium demo accounts.');
  } catch (error) {
    console.error('Tier migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
