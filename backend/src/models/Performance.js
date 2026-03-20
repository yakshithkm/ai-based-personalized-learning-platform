const mongoose = require('mongoose');

const topicPerformanceSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    topic: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    avgTimeTakenSec: { type: Number, default: 0 },
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
    topicStats: [topicPerformanceSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Performance', performanceSchema);
