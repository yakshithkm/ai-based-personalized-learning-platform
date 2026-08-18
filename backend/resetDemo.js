require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const { resetDemoAccounts } = require('./scripts/seedDemoAccounts');

const run = async () => {
  try {
    await connectDB();
    const results = await resetDemoAccounts();

    console.log('\nDemo accounts removed:\n');
    results.forEach((r) => {
      console.log(`- ${r.email}: ${r.removed ? 'removed' : 'was not present'}`);
    });
    console.log('\nRun "npm run seed:demo" to recreate them.');
  } catch (error) {
    console.error('\nDemo reset failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();