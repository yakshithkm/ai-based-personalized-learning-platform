jest.mock('../src/services/ai/geminiService', () => ({
  ...jest.requireActual('../src/services/ai/geminiService'),
  generateJson: jest.fn(),
}));

const request = require('supertest');
const app = require('../src/app');
const { generateJson, GeminiServiceError } = require('../src/services/ai/geminiService');
const FlashcardDeck = require('../src/models/FlashcardDeck');
const Flashcard = require('../src/models/Flashcard');
const FlashcardProgress = require('../src/models/FlashcardProgress');
const FlashcardSession = require('../src/models/FlashcardSession');
const GamificationProfile = require('../src/models/GamificationProfile');
const LearningContent = require('../src/models/LearningContent');
const { createUser, tokenFor } = require('./helpers/learningFixtures');

const as = (token) => ({
  get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url, body = {}) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body),
  put: (url, body = {}) => request(app).put(url).set('Authorization', `Bearer ${token}`).send(body),
  patch: (url, body = {}) => request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body),
  del: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
});

const cardsOf = (n, prefix = 'Q') => Array.from({ length: n }, (_, i) => ({ front: `${prefix}${i + 1}?`, back: `A${i + 1}` }));

const makeDeck = async (api, overrides = {}) => {
  const res = await api.post('/api/flashcards/decks', { title: 'Cell Biology', topic: 'Biology', cards: cardsOf(5), ...overrides });
  expect(res.status).toBe(201);
  return res.body.deck;
};

beforeEach(() => generateJson.mockReset());

describe('Flashcards - auth and ownership', () => {
  test('every route requires authentication', async () => {
    expect((await request(app).get('/api/flashcards/decks')).status).toBe(401);
    expect((await request(app).post('/api/flashcards/generate').send({ topic: 'x' })).status).toBe(401);
    expect((await request(app).post('/api/flashcards/sessions/64b64b64b64b64b64b64b64b/answers').send({})).status).toBe(401);
  });

  test("a user cannot read, change, study or delete another user's deck", async () => {
    const a = as(tokenFor(await createUser()));
    const b = as(tokenFor(await createUser()));
    const deck = await makeDeck(a);
    const detail = await a.get(`/api/flashcards/decks/${deck.id}`);
    const cardId = detail.body.cards[0].id;
    const session = (await a.post(`/api/flashcards/decks/${deck.id}/sessions`, { mode: 'all' })).body.session;

    const attempts = [
      b.get(`/api/flashcards/decks/${deck.id}`),
      b.patch(`/api/flashcards/decks/${deck.id}`, { title: 'hijack' }),
      b.del(`/api/flashcards/decks/${deck.id}`),
      b.get(`/api/flashcards/decks/${deck.id}/history`),
      b.post(`/api/flashcards/decks/${deck.id}/cards`, { front: 'x', back: 'y' }),
      b.patch(`/api/flashcards/decks/${deck.id}/cards/${cardId}`, { front: 'x', back: 'y' }),
      b.del(`/api/flashcards/decks/${deck.id}/cards/${cardId}`),
      b.put(`/api/flashcards/decks/${deck.id}/cards/order`, { cardIds: [cardId] }),
      b.post(`/api/flashcards/decks/${deck.id}/sessions`, {}),
      b.post(`/api/flashcards/sessions/${session.id}/answers`, { cardId, outcome: 'known' }),
      b.post(`/api/flashcards/sessions/${session.id}/complete`),
      b.post(`/api/flashcards/sessions/${session.id}/shuffle`),
    ];
    for (const res of await Promise.all(attempts)) expect(res.status).toBe(404);

    expect((await b.get('/api/flashcards/decks')).body.decks).toHaveLength(0);
    expect(await FlashcardProgress.countDocuments()).toBe(0);
    expect((await a.get(`/api/flashcards/decks/${deck.id}`)).body.deck.title).toBe('Cell Biology');
  });

  test('a client-supplied user id is ignored', async () => {
    const a = await createUser();
    const b = await createUser();
    const res = await as(tokenFor(a)).post('/api/flashcards/decks', { title: 'Mine', user: String(b._id), cards: cardsOf(2) });
    expect(String((await FlashcardDeck.findById(res.body.deck.id)).user)).toBe(String(a._id));
  });

  test('invalid ids get a clean 400', async () => {
    const api = as(tokenFor(await createUser()));
    expect((await api.get('/api/flashcards/decks/not-an-id')).status).toBe(400);
  });
});

