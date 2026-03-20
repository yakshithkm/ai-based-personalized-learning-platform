require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Question = require('../models/Question');

const seed = async () => {
  try {
    await connectDB();

    const filePath = path.join(__dirname, 'sampleQuestions.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const questions = JSON.parse(raw);

    await Question.deleteMany({});
    await Question.insertMany(questions);

    console.log(`Seeded ${questions.length} questions successfully`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seed();
