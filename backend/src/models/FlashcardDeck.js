const mongoose = require('mongoose');
const { DIFFICULTIES, CARD_STYLES, DECK_SOURCES, LIMITS } = require('../config/flashcards');

// A student's private deck. Card counts and progress are NOT stored here - they are derived from
// Flashcard / FlashcardProgress so they can never drift. `lastStudiedAt` is the one denormalised
// field (set when a session finishes) because "recently studied" sorting needs an indexed value.
const flashcardDeckSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: LIMITS.TITLE },
    // Lower-cased copy of `title`, kept in sync on save, so A-Z sorting is case-insensitive without
    // relying on database collation support.
    titleKey: { type: String, default: '', index: false },
    description: { type: String, default: '', trim: true, maxlength: LIMITS.DESCRIPTION },
    topic: { type: String, default: '', trim: true, maxlength: LIMITS.TOPIC },
    difficulty: { type: String, enum: [...DIFFICULTIES, ''], default: '' },
    cardStyle: { type: String, enum: [...CARD_STYLES, ''], default: '' },
    source: { type: String, enum: DECK_SOURCES, default: 'manual' },
    // Set only for decks generated from a TutorMind lesson (decks survive the lesson's removal).
    sourceContent: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningContent', default: null },
    language: { type: String, default: 'en', maxlength: 10 },
    lastStudiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

flashcardDeckSchema.pre('save', function syncTitleKey(next) {
  if (this.isModified('title') || !this.titleKey) this.titleKey = String(this.title || '').toLowerCase();
  next();
});

flashcardDeckSchema.index({ user: 1, createdAt: -1 });
flashcardDeckSchema.index({ user: 1, titleKey: 1 });
flashcardDeckSchema.index({ user: 1, lastStudiedAt: -1 });
flashcardDeckSchema.index({ user: 1, topic: 1 });

module.exports = mongoose.model('FlashcardDeck', flashcardDeckSchema);
