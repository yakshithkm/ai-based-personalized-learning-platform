const mongoose = require('mongoose');

const examAuditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamSession',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ['answer', 'submit', 'reject'],
      required: true,
      index: true,
    },
    reason: {
      type: String,
      default: 'none',
      trim: true,
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
  }
);

examAuditLogSchema.index({ sessionId: 1, createdAt: -1 });

module.exports = mongoose.model('ExamAuditLog', examAuditLogSchema);
