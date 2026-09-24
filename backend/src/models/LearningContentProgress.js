const mongoose = require('mongoose');
const {
  PROGRESS_STATUSES,
  DIFFICULTY_FEEDBACK,
  LEARNING_STAGES,
  CONTENT_TYPES,
  DIFFICULTIES,
} = require('../services/learning/constants');

// One row per (student, content). Feeds future ranking (completed / partially completed /
// skipped / feedback signals).
const learningContentProgressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningContent', required: true },

    status: { type: String, enum: PROGRESS_STATUSES, default: 'not-started' },
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    lastAccessedAt: { type: Date, default: null },
    timeSpentSec: { type: Number, default: 0, min: 0 },

    rating: { type: Number, default: null, min: 1, max: 5 },
    helpful: { type: Boolean, default: null },
    difficultyFeedback: { type: String, enum: [...DIFFICULTY_FEEDBACK, null], default: null },
    skipped: { type: Boolean, default: false },

    // Denormalised snapshot so ranking / admin stats never need to join back to content.
    subject: { type: String, default: '' },
    topic: { type: String, default: '' },
    contentType: { type: String, enum: [...CONTENT_TYPES, ''], default: '' },
    contentDifficulty: { type: String, enum: [...DIFFICULTIES, ''], default: '' },
    learningStage: { type: String, enum: [...LEARNING_STAGES, ''], default: '' },
  },
  { timestamps: true }
);

learningContentProgressSchema.index({ user: 1, content: 1 }, { unique: true });
learningContentProgressSchema.index({ user: 1, status: 1, lastAccessedAt: -1 });
learningContentProgressSchema.index({ content: 1, status: 1 });

module.exports = mongoose.model('LearningContentProgress', learningContentProgressSchema);