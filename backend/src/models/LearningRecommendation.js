const mongoose = require('mongoose');
const {
  REASONS,
  PRIORITIES,
  RECOMMENDATION_STATUSES,
  DIFFICULTY_FEEDBACK,
  LEARNING_STAGES,
} = require('../services/learning/constants');

const metricSnapshot = {
  accuracy: { type: Number, default: null },
  attempts: { type: Number, default: 0 },
  mastery: { type: Number, default: null },
  capturedAt: { type: Date, default: null },
};

// Persistent recommendation history. One document per recommendation *episode*: while an
// episode is open (active/started, and for 'active' ones only within the reuse window) the
// same document is refreshed on every serve, so its _id is stable for the UI and repeated
// page loads never create duplicates. A partial unique index enforces that atomically.
const learningRecommendationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // null for "practice-only" recommendations (e.g. no study material exists yet).
    content: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningContent', default: null },
    dedupeKey: { type: String, required: true },
    kind: { type: String, enum: ['content', 'practice'], default: 'content' },
    section: { type: String, default: '' },

    recommendationReason: { type: String, enum: REASONS, required: true },
    reason: { type: String, default: '' },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    score: { type: Number, default: 0, min: 0, max: 100 },
    stage: { type: String, enum: [...LEARNING_STAGES, ''], default: '' },
    contentGap: { type: Boolean, default: false },

    target: {
      subject: { type: String, default: '' },
      topic: { type: String, default: '' },
      subtopic: { type: String, default: 'General' },
      concept: { type: String, default: '' },
      granularity: { type: String, enum: ['topic', 'concept'], default: 'topic' },
    },
    // The measurable numbers the explanation was built from (accuracy, attempts, ...).
    signals: { type: mongoose.Schema.Types.Mixed, default: {} },

    open: { type: Boolean, default: true },
    status: { type: String, enum: RECOMMENDATION_STATUSES, default: 'active' },

    recommendedAt: { type: Date, default: Date.now },
    lastServedAt: { type: Date, default: null },
    servedDays: { type: [String], default: [] },
    impressions: { type: Number, default: 0 },

    clickedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    dismissedAt: { type: Date, default: null },
    timeSpentSec: { type: Number, default: 0 },

    feedback: {
      helpful: { type: Boolean, default: null },
      difficulty: { type: String, enum: [...DIFFICULTY_FEEDBACK, null], default: null },
      rating: { type: Number, default: null, min: 1, max: 5 },
      at: { type: Date, default: null },
    },

    // Effectiveness tracking. `before` is captured when the recommendation is first served
    // and refreshed when the student starts it; `after` is filled once enough practice on
    // the same target has happened after completion.
    before: metricSnapshot,
    after: {
      accuracy: { type: Number, default: null },
      attempts: { type: Number, default: 0 },
      mastery: { type: Number, default: null },
      evaluatedAt: { type: Date, default: null },
    },
    practiceAttemptsAfter: { type: Number, default: 0 },
  },
  { timestamps: true }
);

learningRecommendationSchema.index({ user: 1, recommendedAt: -1 });
learningRecommendationSchema.index({ user: 1, status: 1, completedAt: -1 });
learningRecommendationSchema.index({ content: 1, status: 1 });
// At most one OPEN episode per (user, dedupeKey).
learningRecommendationSchema.index(
  { user: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { open: true } }
);

module.exports = mongoose.model('LearningRecommendation', learningRecommendationSchema);