describe('Flashcards - decks and cards', () => {
  test('create, list with real stats, get, rename, delete (cascade)', async () => {
    const api = as(tokenFor(await createUser()));
    const deck = await makeDeck(api);
    expect(deck.stats).toMatchObject({ totalCards: 5, reviewedCards: 0, newCards: 5, dueCards: 5, knownCards: 0 });

    const list = await api.get('/api/flashcards/decks');
    expect(list.body.total).toBe(1);
    expect(list.body.decks[0].stats.totalCards).toBe(5);

    const renamed = await api.patch(`/api/flashcards/decks/${deck.id}`, { title: '  Renamed  ' });
    expect(renamed.body.deck.title).toBe('Renamed');

    await api.post(`/api/flashcards/decks/${deck.id}/sessions`, {});
    expect((await api.del(`/api/flashcards/decks/${deck.id}`)).status).toBe(200);
    expect((await api.get(`/api/flashcards/decks/${deck.id}`)).status).toBe(404);
    expect(await Flashcard.countDocuments()).toBe(0);
    expect(await FlashcardSession.countDocuments()).toBe(0);
  });

  test('empty decks, invalid cards and duplicate fronts are rejected', async () => {
    const api = as(tokenFor(await createUser()));
    expect((await api.post('/api/flashcards/decks', { title: 'Empty', cards: [] })).status).toBe(400);
    expect((await api.post('/api/flashcards/decks', { title: 'Bad', cards: [{ front: '', back: 'x' }] })).status).toBe(400);
    expect((await api.post('/api/flashcards/decks', { title: 'Dup', cards: [{ front: 'Same?', back: 'a' }, { front: 'same', back: 'b' }] })).status).toBe(400);
    expect((await api.post('/api/flashcards/decks', { title: '', cards: cardsOf(2) })).status).toBe(400);
    expect(await FlashcardDeck.countDocuments()).toBe(0);
  });

  test('add, edit, delete and reorder cards', async () => {
    const api = as(tokenFor(await createUser()));
    const deck = await makeDeck(api);
    const added = await api.post(`/api/flashcards/decks/${deck.id}/cards`, { front: 'New?', back: 'Yes' });
    expect(added.status).toBe(201);
    expect(added.body.card.order).toBe(5);

    const edited = await api.patch(`/api/flashcards/decks/${deck.id}/cards/${added.body.card.id}`, { front: 'Edited?', back: 'Yes!' });
    expect(edited.body.card.front).toBe('Edited?');
    expect((await api.patch(`/api/flashcards/decks/${deck.id}/cards/${added.body.card.id}`, { front: '', back: 'x' })).status).toBe(400);

    const before = (await api.get(`/api/flashcards/decks/${deck.id}`)).body.cards.map((c) => c.id);
    const reversed = [...before].reverse();
    expect((await api.put(`/api/flashcards/decks/${deck.id}/cards/order`, { cardIds: reversed })).status).toBe(200);
    expect((await api.get(`/api/flashcards/decks/${deck.id}`)).body.cards.map((c) => c.id)).toEqual(reversed);
    expect((await api.put(`/api/flashcards/decks/${deck.id}/cards/order`, { cardIds: reversed.slice(1) })).status).toBe(400);

    expect((await api.del(`/api/flashcards/decks/${deck.id}/cards/${added.body.card.id}`)).status).toBe(200);
    expect((await api.get(`/api/flashcards/decks/${deck.id}`)).body.cards).toHaveLength(5);
  });

  test('search, topic filter, sort and pagination use real data', async () => {
    const api = as(tokenFor(await createUser()));
    await makeDeck(api, { title: 'Photosynthesis', topic: 'Biology' });
    await makeDeck(api, { title: 'Newton Laws', topic: 'Physics' });
    await makeDeck(api, { title: 'Alkanes', topic: 'Chemistry' });

    expect((await api.get('/api/flashcards/decks?search=newton')).body.decks.map((d) => d.title)).toEqual(['Newton Laws']);
    expect((await api.get('/api/flashcards/decks?search=chem')).body.decks.map((d) => d.title)).toEqual(['Alkanes']);
    expect((await api.get('/api/flashcards/decks?topic=Biology')).body.decks).toHaveLength(1);
    expect((await api.get('/api/flashcards/decks?sort=title')).body.decks.map((d) => d.title)).toEqual(['Alkanes', 'Newton Laws', 'Photosynthesis']);
    expect((await api.get('/api/flashcards/decks?sort=recent')).body.decks[0].title).toBe('Alkanes');
    const page = await api.get('/api/flashcards/decks?limit=2&page=2');
    expect(page.body).toMatchObject({ total: 3, totalPages: 2, page: 2 });
    expect(page.body.decks).toHaveLength(1);
    expect((await api.get('/api/flashcards/decks')).body.topics).toEqual(['Biology', 'Chemistry', 'Physics']);
    expect((await api.get('/api/flashcards/decks?search=.*')).body.decks).toHaveLength(0); // regex-escaped
  });

  test('the Free plan deck cap answers with the app-wide tier error', async () => {
    const api = as(tokenFor(await createUser({ tier: 'FREE' })));
    for (let i = 0; i < 5; i += 1) await makeDeck(api, { title: `Deck ${i}` });
    const res = await api.post('/api/flashcards/decks', { title: 'One too many', cards: cardsOf(2) });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, code: 'USAGE_LIMIT_REACHED', usageKey: 'FLASHCARD_DECKS', limit: 5, used: 5, requiredTier: 'PRO' });
    expect(await FlashcardDeck.countDocuments()).toBe(5);
  });
});

