const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    examType: {
      type: String,
      enum: ['NEET', 'JEE', 'CET'],
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
    text: {
      type: String,
      required: true,
    },
    correctAnswer: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String],
      validate: {
        validator: (opts) => Array.isArray(opts) && opts.length === 4,
        message: 'Each question must have exactly 4 options',
      },
      required: true,
    },
    correctAnswerIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    mistakeType: {
      type: String,
      enum: ['concept', 'calculation', 'trap'],
      required: true,
      default: 'concept',
    },
    explanation: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Question', questionSchema);
