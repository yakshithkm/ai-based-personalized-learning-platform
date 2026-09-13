require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const { bootstrapAdminUser } = require('./src/utils/adminBootstrap');

const run = async () => {
  try {
    await connectDB();
    const admin = await bootstrapAdminUser();
    if (admin) {
      console.log(`\nAdmin account ready: ${admin.email}`);
      console.log('Log in at /admin/login with the ADMIN_EMAIL / ADMIN_PASSWORD from backend/.env');
    } else {
      console.log('\nNo admin account created - set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env first.');
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('\nAdmin seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();