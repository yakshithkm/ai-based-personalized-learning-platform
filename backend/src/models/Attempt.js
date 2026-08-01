const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema(
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
      default: 'Medium',
    },
    selectedAnswerIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    isCorrect: {
      type: Boolean,
      required: true,
    },
    timeTakenSec: {
      type: Number,
      required: true,
      min: 1,
    },
    expectedSolvingTimeSec: {
      type: Number,
      default: 60,
      min: 15,
      max: 300,
    },
    responsePace: {
      type: String,
      enum: ['fast', 'on-time', 'slow'],
      default: 'on-time',
    },
    adaptiveDifficultyBefore: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      default: 'Medium',
    },
    adaptiveDifficultyAfter: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      default: 'Medium',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Attempt', attemptSchema);
