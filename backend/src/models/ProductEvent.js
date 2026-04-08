const mongoose = require('mongoose');

const productEventSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        'session_started',
        'question_answered',
        'session_completed',
        'next_action_clicked',
        'focus_session_started',
        'returned_next_day',
      ],
      required: true,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

productEventSchema.index({ eventType: 1, createdAt: -1 });
productEventSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('ProductEvent', productEventSchema);
