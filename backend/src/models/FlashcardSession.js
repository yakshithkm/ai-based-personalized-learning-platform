const mongoose = require('mongoose');
const { OUTCOMES, STUDY_MODES } = require('../config/flashcards');

// One study run over a deck. `cardOrder` freezes the order (incl. a shuffle) so a refresh resumes
// the same sequence. `answers` holds at most one entry per card; each keeps the card's progress
// state from BEFORE the answer (`prev`) so changing an answer within the session can undo the
// earlier scheduling change instead of double-counting it. The summary counters are written when
// the session is completed, from the recorded answers - never from client-supplied numbers.
const answerSchema = new mongoose.Schema(
  {
    card: { type: mongoose.Schema.Types.ObjectId, ref: 'Flashcard', required: true },
    outcome: { type: String, enum: OUTCOMES, required: true },
    at: { type: Date, default: Date.now },
    prev: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const flashcardSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deck: { type: mongoose.Schema.Types.ObjectId, ref: 'FlashcardDeck', required: true },
    mode: { type: String, enum: STUDY_MODES, default: 'all' },
    status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active' },
    cardOrder: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Flashcard' }], default: [] },
    answers: { type: [answerSchema], default: [] },
    // Bumped on every answer write; lets a changed answer be applied with compare-and-swap.
    answerRev: { type: Number, default: 0, min: 0 },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    totalCards: { type: Number, default: 0, min: 0 },
    reviewedCount: { type: Number, default: 0, min: 0 },
    knownCount: { type: Number, default: 0, min: 0 },
    reviewAgainCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

flashcardSessionSchema.index({ user: 1, deck: 1, status: 1, startedAt: -1 });
flashcardSessionSchema.index({ user: 1, completedAt: -1 });

module.exports = mongoose.model('FlashcardSession', flashcardSessionSchema);
