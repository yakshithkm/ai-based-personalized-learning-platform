const mongoose = require('mongoose');
const User = require('../../src/models/User');
const Question = require('../../src/models/Question');
const Attempt = require('../../src/models/Attempt');
const Mistake = require('../../src/models/Mistake');
const LearningContent = require('../../src/models/LearningContent');
const generateToken = require('../../src/utils/generateToken');

const HOUR = 60 * 60 * 1000;
let counter = 0;
const uid = () => `${Date.now()}_${(counter += 1)}_${Math.random().toString(36).slice(2, 6)}`;

const createUser = (overrides = {}) =>
  User.create({ name: 'Learner', email: `learner_${uid()}@test.com`, password: 'pass1234', targetExam: 'JEE', ...overrides });

const tokenFor = (user) => generateToken(user._id);

// The real question bank is topic-granular (subtopic 'General', conceptTested = topic name).
const createQuestion = (overrides = {}) =>
  Question.create({
    examType: 'JEE',
    subject: 'Physics',
    topic: 'Current Electricity',
    subtopic: 'General',
    difficulty: 'Medium',
    text: `Q-${uid()}: a question`,
    conceptTested: overrides.topic || 'Current Electricity',
    commonMistake: 'Common slip.',
    solvingTimeEstimate: 60,
    difficultyReason: 'Needs two steps.',
    options: ['1', '2', '3', '4'],
    correctAnswer: '2',
    correctAnswerIndex: 1,
    mistakeType: 'concept',
    explanation: 'Identify the relation, substitute values, then verify the result against the options.',
    ...overrides,
  });

const createQuestions = (count, overrides = {}) => Promise.all(Array.from({ length: count }, () => createQuestion(overrides)));

/** Inserts `correct` right + `wrong` wrong attempts, oldest first, ending `endHoursAgo` ago. */
const addAttempts = async (user, { subject = 'Physics', topic = 'Current Electricity', concept, correct = 0, wrong = 0, time = 60, endHoursAgo = 1, afterMs, difficulty = 'Medium' } = {}) => {
  const total = correct + wrong;
  // Spread the wrong answers evenly through the sequence so the recent window and the older
  // history have (almost) the same accuracy - i.e. a stable student unless a test says otherwise.
  const flags = Array.from({ length: total }, () => true);
  for (let k = 0; k < wrong; k += 1) flags[Math.min(total - 1, Math.floor(((k + 0.5) * total) / wrong))] = false;
  const now = Date.now();
  const docs = Array.from({ length: total }, (_, i) => ({
    user: user._id,
    question: new mongoose.Types.ObjectId(),
    subject,
    topic,
    subtopic: 'General',
    conceptTested: concept || topic,
    difficulty,
    selectedAnswerIndex: flags[i] ? 1 : 0,
    isCorrect: flags[i],
    timeTakenSec: time,
    expectedSolvingTimeSec: 60,
    responsePace: time > 75 ? 'slow' : 'on-time',
    adaptiveDifficultyBefore: difficulty,
    adaptiveDifficultyAfter: difficulty,
    // `afterMs` places the attempts in the near FUTURE (i.e. after a just-completed lesson)
    createdAt: afterMs === undefined ? new Date(now - (endHoursAgo + (total - i)) * HOUR) : new Date(now + afterMs + i * 1000),
  }));
  if (docs.length) await Attempt.insertMany(docs);
  return docs;
};

const addOpenMistakes = (user, { subject = 'Physics', topic = 'Current Electricity', concept, count = 1, dueInDays = 1 } = {}) =>
  Mistake.insertMany(
    Array.from({ length: count }, () => ({
      user: user._id,
      question: new mongoose.Types.ObjectId(),
      subject,
      topic,
      subtopic: 'General',
      conceptTested: concept || topic,
      difficulty: 'Medium',
      selectedAnswerIndex: 0,
      resolved: false,
      nextReviewAt: new Date(Date.now() + dueInDays * 24 * HOUR),
    }))
  );

const createContent = (overrides = {}) =>
  LearningContent.create({
    title: `Content ${uid()}`,
    subject: 'Physics',
    topic: 'Current Electricity',
    contentType: 'concept',
    difficulty: 'Easy',
    estimatedMinutes: 8,
    body: 'Some study text about the concept.',
    examTypes: ['NEET', 'JEE', 'CET'],
    qualityScore: 80,
    ...overrides,
  });

// Flatten every recommendation item a bundle returns.
const allItems = (bundle) => {
  const items = [];
  if (bundle.learnNext?.primary) items.push(bundle.learnNext.primary, ...bundle.learnNext.alsoConsider);
  Object.values(bundle.sections || {}).forEach((list) => items.push(...list));
  return items;
};

module.exports = { createUser, tokenFor, createQuestion, createQuestions, addAttempts, addOpenMistakes, createContent, allItems, uid, HOUR };