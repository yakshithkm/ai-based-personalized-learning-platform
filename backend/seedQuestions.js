require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const Question = require('./src/models/Question');

const seedDir = path.join(__dirname, 'src', 'data', 'question-seeds');
const requiredFields = ['examType', 'subject', 'topic', 'subtopic', 'difficulty', 'text', 'options', 'correctAnswer', 'explanation', 'mistakeType'];

const signatureFor = (question) => [
  question.examType,
  question.subject,
  question.topic,
  question.subtopic,
  question.difficulty,
  question.text,
].join('::');

const validateQuestion = (question, sourceName) => {
  const missingField = requiredFields.find((field) => {
    const value = question[field];
    if (Array.isArray(value)) return value.length === 0;
    return value === undefined || value === null || String(value).trim() === '';
  });

  if (missingField) {
    throw new Error(`${sourceName}: missing required field "${missingField}"`);
  }

  if (!Array.isArray(question.options) || question.options.length !== 4) {
    throw new Error(`${sourceName}: each question must have exactly 4 options`);
  }

  if (!['Easy', 'Medium', 'Hard'].includes(question.difficulty)) {
    throw new Error(`${sourceName}: invalid difficulty "${question.difficulty}"`);
  }

  if (!['concept', 'calculation', 'trap'].includes(question.mistakeType)) {
    throw new Error(`${sourceName}: invalid mistakeType "${question.mistakeType}"`);
  }

  const answerIndex = Number(question.correctAnswerIndex);
  if (Number.isNaN(answerIndex) || answerIndex < 0 || answerIndex > 3) {
    throw new Error(`${sourceName}: correctAnswerIndex must be between 0 and 3`);
  }

  const expectedAnswer = question.options[answerIndex];
  if (expectedAnswer !== question.correctAnswer) {
    throw new Error(`${sourceName}: correctAnswer must match the option at correctAnswerIndex`);
  }
};

const loadQuestionsFromFile = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const questions = JSON.parse(raw);

  if (!Array.isArray(questions)) {
    throw new Error(`${path.basename(filePath)} must contain an array of questions`);
  }

  questions.forEach((question, index) => validateQuestion(question, `${path.basename(filePath)}[${index}]`));
  return questions;
};

const seedQuestions = async () => {
  try {
    await connectDB();

    if (!fs.existsSync(seedDir)) {
      throw new Error(`Seed directory not found: ${seedDir}`);
    }

    const seedFiles = fs
      .readdirSync(seedDir)
      .filter((file) => file.endsWith('.json'))
      .sort();

    if (!seedFiles.length) {
      throw new Error(`No JSON seed files found in ${seedDir}`);
    }

    const incomingQuestions = seedFiles.flatMap((file) => loadQuestionsFromFile(path.join(seedDir, file)));
    const existingQuestions = await Question.find({})
      .select('examType subject topic subtopic difficulty text')
      .lean();

    const existingKeys = new Set(existingQuestions.map(signatureFor));
    const uniqueIncoming = [];
    const seenKeys = new Set();

    incomingQuestions.forEach((question) => {
      const key = signatureFor(question);
      if (existingKeys.has(key) || seenKeys.has(key)) {
        return;
      }

      seenKeys.add(key);
      uniqueIncoming.push(question);
    });

    if (!uniqueIncoming.length) {
      console.log('No new questions to seed.');
      await mongoose.disconnect();
      return;
    }

    await Question.insertMany(uniqueIncoming, { ordered: false });
    console.log(`Inserted ${uniqueIncoming.length} questions from ${seedFiles.length} files.`);
    await mongoose.disconnect();
  } catch (error) {
    console.error('Seeding failed:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  }
};

if (require.main === module) {
  seedQuestions();
}

module.exports = seedQuestions;