/**
 * Single source of truth for Flashcards vocabulary and limits (shared by models, validation, the
 * AI generator and the controller). Plan-based caps (deck count) live in config/tiers.js.
 */

const DIFFICULTIES = Object.freeze(['beginner', 'intermediate', 'advanced']);
const CARD_STYLES = Object.freeze(['definitions', 'qa', 'conceptual', 'interview']);
// How a deck was created. 'topic' = AI from a topic alone, 'text' = AI from pasted notes,
// 'lesson' = AI from a TutorMind learning-content item, 'manual' = typed by the student.
const DECK_SOURCES = Object.freeze(['manual', 'topic', 'text', 'lesson']);
const OUTCOMES = Object.freeze(['known', 'review']);
const STUDY_MODES = Object.freeze(['all', 'due', 'difficult']);
const SORTS = Object.freeze(['recent', 'studied', 'title']);

// Text caps are deliberately modest: a full 50-card save in a non-Latin script must stay under
// express.json()'s default 100 kB body limit (3 bytes/char worst case).
const LIMITS = Object.freeze({
  TITLE: 120,
  DESCRIPTION: 500,
  TOPIC: 120,
  FRONT: 200,
  BACK: 400,
  SOURCE_TEXT: 12000,
  CARDS_PER_DECK: 100,
  CARDS_PER_SAVE: 50,
  AI_MAX_CARDS: 25,
  AI_MIN_CARDS: 1,
  AI_AVOID_FRONTS: 40,
  // Hard ceiling for every plan (abuse protection), including "unlimited" ones.
  DECKS_HARD_CEILING: 200,
  SESSION_RESUME_HOURS: 24,
  PAGE_SIZE_DEFAULT: 12,
  PAGE_SIZE_MAX: 48,
});

// Leitner-style boxes. A card sits in box 0 (new or just missed) .. 5 (longest gap). "Know it"
// moves it up one box and schedules the next review INTERVAL_DAYS[box] days later; "Need to
// review" sends it back to box 0 and leaves it due immediately. Simple and explainable - this is
// NOT SM-2 / FSRS and makes no claim to be a scientifically validated schedule.
const MAX_BOX = 5;
const INTERVAL_DAYS = Object.freeze([0, 1, 3, 7, 14, 30]);

module.exports = {
  DIFFICULTIES,
  CARD_STYLES,
  DECK_SOURCES,
  OUTCOMES,
  STUDY_MODES,
  SORTS,
  LIMITS,
  MAX_BOX,
  INTERVAL_DAYS,
};
