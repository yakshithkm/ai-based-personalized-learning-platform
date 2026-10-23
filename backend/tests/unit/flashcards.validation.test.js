const {
  validateCard,
  validateCardList,
  validateDeckInput,
  validateDeckPatch,
  validateGenerateInput,
  parseGeneratedCards,
  GeneratedOutputError,
} = require('../../src/services/flashcards/validation');
const { LIMITS } = require('../../src/config/flashcards');

const status = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error.statusCode;
  }
};

describe('card + deck validation', () => {
  test('cards are trimmed and control characters stripped', () => {
    expect(validateCard({ front: '  What is ATP?\u0000 ', back: ' Energy currency ' })).toEqual({
      front: 'What is ATP?',
      back: 'Energy currency',
    });
  });

  test('empty, missing and oversized card sides are rejected with 400', () => {
    expect(status(() => validateCard({ front: '', back: 'x' }))).toBe(400);
    expect(status(() => validateCard({ front: 'x' }))).toBe(400);
    expect(status(() => validateCard({ front: 'x'.repeat(LIMITS.FRONT + 1), back: 'y' }))).toBe(400);
    expect(status(() => validateCard({ front: 'x', back: 'y'.repeat(LIMITS.BACK + 1) }))).toBe(400);
    expect(status(() => validateCard({ front: { $gt: '' }, back: 'y' }))).toBe(400);
  });

  test('an empty deck, too many cards, and duplicate fronts are rejected', () => {
    expect(status(() => validateCardList([]))).toBe(400);
    expect(status(() => validateCardList(undefined))).toBe(400);
    expect(status(() => validateCardList(Array.from({ length: LIMITS.CARDS_PER_SAVE + 1 }, (_, i) => ({ front: `q${i}`, back: 'a' }))))).toBe(400);
    expect(status(() => validateCardList([{ front: 'What is DNA?', back: 'a' }, { front: 'what is dna', back: 'b' }]))).toBe(400);
  });

  test('deck input requires a title and rejects unknown enum values', () => {
    expect(status(() => validateDeckInput({ title: '   ' }))).toBe(400);
    expect(status(() => validateDeckInput({ title: 'ok', difficulty: 'impossible' }))).toBe(400);
    expect(validateDeckInput({ title: 'Cells', difficulty: 'advanced', cardStyle: 'qa', source: 'text' })).toMatchObject({
      title: 'Cells', difficulty: 'advanced', cardStyle: 'qa', source: 'text',
    });
    expect(validateDeckInput({ title: 'Manual' }).source).toBe('manual');
    expect(status(() => validateDeckPatch({}))).toBe(400);
    expect(validateDeckPatch({ title: 'New' })).toEqual({ title: 'New' });
  });

  test('generation input: needs material, bounds the count, applies defaults', () => {
    expect(status(() => validateGenerateInput({}))).toBe(400);
    expect(status(() => validateGenerateInput({ topic: 'x', count: 0 }))).toBe(400);
    expect(status(() => validateGenerateInput({ topic: 'x', count: LIMITS.AI_MAX_CARDS + 1 }))).toBe(400);
    expect(status(() => validateGenerateInput({ topic: 'x', count: 2.5 }))).toBe(400);
    expect(status(() => validateGenerateInput({ sourceText: 'a'.repeat(LIMITS.SOURCE_TEXT + 1) }))).toBe(400);
    expect(validateGenerateInput({ topic: 'Photosynthesis' })).toMatchObject({ count: 10, difficulty: 'intermediate', cardStyle: 'qa' });
  });
});

describe('AI output validation', () => {
  test('parses plain, fenced and wrapped JSON', () => {
    const body = { cards: [{ front: 'Q1?', back: 'A1' }] };
    expect(parseGeneratedCards(JSON.stringify(body)).cards).toHaveLength(1);
    expect(parseGeneratedCards('```json\n' + JSON.stringify(body) + '\n```').cards).toHaveLength(1);
    expect(parseGeneratedCards(`Here you go: ${JSON.stringify(body)} Enjoy!`).cards).toHaveLength(1);
    expect(parseGeneratedCards(JSON.stringify(body.cards)).cards).toHaveLength(1);
  });

  test('drops invalid, duplicate, over-long and avoided cards and honours maxCards', () => {
    const raw = JSON.stringify({
      cards: [
        { front: 'What is ATP?', back: 'Energy currency' },
        { front: 'what is ATP', back: 'duplicate' },
        { front: '', back: 'empty front' },
        { front: 'No back' },
        { front: 'x'.repeat(LIMITS.FRONT + 1), back: 'too long' },
        { front: 'Already in deck?', back: 'avoid me' },
        { front: 'Second?', back: 'yes' },
        { front: 'Third?', back: 'cut by maxCards' },
      ],
    });
    const { cards, dropped } = parseGeneratedCards(raw, { maxCards: 2, avoidFronts: ['Already in deck?'] });
    expect(cards.map((c) => c.front)).toEqual(['What is ATP?', 'Second?']);
    expect(dropped).toBe(6);
  });

  test('malformed or empty output throws a 502 GeneratedOutputError', () => {
    ['', 'not json at all', '{"cards": "nope"}', '{"cards": []}', '{"cards":[{"front":"","back":""}]}'].forEach((raw) => {
      let caught;
      try { parseGeneratedCards(raw); } catch (error) { caught = error; }
      expect(caught).toBeInstanceOf(GeneratedOutputError);
      expect(caught.statusCode).toBe(502);
    });
  });
});
