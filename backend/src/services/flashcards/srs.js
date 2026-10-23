const { INTERVAL_DAYS, MAX_BOX } = require('../../config/flashcards');

const DAY_MS = 24 * 60 * 60 * 1000;

/** Progress state of a card nobody has answered yet. */
const emptyState = () => ({
  box: 0,
  reviewCount: 0,
  knownCount: 0,
  missedCount: 0,
  lastOutcome: null,
  lastReviewedAt: null,
  nextReviewAt: null,
});

/** Plain-object copy of the scheduling fields of a progress document (or empty state). */
const toState = (doc) => {
  if (!doc) return emptyState();
  return {
    box: doc.box || 0,
    reviewCount: doc.reviewCount || 0,
    knownCount: doc.knownCount || 0,
    missedCount: doc.missedCount || 0,
    lastOutcome: doc.lastOutcome || null,
    lastReviewedAt: doc.lastReviewedAt || null,
    nextReviewAt: doc.nextReviewAt || null,
  };
};

/**
 * Pure scheduling step.
 *   known  -> box + 1 (capped at MAX_BOX); next review in INTERVAL_DAYS[box] days.
 *   review -> box 0; due immediately (it stays due until the student later knows it).
 */
const applyOutcome = (state, outcome, now = new Date()) => {
  const current = toState(state);
  const at = new Date(now);
  if (outcome === 'known') {
    const box = Math.min(MAX_BOX, current.box + 1);
    return {
      ...current,
      box,
      reviewCount: current.reviewCount + 1,
      knownCount: current.knownCount + 1,
      lastOutcome: 'known',
      lastReviewedAt: at,
      nextReviewAt: new Date(at.getTime() + INTERVAL_DAYS[box] * DAY_MS),
    };
  }
  if (outcome === 'review') {
    return {
      ...current,
      box: 0,
      reviewCount: current.reviewCount + 1,
      missedCount: current.missedCount + 1,
      lastOutcome: 'review',
      lastReviewedAt: at,
      nextReviewAt: at,
    };
  }
  throw new Error(`applyOutcome: unknown outcome "${outcome}"`);
};

/** New cards (never answered) and cards whose scheduled time has arrived are due. */
const isDue = (state, now = new Date()) => {
  const current = toState(state);
  if (!current.lastReviewedAt) return true;
  return !current.nextReviewAt || new Date(current.nextReviewAt).getTime() <= new Date(now).getTime();
};

/**
 * "Difficult" = the last answer was "Need to review", OR the card has been missed at least twice
 * and has not yet climbed past box 2.
 */
const isDifficult = (state) => {
  const current = toState(state);
  if (!current.lastReviewedAt) return false;
  return current.lastOutcome === 'review' || (current.missedCount >= 2 && current.box <= 2);
};

module.exports = { emptyState, toState, applyOutcome, isDue, isDifficult, DAY_MS };
