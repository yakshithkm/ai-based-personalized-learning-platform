const mongoose = require('mongoose');

// One document per (user, counter, period). The period key ("2026-10-04" / "2026-10") is part of
// the identity, so limits "reset" simply because a new period produces a new document - there is
// no reset job, and no write is needed until the user actually consumes something. `expiresAt`
// lets MongoDB's TTL monitor garbage-collect old periods on its own.
const usageCounterSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  key: { type: String, required: true },
  period: { type: String, required: true },
  count: { type: Number, default: 0, min: 0 },
  expiresAt: { type: Date, required: true },
});

usageCounterSchema.index({ user: 1, key: 1, period: 1 }, { unique: true });
usageCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('UsageCounter', usageCounterSchema);
