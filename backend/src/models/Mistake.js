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
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      required: true,
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

module.exports = mongoose.model('Mistake', mistakeSchema);
