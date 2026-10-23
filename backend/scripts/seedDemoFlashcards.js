const FlashcardDeck = require('../src/models/FlashcardDeck');
const Flashcard = require('../src/models/Flashcard');
const FlashcardProgress = require('../src/models/FlashcardProgress');
const FlashcardSession = require('../src/models/FlashcardSession');
const flashcardService = require('../src/services/flashcards/flashcardService');
const { validateCardList, validateDeckInput } = require('../src/services/flashcards/validation');
const { DEMO_DECKS, DEMO_FLASHCARD_PLANS } = require('../src/data/demoFlashcards');

const DAY_MS = 24 * 60 * 60 * 1000;
const ANSWER_GAP_MS = 40 * 1000; // ~40s per card, so a session's timestamps look like a real run

// Small deterministic PRNG (same idea as seedDemoAccounts.js) seeded per account, so reseeding
// gives the same statistical shape every time while dates move forward with "today".
function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/** Removes every flashcard record that belongs to a user (used when a demo account is reseeded). */
const removeFlashcardData = async (userId) => {
  await Promise.all([
    FlashcardSession.deleteMany({ user: userId }),
    FlashcardProgress.deleteMany({ user: userId }),
    Flashcard.deleteMany({ user: userId }),
    FlashcardDeck.deleteMany({ user: userId }),
  ]);
};

// A past day at an evening study hour (always strictly in the past because daysAgo >= 1).
const sessionStart = (now, daysAgo, rand) => {
  const at = new Date(now.getTime() - Math.max(1, daysAgo) * DAY_MS);
  at.setHours(17 + Math.floor(rand() * 4), Math.floor(rand() * 60), 0, 0);
  return at;
};

/**
 * One study run, driven through the real session service with an injected clock:
 * start/resume -> rate cards -> complete. Cards are rated "known" with the given probability, so
 * the resulting progress, due dates, difficult cards and history are exactly what the real
 * scheduling rules produce for those answers.
 */
const runSession = async ({ userId, deckId, mode, startAt, accuracy, partial, rand }) => {
  let started;
  try {
    started = await flashcardService.startSession(userId, deckId, { mode, now: startAt });
  } catch (error) {
    // Nothing due yet for a "due" run: fall back to studying the whole deck, like a student would.
    if (mode === 'due' && error.statusCode === 409) {
      started = await flashcardService.startSession(userId, deckId, { mode: 'all', now: startAt });
    } else {
      throw error;
    }
  }

  const { session } = started;
  const total = session.cards.length;
  const rateCount = partial ? Math.max(1, Math.round(total * partial)) : total;

  for (let i = 0; i < rateCount; i += 1) {
    const outcome = rand() * 100 < accuracy ? 'known' : 'review';
    const answeredAt = new Date(startAt.getTime() + (i + 1) * ANSWER_GAP_MS);
    // eslint-disable-next-line no-await-in-loop
    await flashcardService.recordAnswer(userId, session.id, session.cards[i].id, outcome, { now: answeredAt });
  }

  const completedAt = new Date(startAt.getTime() + (rateCount + 1) * ANSWER_GAP_MS);
  const { summary } = await flashcardService.completeSession(userId, session.id, { now: completedAt });
  return summary;
};

/**
 * Seeds decks + study history for one demo account. `profile` is the entry from demoProfiles
 * (its key selects the plan, its tier drives the real deck-limit check, its subjectProfile makes
 * strong subjects score higher than weak ones). Returns counts for the seed log.
 */
const seedFlashcardsForUser = async ({ user, profile, now = new Date() }) => {
  const plan = DEMO_FLASHCARD_PLANS[profile.key] || [];
  await removeFlashcardData(user._id);
  if (!plan.length) return { decks: 0, cards: 0, sessions: 0 };

  const rand = mulberry32(hashSeed(`${profile.email}:flashcards`));
  let cards = 0;
  let sessions = 0;

  for (const entry of plan) {
    const def = DEMO_DECKS[entry.deck];
    if (!def) throw new Error(`Unknown demo flashcard deck "${entry.deck}" in plan "${profile.key}"`);

    const oldestSession = Math.max(0, ...entry.sessions.map((s) => s.daysAgo));
    const createdDaysAgo = entry.createdDaysAgo || oldestSession + 1;
    const createdAt = new Date(now.getTime() - createdDaysAgo * DAY_MS);

    // Real service: enforces the plan's deck limit, validates and stores the deck and its cards.
    // eslint-disable-next-line no-await-in-loop
    const deck = await flashcardService.createDeck(
      user._id,
      profile.tier || 'FREE',
      validateDeckInput({
        title: def.title,
        description: def.description,
        topic: def.topic,
        difficulty: def.difficulty,
        cardStyle: def.cardStyle,
        source: 'manual',
      }),
      validateCardList(def.cards),
      { createdAt }
    );
    cards += def.cards.length;

    const baseAccuracy = profile.subjectProfile?.[def.subject]?.baseAccuracy ?? 65;
    const ordered = [...entry.sessions].sort((a, b) => b.daysAgo - a.daysAgo);
    for (let i = 0; i < ordered.length; i += 1) {
      const run = ordered[i];
      // Practice makes progress: each later session of a deck scores a little better.
      const accuracy = clamp(baseAccuracy + 6 * i + (rand() - 0.5) * 10, 30, 95);
      // eslint-disable-next-line no-await-in-loop
      await runSession({
        userId: user._id,
        deckId: deck.id,
        mode: run.mode || (i === 0 ? 'all' : 'due'),
        startAt: sessionStart(now, run.daysAgo, rand),
        accuracy,
        partial: run.partial,
        rand,
      });
      sessions += 1;
    }
  }

  return { decks: plan.length, cards, sessions };
};

module.exports = { seedFlashcardsForUser, removeFlashcardData };