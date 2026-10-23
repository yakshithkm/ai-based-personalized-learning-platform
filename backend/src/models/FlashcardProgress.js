const mongoose = require('mongoose');
const { OUTCOMES, MAX_BOX } = require('../config/flashcards');

// Per-student, per-card review state - the spaced-repetition record (see services/flashcards/srs.js).
// A card the student has never answered simply has no row ("new").
const flashcardProgressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    card: { type: mongoose.Schema.Types.ObjectId, ref: 'Flashcard', required: true },
    deck: { type: mongoose.Schema.Types.ObjectId, ref: 'FlashcardDeck', required: true },
    box: { type: Number, default: 0, min: 0, max: MAX_BOX },
    reviewCount: { type: Number, default: 0, min: 0 },
    knownCount: { type: Number, default: 0, min: 0 },
    missedCount: { type: Number, default: 0, min: 0 },
    lastOutcome: { type: String, enum: [...OUTCOMES, null], default: null },
    lastReviewedAt: { type: Date, default: null },
    nextReviewAt: { type: Date, default: null },
  },
  { timestamps: true }
);

flashcardProgressSchema.index({ user: 1, card: 1 }, { unique: true });
flashcardProgressSchema.index({ user: 1, deck: 1, nextReviewAt: 1 });
flashcardProgressSchema.index({ user: 1, deck: 1, lastOutcome: 1 });

module.exports = mongoose.model('FlashcardProgress', flashcardProgressSchema);
