const mongoose = require('mongoose');

const mistakeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    subtopic: {
      type: String,
      default: 'General',
      trim: true,
    },
    conceptTested: {
      type: String,
      default: 'General Concept',
      trim: true,
      index: true,
    },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      required: true,
    },
    mistakeType: {
      type: String,
      enum: ['Concept Error', 'Calculation Error', 'Careless Mistake'],
      default: 'Concept Error',
    },
    timeTakenSec: {
      type: Number,
      default: 0,
      min: 0,
    },
    expectedTimeSec: {
      type: Number,
      default: 60,
      min: 15,
      max: 300,
    },
    timeDeltaSec: {
      type: Number,
      default: 0,
    },
    isSlowCorrect: {
      type: Boolean,
      default: false,
    },
    selectedAnswerIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    selectedAnswerText: {
      type: String,
      default: '',
      trim: true,
    },
    repetitionStage: {
      type: Number,
      enum: [0, 1, 2],
      default: 0,
    },
    nextReviewAt: {
      type: Date,
      required: false,
      default: null,
      index: true,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    improvedOnRetry: {
      type: Boolean,
      default: false,
    },
    resolved: {
      type: Boolean,
      default: false,
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    lastReviewedAt: {
      type: Date,
      default: null,
    },
    lastAttemptCorrect: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

mistakeSchema.index({ user: 1, question: 1, resolved: 1 });
mistakeSchema.index({ user: 1, topic: 1, createdAt: -1 });
mistakeSchema.index({ user: 1, conceptTested: 1, createdAt: -1 });

module.exports = mongoose.model('Mistake', mistakeSchema);
