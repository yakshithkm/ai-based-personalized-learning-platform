jest.mock('../../src/services/ai/geminiService', () => ({ generateJson: jest.fn() }));

const { generateJson } = require('../../src/services/ai/geminiService');
const { generateFlashcards, buildUserPrompt } = require('../../src/services/ai/flashcardGenerator');

beforeEach(() => generateJson.mockReset());

describe('flashcard generator', () => {
  test('returns validated cards and sends a structured, grounded request', async () => {
    generateJson.mockResolvedValue(JSON.stringify({ cards: [{ front: 'Q?', back: 'A' }, { front: 'Q?', back: 'dup' }] }));
    const result = await generateFlashcards({ topic: 'Cells', sourceText: 'Cells are units of life.', count: 5, difficulty: 'beginner', cardStyle: 'definitions', language: 'hi' });
    expect(result.cards).toEqual([{ front: 'Q?', back: 'A' }]);
    expect(result.dropped).toBe(1);

    const call = generateJson.mock.calls[0][0];
    expect(call.responseJsonSchema.required).toEqual(['cards']);
    expect(call.systemInstruction).toMatch(/ONLY from that material/);
    expect(call.systemInstruction).toMatch(/Hindi/);
    const prompt = call.contents[0].parts[0].text;
    expect(prompt).toMatch(/Create 5 flashcards/);
    expect(prompt).toMatch(/<<<SOURCE_MATERIAL/);
  });

  test('with no source material the prompt says so instead of implying a document', () => {
    const prompt = buildUserPrompt({ topic: 'Newton', sourceText: '', count: 1, difficulty: 'advanced', cardStyle: 'qa', avoidFronts: ['Old front?'] });
    expect(prompt).toMatch(/no source material/i);
    expect(prompt).toMatch(/Old front\?/);
  });

  test('provider failures and malformed output propagate with student-safe status codes', async () => {
    const err = Object.assign(new Error('AI usage limit reached temporarily. Please try again later.'), { statusCode: 429 });
    generateJson.mockRejectedValue(err);
    await expect(generateFlashcards({ topic: 't', count: 3, difficulty: 'beginner', cardStyle: 'qa' })).rejects.toMatchObject({ statusCode: 429 });

    generateJson.mockResolvedValue('garbage');
    await expect(generateFlashcards({ topic: 't', count: 3, difficulty: 'beginner', cardStyle: 'qa' })).rejects.toMatchObject({ statusCode: 502 });
  });
});
