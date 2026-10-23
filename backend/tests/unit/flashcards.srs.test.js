const { emptyState, applyOutcome, isDue, isDifficult, DAY_MS } = require('../../src/services/flashcards/srs');

const T0 = new Date('2026-01-01T10:00:00Z');

describe('flashcard spaced repetition (Leitner boxes)', () => {
  test('a new card is due and not difficult', () => {
    expect(isDue(emptyState(), T0)).toBe(true);
    expect(isDifficult(emptyState())).toBe(false);
  });

  test('"known" climbs one box per success with growing intervals', () => {
    let state = emptyState();
    const expectedDays = [1, 3, 7, 14, 30, 30];
    expectedDays.forEach((days, i) => {
      state = applyOutcome(state, 'known', T0);
      expect(state.box).toBe(Math.min(i + 1, 5));
      expect(state.nextReviewAt.getTime() - T0.getTime()).toBe(days * DAY_MS);
    });
    expect(state.knownCount).toBe(6);
    expect(state.reviewCount).toBe(6);
  });

  test('"review" resets to box 0 and is due immediately', () => {
    let state = applyOutcome(applyOutcome(emptyState(), 'known', T0), 'known', T0);
    state = applyOutcome(state, 'review', T0);
    expect(state.box).toBe(0);
    expect(state.lastOutcome).toBe('review');
    expect(state.missedCount).toBe(1);
    expect(isDue(state, T0)).toBe(true);
    expect(isDifficult(state)).toBe(true);
  });

  test('a known card is not due until its interval has passed', () => {
    const state = applyOutcome(emptyState(), 'known', T0);
    expect(isDue(state, new Date(T0.getTime() + DAY_MS - 1))).toBe(false);
    expect(isDue(state, new Date(T0.getTime() + DAY_MS))).toBe(true);
  });

  test('a card missed twice stays difficult until it climbs past box 2', () => {
    let state = emptyState();
    state = applyOutcome(state, 'review', T0);
    state = applyOutcome(state, 'review', T0);
    state = applyOutcome(state, 'known', T0); // box 1, last outcome known, missed twice
    expect(isDifficult(state)).toBe(true);
    state = applyOutcome(state, 'known', T0); // box 2
    expect(isDifficult(state)).toBe(true);
    state = applyOutcome(state, 'known', T0); // box 3
    expect(isDifficult(state)).toBe(false);
  });

  test('applyOutcome does not mutate its input and rejects unknown outcomes', () => {
    const before = emptyState();
    applyOutcome(before, 'known', T0);
    expect(before).toEqual(emptyState());
    expect(() => applyOutcome(before, 'maybe', T0)).toThrow();
  });
});
