const mongoose = require('mongoose');

const questionSnapshotSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
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
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      default: 'Medium',
    },
    difficultyLevel: {
      type: String,
      enum: ['Easy', 'Moderate', 'Tough'],
      default: 'Moderate',
    },
    yearTag: {
      type: String,
      enum: ['Previous Year', 'Mock', 'Conceptual'],
      default: 'Mock',
    },
    weightage: {
      type: String,
      enum: ['High', 'Medium', 'Low'],
      default: 'Medium',
    },
    conceptTested: {
      type: String,
      default: 'General Concept',
      trim: true,
    },
  },
  { _id: false }
);

const responseSchema = new mongoose.Schema(
  {
    questionIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    selectedAnswerIndex: {
      type: Number,
      min: 0,
      max: 3,
      default: null,
    },
    timeTakenSec: {
      type: Number,
      min: 0,
      default: 0,
    },
    answeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const examSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    examType: {
      type: String,
      enum: ['NEET', 'JEE', 'CET'],
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: ['full-length', 'section-wise'],
      required: true,
    },
    sectionSubject: {
      type: String,
      enum: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
      default: null,
    },
    strictNavigation: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'submitted', 'expired'],
      default: 'active',
      index: true,
    },
    questionCount: {
      type: Number,
      required: true,
      min: 1,
    },
    timeLimitSec: {
      type: Number,
      required: true,
      min: 60,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isSubmitting: {
      type: Boolean,
      default: false,
      index: true,
    },
    version: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastAnsweredIndex: {
      type: Number,
      default: -1,
      min: -1,
    },
    currentQuestionIndex: {
      type: Number,
      default: 0,
      min: 0,
    },
    questionOrder: {
      type: [questionSnapshotSchema],
      default: [],
    },
    responses: {
      type: [responseSchema],
      default: [],
    },
    blueprintDiagnostics: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    resultSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

examSessionSchema.index({ user: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('ExamSession', examSessionSchema);
