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
      enum: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
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
    yearTag: {
      type: String,
      enum: ['Previous Year', 'Mock', 'Conceptual'],
      default: 'Mock',
      index: true,
    },
    difficultyLevel: {
      type: String,
      enum: ['Easy', 'Moderate', 'Tough'],
      default: 'Moderate',
      index: true,
    },
    weightage: {
      type: String,
      enum: ['High', 'Medium', 'Low'],
      default: 'Medium',
      index: true,
    },
    text: {
      type: String,
      required: true,
    },
    conceptTested: {
      type: String,
      required: true,
      trim: true,
    },
    commonMistake: {
      type: String,
      required: true,
      trim: true,
    },
    solvingTimeEstimate: {
      type: Number,
      required: true,
      min: 15,
      max: 300,
    },
    difficultyReason: {
      type: String,
      required: true,
      trim: true,
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

questionSchema.pre('validate', function normalizeExamDifficultyTags(next) {
  if (!this.difficultyLevel) {
    if (this.difficulty === 'Easy') this.difficultyLevel = 'Easy';
    else if (this.difficulty === 'Hard') this.difficultyLevel = 'Tough';
    else this.difficultyLevel = 'Moderate';
  }

  if (!this.yearTag) {
    this.yearTag = 'Mock';
  }

  if (!this.weightage) {
    this.weightage = 'Medium';
  }

  next();
});

module.exports = mongoose.model('Question', questionSchema);
