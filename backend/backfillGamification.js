require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const { backfillAllUsers } = require('./scripts/backfillGamification');

const run = async () => {
  try {
    await connectDB();
    const results = await backfillAllUsers();

    const ran = results.filter((r) => r.ran);
    const skippedAlready = results.filter((r) => !r.ran && r.alreadyBackfilled);
    const failed = results.filter((r) => r.error);

    console.log(`\nGamification backfill complete for ${results.length} user(s):\n`);
    ran.forEach((r) => {
      console.log(
        `- ${r.email}: processed ${r.processedCount} historical event(s), ` +
          `streak ${r.historicalStreak?.currentStreak ?? 0} (longest ${r.historicalStreak?.longestStreak ?? 0})`
      );
    });
    console.log(`\n${ran.length} backfilled, ${skippedAlready.length} already done, ${failed.length} failed.`);
    if (failed.length) {
      console.log('\nFailures:');
      failed.forEach((r) => console.log(`- ${r.email}: ${r.error}`));
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('\nGamification backfill failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();