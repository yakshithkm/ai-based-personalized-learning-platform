const mongoose = require('mongoose');
const { QUESTION_LOG_TTL_DAYS } = require('../services/learning/constants');

// Persistent replacement for the in-memory Map that used to back the question
// recommendation engine's freshness/anti-repetition history. Survives restarts, deploys
// and multiple backend instances; old rows expire on their own via the TTL index.
const questionRecommendationLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  topic: { type: String, default: '' },
  subtopic: { type: String, default: 'General' },
  difficulty: { type: String, default: 'Medium' },
  recommendationReason: { type: String, default: 'fallback' },
  createdAt: { type: Date, default: Date.now, expires: QUESTION_LOG_TTL_DAYS * 24 * 60 * 60 },
});

questionRecommendationLogSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('QuestionRecommendationLog', questionRecommendationLogSchema);