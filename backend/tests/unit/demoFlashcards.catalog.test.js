const { DEMO_DECKS, DEMO_FLASHCARD_PLANS } = require('../../src/data/demoFlashcards');
const { DEMO_PROFILES } = require('../../src/data/demoProfiles');
const { validateCardList } = require('../../src/services/flashcards/validation');
const { TIER_LIMITS } = require('../../src/config/tiers');
const { DIFFICULTIES, CARD_STYLES } = require('../../src/config/flashcards');

describe('demo flashcard catalog', () => {
  test('every deck passes the real card validation (limits, no empty or duplicate cards)', () => {
    Object.entries(DEMO_DECKS).forEach(([key, deck]) => {
      expect(() => validateCardList(deck.cards)).not.toThrow();
      expect(deck.cards.length).toBeGreaterThanOrEqual(6);
      expect(DIFFICULTIES).toContain(deck.difficulty);
      expect(CARD_STYLES).toContain(deck.cardStyle);
      expect(deck.title.length).toBeLessThanOrEqual(120);
      expect(typeof deck.subject).toBe('string');
      expect(key).toBeTruthy();
    });
  });

  test('every demo account has a plan, and every plan only uses known decks', () => {
    DEMO_PROFILES.forEach((profile) => {
      expect(DEMO_FLASHCARD_PLANS[profile.key]).toBeDefined();
    });
    Object.values(DEMO_FLASHCARD_PLANS).forEach((plan) => {
      plan.forEach((entry) => {
        expect(DEMO_DECKS[entry.deck]).toBeDefined();
        entry.sessions.forEach((s) => {
          expect(s.daysAgo).toBeGreaterThanOrEqual(1); // never a future timestamp
          if (s.partial !== undefined) expect(s.partial).toBeGreaterThan(0);
          if (s.partial !== undefined) expect(s.partial).toBeLessThan(1);
        });
      });
    });
  });

  test('a plan never uses the same deck twice and fits the account’s plan limit', () => {
    DEMO_PROFILES.forEach((profile) => {
      const plan = DEMO_FLASHCARD_PLANS[profile.key];
      expect(new Set(plan.map((p) => p.deck)).size).toBe(plan.length);
      expect(plan.length).toBeLessThanOrEqual(TIER_LIMITS[profile.tier].flashcardDecks);
    });
  });

  test('the Free demo opens exactly at its deck limit so the upgrade prompt can be demonstrated', () => {
    const free = DEMO_PROFILES.find((p) => p.key === 'free-demo');
    expect(DEMO_FLASHCARD_PLANS['free-demo']).toHaveLength(TIER_LIMITS[free.tier].flashcardDecks);
  });

  test('each plan includes at least one studied deck and one untouched deck', () => {
    Object.values(DEMO_FLASHCARD_PLANS).forEach((plan) => {
      expect(plan.some((p) => p.sessions.length > 0)).toBe(true);
      expect(plan.some((p) => p.sessions.length === 0)).toBe(true);
    });
  });
});