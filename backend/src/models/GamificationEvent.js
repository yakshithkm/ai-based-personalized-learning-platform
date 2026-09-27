const mongoose = require('mongoose');

// Append-only ledger of every gamification-relevant event that has been
// processed for a user. `dedupeKey` is what makes XP farming impossible:
// it is derived from the real source record (an attempt id, a completed
// recommendation id, a submitted exam session id, ...) so the same learning
// action can never be counted twice, no matter how many times the client
// retries or refreshes. This also doubles as the user-facing XP history
// (section 31).
const gamificationEventSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    // Unique per (user, dedupeKey). Typically `${eventType}:${sourceId}`,
    // e.g. "PRACTICE_ANSWER_CORRECT:665fa1...". For events that aren't tied
    // to one source record (DAILY_ACTIVITY, STREAK_DAY) this is
    // `${eventType}:${localDateString}`.
    dedupeKey: {
      type: String,
      required: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    xpAwarded: {
      type: Number,
      default: 0,
    },
    label: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// The core anti-farming guarantee: a duplicate (user, dedupeKey) insert
// throws a Mongo E11000 error, which gamificationService catches and treats
// as "already awarded, no-op" rather than a failure.
gamificationEventSchema.index({ user: 1, dedupeKey: 1 }, { unique: true });
gamificationEventSchema.index({ user: 1, createdAt: -1 });
gamificationEventSchema.index({ user: 1, eventType: 1 });

module.exports = mongoose.model('GamificationEvent', gamificationEventSchema);