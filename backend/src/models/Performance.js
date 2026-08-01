const mongoose = require('mongoose');

const topicPerformanceSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    topic: { type: String, required: true },
    subtopic: { type: String, default: 'General' },
    attempts: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    avgTimeTakenSec: { type: Number, default: 0 },
    focusScore: { type: Number, default: 0 },
    masteryScore: { type: Number, default: 0 },
    currentDifficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      default: 'Medium',
    },
  },
  { _id: false }
);

const subjectPerformanceSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    avgTimeTakenSec: { type: Number, default: 0 },
  },
  { _id: false }
);

const weakTopicPrioritySchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    topic: { type: String, required: true },
    subtopic: { type: String, default: 'General' },
    accuracy: { type: Number, default: 0 },
    avgTimeTakenSec: { type: Number, default: 0 },
    focusScore: { type: Number, default: 0 },
  },
  { _id: false }
);

const conceptPerformanceSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    topic: { type: String, required: true },
    concept: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    avgTimeTakenSec: { type: Number, default: 0 },
    mistakeFrequency: { type: Number, default: 0 },
    slowCorrectRate: { type: Number, default: 0 },
    masteryScore: { type: Number, default: 0 },
    adaptiveDifficultyScore: { type: Number, default: 50 },
  },
  { _id: false }
);

const weakConceptPrioritySchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    topic: { type: String, required: true },
    concept: { type: String, required: true },
    accuracy: { type: Number, default: 0 },
    avgTimeTakenSec: { type: Number, default: 0 },
    mistakeFrequency: { type: Number, default: 0 },
    slowCorrectRate: { type: Number, default: 0 },
    priorityScore: { type: Number, default: 0 },
  },
  { _id: false }
);

const performanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    totalAttempts: { type: Number, default: 0 },
    totalCorrect: { type: Number, default: 0 },
    overallAccuracy: { type: Number, default: 0 },
    averageTimeTakenSec: { type: Number, default: 0 },
    weakTopics: [{ type: String }],
    strongTopics: [{ type: String }],
    weakTopicPriority: [weakTopicPrioritySchema],
    subjectStats: [subjectPerformanceSchema],
    dailyGoal: { type: Number, default: 10 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    todayCompleted: { type: Number, default: 0 },
    lastPracticeDate: { type: Date, default: null },
    streakDays: [
      {
        day: { type: String, required: true },
        practiced: { type: Boolean, default: false },
        attempts: { type: Number, default: 0 },
      },
    ],
    weeklyTrend: [
      {
        day: { type: String, required: true },
        attempts: { type: Number, default: 0 },
        accuracy: { type: Number, default: 0 },
      },
    ],
    accuracyTrend: {
      type: String,
      enum: ['improving', 'declining', 'stable'],
      default: 'stable',
    },
    timeAccuracyCorrelation: { type: Number, default: 0 },
    suggestedFocusTopic: { type: String, default: '' },
    topicStats: [topicPerformanceSchema],
    conceptStats: [conceptPerformanceSchema],
    weakConceptPriority: [weakConceptPrioritySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Performance', performanceSchema);
