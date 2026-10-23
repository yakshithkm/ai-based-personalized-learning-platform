const mongoose = require('mongoose');
const { LIMITS } = require('../config/flashcards');

// `user` is stored on every card so ownership can be enforced with a single indexed filter
// ({ _id, user }) without trusting the deck lookup alone.
const flashcardSchema = new mongoose.Schema(
  {
    deck: { type: mongoose.Schema.Types.ObjectId, ref: 'FlashcardDeck', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    front: { type: String, required: true, trim: true, maxlength: LIMITS.FRONT },
    back: { type: String, required: true, trim: true, maxlength: LIMITS.BACK },
    order: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

flashcardSchema.index({ deck: 1, order: 1 });
flashcardSchema.index({ user: 1, deck: 1 });

module.exports = mongoose.model('Flashcard', flashcardSchema);
