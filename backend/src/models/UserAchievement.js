const mongoose = require('mongoose');

// A permanent record of an achievement unlock. The achievement catalog
// itself lives in code (services/gamification/config.js ACHIEVEMENTS) - this
// model only stores the fact that a given user unlocked a given achievement
// id, and when. Once written, an achievement can never be re-unlocked or
// lost (see the unique index below) even if the underlying stat later drops
// (e.g. accuracy dips after a bad session).
const userAchievementSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    achievementId: {
      type: String,
      required: true,
    },
    xpAwarded: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

userAchievementSchema.index({ user: 1, achievementId: 1 }, { unique: true });

module.exports = mongoose.model('UserAchievement', userAchievementSchema);