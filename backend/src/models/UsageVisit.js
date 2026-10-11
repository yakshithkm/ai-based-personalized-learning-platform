const mongoose = require('mongoose');

// One row per (user, usage key, page-visit id). The client tags every page visit with its own id, so
// the duplicate requests of ONE visit (React StrictMode's double effect, a double click) share a row
// and are charged once, while a separate visit - even a second later - has a new id and is charged.
// `until` bounds how long a visit id can be replayed for free; `outcome` lets duplicates inherit the
// result of the request that opened the visit. `expireAt` lets MongoDB clean old rows.
const usageVisitSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  key: { type: String, required: true },
  visit: { type: String, required: true },
  until: { type: Date, required: true },
  outcome: { type: String, enum: ['pending', 'granted', 'denied'], default: 'pending' },
  expireAt: { type: Date, required: true },
});

usageVisitSchema.index({ user: 1, key: 1, visit: 1 }, { unique: true });
usageVisitSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('UsageVisit', usageVisitSchema);