describe('Flashcards - plan limits by tier', () => {
  test('Pro and Premium users are not held to the Free deck cap', async () => {
    for (const tier of ['PRO', 'PREMIUM']) {
      // eslint-disable-next-line no-await-in-loop
      const api = as(tokenFor(await createUser({ tier })));
      for (let i = 0; i < 6; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const res = await api.post('/api/flashcards/decks', { title: `${tier} deck ${i}`, cards: cardsOf(2) });
        expect(res.status).toBe(201);
      }
    }
  });
});

describe('Flashcards - study sessions and spaced repetition', () => {
  const setup = async (userOverrides) => {
    const user = await createUser(userOverrides);
    const api = as(tokenFor(user));
    const deck = await makeDeck(api);
    const start = await api.post(`/api/flashcards/decks/${deck.id}/sessions`, { mode: 'all' });
    expect(start.status).toBe(201);
    return { user, api, deck, session: start.body.session };
  };

  test('records answers, schedules cards, and completes with a summary built from real answers', async () => {
    const { user, api, deck, session } = await setup();
    const [c1, c2, c3, c4] = session.cards;
    const answer = (card, outcome) => api.post(`/api/flashcards/sessions/${session.id}/answers`, { cardId: card.id, outcome });

    expect((await answer(c1, 'known')).body).toMatchObject({ reviewed: 1, known: 1, needReview: 0 });
    expect((await answer(c2, 'known')).status).toBe(200);
    expect((await answer(c3, 'review')).body.progress).toMatchObject({ box: 0, lastOutcome: 'review', isDifficult: true });
    expect((await answer(c4, 'review')).status).toBe(200);

    // same answer twice is idempotent
    expect((await answer(c1, 'known')).body).toMatchObject({ reviewed: 4, known: 2 });
    const stored = await FlashcardProgress.findOne({ user: user._id, card: c1.id });
    expect(stored).toMatchObject({ box: 1, reviewCount: 1, knownCount: 1 });

    // changing an answer undoes the earlier scheduling instead of double counting
    const changed = await answer(c1, 'review');
    expect(changed.body).toMatchObject({ reviewed: 4, known: 1, needReview: 3 });
    expect(await FlashcardProgress.findOne({ user: user._id, card: c1.id })).toMatchObject({ box: 0, reviewCount: 1, knownCount: 0, missedCount: 1, lastOutcome: 'review' });

    const done = await api.post(`/api/flashcards/sessions/${session.id}/complete`);
    expect(done.status).toBe(200);
    expect(done.body.summary).toMatchObject({ totalCards: 5, reviewed: 4, known: 1, needReview: 3, unreviewed: 1, accuracy: 25 });
    expect(done.body.summary.missedCards).toHaveLength(3);
    expect(done.body.summary.deckStats).toMatchObject({ reviewedCards: 4, knownCards: 1, needReviewCards: 3, newCards: 1, difficultCards: 3 });

    // completing again is a no-op that returns the same summary
    const again = await api.post(`/api/flashcards/sessions/${session.id}/complete`);
    expect(again.body.summary.reviewed).toBe(4);
    expect(again.body.gamification).toBeNull();

    const detail = await api.get(`/api/flashcards/decks/${deck.id}`);
    expect(detail.body.deck.lastStudiedAt).toBeTruthy();
    const history = await api.get(`/api/flashcards/decks/${deck.id}/history`);
    expect(history.body.sessions).toHaveLength(1);
    expect(history.body.sessions[0]).toMatchObject({ reviewed: 4, known: 1, needReview: 3 });

    // XP awarded exactly once for the session
    const profile = await GamificationProfile.findOne({ user: user._id });
    expect(profile.totalFlashcardsReviewed).toBe(4);
  });

  test('study modes: due and difficult pick the right cards and refuse when empty', async () => {
    const { api, deck, session } = await setup();
    const ids = session.cards.map((c) => c.id);
    await api.post(`/api/flashcards/sessions/${session.id}/answers`, { cardId: ids[0], outcome: 'known' });
    await api.post(`/api/flashcards/sessions/${session.id}/answers`, { cardId: ids[1], outcome: 'review' });
    await api.post(`/api/flashcards/sessions/${session.id}/complete`);

    const difficult = await api.post(`/api/flashcards/decks/${deck.id}/sessions`, { mode: 'difficult' });
    expect(difficult.body.session.cards.map((c) => c.id)).toEqual([ids[1]]);

    const due = await api.post(`/api/flashcards/decks/${deck.id}/sessions`, { mode: 'due' });
    // ids[0] was known (not due for a day); the missed card and the 3 never-seen cards are due
    expect(due.body.session.cards.map((c) => c.id).sort()).toEqual([ids[1], ids[2], ids[3], ids[4]].sort());

    await FlashcardProgress.updateMany({}, { $set: { lastOutcome: 'known', missedCount: 0, box: 3, lastReviewedAt: new Date(), nextReviewAt: new Date(Date.now() + 5 * 86400000) } });
    await FlashcardSession.deleteMany({ status: 'active' });
    const noneDifficult = await api.post(`/api/flashcards/decks/${deck.id}/sessions`, { mode: 'difficult' });
    expect(noneDifficult.status).toBe(409);
  });

  test('a refresh resumes the same session (order and answers); restart begins a fresh one', async () => {
    const { api, deck, session } = await setup();
    await api.post(`/api/flashcards/sessions/${session.id}/answers`, { cardId: session.cards[0].id, outcome: 'known' });
    await api.post(`/api/flashcards/sessions/${session.id}/shuffle`);

    const resumed = await api.post(`/api/flashcards/decks/${deck.id}/sessions`, { mode: 'all' });
    expect(resumed.status).toBe(200);
    expect(resumed.body.resumed).toBe(true);
    expect(resumed.body.session.id).toBe(session.id);
    expect(resumed.body.session.answers[session.cards[0].id]).toBe('known');
    expect((await api.get(`/api/flashcards/decks/${deck.id}`)).body.activeSession).toMatchObject({ id: session.id, answered: 1, total: 5 });

    const restarted = await api.post(`/api/flashcards/decks/${deck.id}/sessions`, { mode: 'all', restart: true });
    expect(restarted.status).toBe(201);
    expect(restarted.body.session.id).not.toBe(session.id);
    expect(restarted.body.session.answers).toEqual({});
    expect((await FlashcardSession.findById(session.id)).status).toBe('abandoned');
    // progress recorded before the restart is kept
    expect(await FlashcardProgress.countDocuments({ lastOutcome: 'known' })).toBe(1);
  });

  test('ending early counts only what was answered; no answers = abandoned with no XP', async () => {
    const { user, api, session } = await setup();
    const empty = await api.post(`/api/flashcards/sessions/${session.id}/complete`);
    expect(empty.body.summary).toMatchObject({ reviewed: 0, status: 'abandoned', accuracy: null });
    expect(empty.body.gamification).toBeNull();
    expect((await GamificationProfile.findOne({ user: user._id }))?.totalFlashcardsReviewed || 0).toBe(0);
    expect((await api.post(`/api/flashcards/sessions/${session.id}/answers`, { cardId: session.cards[0].id, outcome: 'known' })).status).toBe(409);
  });

  test('bad answers are rejected; deleted cards are skipped and cleaned up', async () => {
    const { user, api, deck, session } = await setup();
    const post = (body) => api.post(`/api/flashcards/sessions/${session.id}/answers`, body);
    expect((await post({ cardId: session.cards[0].id, outcome: 'maybe' })).status).toBe(400);
    expect((await post({ cardId: 'nope', outcome: 'known' })).status).toBe(400);
    expect((await post({ cardId: '64b64b64b64b64b64b64b64b', outcome: 'known' })).status).toBe(400);

    await post({ cardId: session.cards[0].id, outcome: 'known' });
    await api.del(`/api/flashcards/decks/${deck.id}/cards/${session.cards[0].id}`);
    expect(await FlashcardProgress.countDocuments({ user: user._id })).toBe(0);
    expect((await post({ cardId: session.cards[0].id, outcome: 'known' })).status).toBe(404);

    const resumed = await api.post(`/api/flashcards/decks/${deck.id}/sessions`, { mode: 'all' });
    expect(resumed.body.session.cards).toHaveLength(4);
    const done = await api.post(`/api/flashcards/sessions/${session.id}/complete`);
    expect(done.body.summary.reviewed).toBe(0);
  });

  test('editing a card keeps its review history', async () => {
    const { api, deck, session } = await setup();
    const card = session.cards[0];
    await api.post(`/api/flashcards/sessions/${session.id}/answers`, { cardId: card.id, outcome: 'known' });
    const edited = await api.patch(`/api/flashcards/decks/${deck.id}/cards/${card.id}`, { front: 'Reworded?', back: 'Better' });
    expect(edited.body.card.progress).toMatchObject({ lastOutcome: 'known', box: 1 });
  });

  test('a deck with no cards cannot be studied', async () => {
    const api = as(tokenFor(await createUser()));
    const deck = await makeDeck(api, { cards: cardsOf(1) });
    const detail = await api.get(`/api/flashcards/decks/${deck.id}`);
    await api.del(`/api/flashcards/decks/${deck.id}/cards/${detail.body.cards[0].id}`);
    expect((await api.post(`/api/flashcards/decks/${deck.id}/sessions`, {})).status).toBe(409);
  });

  test('summary endpoint aggregates across decks from real rows', async () => {
    const { api } = await setup();
    expect((await api.get('/api/flashcards/summary')).body).toMatchObject({ decks: 1, totalCards: 5, dueCards: 5, reviewedCards: 0 });
  });
});

