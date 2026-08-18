require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const { seedDemoAccounts } = require('./scripts/seedDemoAccounts');

const run = async () => {
  try {
    await connectDB();
    const results = await seedDemoAccounts();

    console.log('\nDemo accounts seeded:\n');
    results.forEach((r) => {
      const accuracy = r.attempts
        ? Math.round((r.correctAttempts / r.attempts) * 1000) / 10
        : 0;
      console.log(
        `- ${r.email} (${r.targetExam}) - ${r.name}\n` +
          `    attempts: ${r.attempts}, accuracy: ${accuracy}%, ` +
          `mistakes logged: ${r.mistakes}, active days: ${r.activeDays}`
      );
    });
    console.log('\nDone. Log in with the demo credentials to see the seeded profile.');
  } catch (error) {
    console.error('\nDemo seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();