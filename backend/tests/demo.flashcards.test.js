const request = require('supertest');
const app = require('../src/app');
const FlashcardDeck = require('../src/models/FlashcardDeck');
const Flashcard = require('../src/models/Flashcard');
const FlashcardProgress = require('../src/models/FlashcardProgress');
const FlashcardSession = require('../src/models/FlashcardSession');
const { seedFlashcardsForUser, removeFlashcardData } = require('../scripts/seedDemoFlashcards');
const { DEMO_PROFILES } = require('../src/data/demoProfiles');
const { DEMO_FLASHCARD_PLANS } = require('../src/data/demoFlashcards');
const { createUser, tokenFor } = require('./helpers/learningFixtures');

const profileOf = (key) => DEMO_PROFILES.find((p) => p.key === key);

const seedFor = async (key, now = new Date()) => {
  const profile = profileOf(key);
  const user = await createUser({ tier: profile.tier });
  const result = await seedFlashcardsForUser({ user, profile, now });
  return { user, profile, result, token: tokenFor(user) };
};

const get = (token, url) => request(app).get(url).set('Authorization', `Bearer ${token}`);
const post = (token, url, body) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body);

describe('demo flashcards seeding', () => {
  test('seeds the planned decks and cards through the real service', async () => {
    const { user, result } = await seedFor('neet');
    const plan = DEMO_FLASHCARD_PLANS.neet;
    expect(result.decks).toBe(plan.length);
    expect(await FlashcardDeck.countDocuments({ user: user._id })).toBe(plan.length);
    expect(await Flashcard.countDocuments({ user: user._id })).toBe(result.cards);
    expect(result.sessions).toBe(plan.reduce((n, p) => n + p.sessions.length, 0));
  });

  test('study history is real: progress, history and stats come from recorded answers, all in the past', async () => {
    const now = new Date();
    const { user, token } = await seedFor('jee', now);
    const list = (await get(token, '/api/flashcards/decks?sort=title')).body.decks;
    const byTitle = Object.fromEntries(list.map((d) => [d.title, d]));

    const studied = byTitle['Differentiation and Integration Rules'];
    expect(studied.stats.reviewedCards).toBe(studied.stats.totalCards); // fully reviewed
    expect(studied.stats.knownCards + studied.stats.needReviewCards).toBe(studied.stats.reviewedCards);
    expect(new Date(studied.lastStudiedAt).getTime()).toBeLessThan(now.getTime());

    const partial = byTitle['Current Electricity Formulas']; // one early-ended session
    expect(partial.stats.reviewedCards).toBeGreaterThan(0);
    expect(partial.stats.reviewedCards).toBeLessThan(partial.stats.totalCards);
    expect(partial.stats.newCards).toBeGreaterThan(0);

    const untouched = byTitle['Mole Concept and Stoichiometry'];
    expect(untouched.lastStudiedAt).toBeNull();
    expect(untouched.stats).toMatchObject({ reviewedCards: 0, newCards: untouched.stats.totalCards, knownCards: 0 });

    list.forEach((d) => expect(new Date(d.createdAt).getTime()).toBeLessThan(now.getTime()));
    const sessions = await FlashcardSession.find({ user: user._id });
    expect(sessions.length).toBeGreaterThan(0);
    sessions.forEach((s) => {
      expect(s.status).not.toBe('active'); // nothing left half-open
      expect(s.completedAt.getTime()).toBeLessThan(now.getTime());
      expect(s.reviewedCount).toBe(s.knownCount + s.reviewAgainCount);
    });
    const history = (await get(token, `/api/flashcards/decks/${studied.id}/history`)).body.sessions;
    expect(history.length).toBe(DEMO_FLASHCARD_PLANS.jee[0].sessions.length);
  });

  test('later sessions only revisit cards that are due (spaced repetition ran for real)', async () => {
    const { user } = await seedFor('cet');
    const rows = await FlashcardProgress.find({ user: user._id });
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      expect(row.reviewCount).toBeGreaterThanOrEqual(1);
      expect(row.knownCount + row.missedCount).toBe(row.reviewCount);
      expect(row.box).toBeGreaterThanOrEqual(0);
      expect(row.box).toBeLessThanOrEqual(5);
    });
    expect(rows.some((r) => r.reviewCount > 1)).toBe(true); // a card seen in more than one session
  });

  test('Free demo is exactly at its deck limit (upgrade prompt), Pro and Premium still have headroom', async () => {
    const free = await seedFor('free-demo');
    expect(free.result.decks).toBe(5);
    const blocked = await post(free.token, '/api/flashcards/decks', { title: 'Sixth deck', cards: [{ front: 'Q?', back: 'A' }] });
    expect(blocked.status).toBe(403);
    expect(blocked.body).toMatchObject({ code: 'USAGE_LIMIT_REACHED', usageKey: 'FLASHCARD_DECKS', limit: 5, used: 5 });

    for (const key of ['pro-demo', 'premium-demo']) {
      // eslint-disable-next-line no-await-in-loop
      const account = await seedFor(key);
      expect(account.result.decks).toBe(5);
      // eslint-disable-next-line no-await-in-loop
      const extra = await post(account.token, '/api/flashcards/decks', { title: 'Sixth deck', cards: [{ front: 'Q?', back: 'A' }] });
      expect(extra.status).toBe(201);
    }
  });

  test('reseeding replaces the data instead of duplicating it, with the same shape', async () => {
    const profile = profileOf('neet');
    const user = await createUser({ tier: profile.tier });
    const first = await seedFlashcardsForUser({ user, profile });
    const decksBefore = await FlashcardDeck.countDocuments({ user: user._id });
    const knownBefore = await FlashcardProgress.countDocuments({ user: user._id, lastOutcome: 'known' });

    const second = await seedFlashcardsForUser({ user, profile });
    expect(second).toEqual(first);
    expect(await FlashcardDeck.countDocuments({ user: user._id })).toBe(decksBefore);
    expect(await FlashcardProgress.countDocuments({ user: user._id, lastOutcome: 'known' })).toBe(knownBefore);
  });

  test('removeFlashcardData wipes every flashcard record for that user only', async () => {
    const a = await seedFor('free-demo');
    const b = await seedFor('pro-demo');
    await removeFlashcardData(a.user._id);
    for (const Model of [FlashcardDeck, Flashcard, FlashcardProgress, FlashcardSession]) {
      // eslint-disable-next-line no-await-in-loop
      expect(await Model.countDocuments({ user: a.user._id })).toBe(0);
      // eslint-disable-next-line no-await-in-loop
      expect(await Model.countDocuments({ user: b.user._id })).toBeGreaterThan(0);
    }
  });

  test('demo accounts without a plan are left with no flashcards', async () => {
    const user = await createUser({ tier: 'FREE' });
    const result = await seedFlashcardsForUser({ user, profile: { key: 'unknown-demo', email: 'x@y.z', tier: 'FREE', subjectProfile: {} } });
    expect(result).toEqual({ decks: 0, cards: 0, sessions: 0 });
  });
});