describe('Flashcards - AI generation', () => {
  const aiOk = (cards = cardsOf(4)) => generateJson.mockResolvedValue(JSON.stringify({ cards }));

  test('returns validated, unsaved cards and spends one AI unit', async () => {
    const user = await createUser({ tier: 'FREE' });
    const api = as(tokenFor(user));
    aiOk([...cardsOf(3), { front: '', back: 'bad' }, { front: 'Q1?', back: 'duplicate' }]);
    const res = await api.post('/api/flashcards/generate', { topic: 'Cells', count: 5, difficulty: 'beginner', cardStyle: 'qa' });
    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(3);
    expect(res.body.meta).toMatchObject({ requested: 5, returned: 3, dropped: 2, source: 'topic' });
    expect(await FlashcardDeck.countDocuments()).toBe(0);
    expect((await api.get('/api/tier/me')).body.usage.AI.used).toBe(1);
  });

  test('uses pasted notes as source and passes avoid-fronts for single-card regeneration', async () => {
    const api = as(tokenFor(await createUser()));
    aiOk([{ front: 'Fresh?', back: 'New' }]);
    const res = await api.post('/api/flashcards/generate', { sourceText: 'Mitochondria make ATP.', count: 1, avoidFronts: ['Old?'] });
    expect(res.body.meta.source).toBe('text');
    const prompt = generateJson.mock.calls[0][0].contents[0].parts[0].text;
    expect(prompt).toMatch(/Mitochondria make ATP/);
    expect(prompt).toMatch(/Old\?/);
  });

  test('validates input before calling the AI', async () => {
    const api = as(tokenFor(await createUser()));
    expect((await api.post('/api/flashcards/generate', {})).status).toBe(400);
    expect((await api.post('/api/flashcards/generate', { topic: 'x', count: 999 })).status).toBe(400);
    expect((await api.post('/api/flashcards/generate', { topic: 'x', difficulty: 'godlike' })).status).toBe(400);
    expect(generateJson).not.toHaveBeenCalled();
  });

  test('provider errors surface with their status and refund the quota', async () => {
    const api = as(tokenFor(await createUser({ tier: 'FREE' })));
    generateJson.mockRejectedValue(new GeminiServiceError('AI usage limit reached temporarily. Please try again later.', { code: 'RATE_LIMITED', statusCode: 429 }));
    expect((await api.post('/api/flashcards/generate', { topic: 'x' })).status).toBe(429);
    generateJson.mockRejectedValue(new GeminiServiceError('AI explanation is temporarily unavailable.', { code: 'CONFIG_MISSING', statusCode: 503 }));
    expect((await api.post('/api/flashcards/generate', { topic: 'x' })).status).toBe(503);
    generateJson.mockResolvedValue('this is not json');
    expect((await api.post('/api/flashcards/generate', { topic: 'x' })).status).toBe(502);
    // the refund is released asynchronously after the response is sent
    let used = null;
    for (let i = 0; i < 20 && used !== 0; i += 1) {
      used = (await api.get('/api/tier/me')).body.usage.AI.used;
      if (used !== 0) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(used).toBe(0);
  });

  test('the Free plan daily AI quota is enforced server-side', async () => {
    const api = as(tokenFor(await createUser({ tier: 'FREE' })));
    aiOk();
    for (let i = 0; i < 5; i += 1) expect((await api.post('/api/flashcards/generate', { topic: 'x' })).status).toBe(200);
    const blocked = await api.post('/api/flashcards/generate', { topic: 'x' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('USAGE_LIMIT_REACHED');
    expect(generateJson).toHaveBeenCalledTimes(5);
  });

  test('lesson source: uses the lesson text, refuses lessons without text and tier-locked ones', async () => {
    const lesson = await LearningContent.create({
      title: 'Cell Division', subject: 'Biology', topic: 'Cell Cycle', contentType: 'notes',
      body: 'Mitosis has prophase, metaphase, anaphase and telophase. '.repeat(4), accessTier: 'FREE',
    });
    const linkOnly = await LearningContent.create({ title: 'Video', subject: 'Biology', topic: 'Cell Cycle', contentType: 'video', url: 'https://example.com/v' });
    const premium = await LearningContent.create({
      title: 'Premium notes', subject: 'Biology', topic: 'Genetics', contentType: 'notes', body: 'x'.repeat(200), accessTier: 'PREMIUM',
    });
    const api = as(tokenFor(await createUser({ tier: 'FREE' })));

    aiOk();
    const ok = await api.post('/api/flashcards/generate', { learningContentId: String(lesson._id) });
    expect(ok.status).toBe(200);
    expect(ok.body.meta).toMatchObject({ source: 'lesson', topic: 'Cell Cycle', learningContent: { title: 'Cell Division' } });
    expect(generateJson.mock.calls[0][0].contents[0].parts[0].text).toMatch(/prophase/);

    expect((await api.post('/api/flashcards/generate', { learningContentId: String(linkOnly._id) })).status).toBe(422);
    const locked = await api.post('/api/flashcards/generate', { learningContentId: String(premium._id) });
    expect(locked.status).toBe(403);
    expect(locked.body).toMatchObject({ code: 'TIER_UPGRADE_REQUIRED', requiredTier: 'PREMIUM' });
    expect((await api.post('/api/flashcards/generate', { learningContentId: 'bad' })).status).toBe(400);
  });
});
