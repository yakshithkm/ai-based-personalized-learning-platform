const mongoose = require('mongoose');
const FlashcardDeck = require('../../models/FlashcardDeck');
const Flashcard = require('../../models/Flashcard');
const FlashcardProgress = require('../../models/FlashcardProgress');
const FlashcardSession = require('../../models/FlashcardSession');
const { HttpError } = require('../learning/errors');
const { LIMITS, SORTS, STUDY_MODES, OUTCOMES } = require('../../config/flashcards');
const { getTierLimits } = require('../tier/tierService');
const { emptyState, toState, applyOutcome, isDue, isDifficult } = require('./srs');

const oid = (value) => new mongoose.Types.ObjectId(String(value));
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ------------------------------------------------------------------ serializers */

const serializeProgress = (doc, now = new Date()) => {
  const state = toState(doc);
  return {
    box: state.box,
    reviewCount: state.reviewCount,
    knownCount: state.knownCount,
    missedCount: state.missedCount,
    lastOutcome: state.lastOutcome,
    lastReviewedAt: state.lastReviewedAt,
    nextReviewAt: state.nextReviewAt,
    isNew: !state.lastReviewedAt,
    isDue: isDue(state, now),
    isDifficult: isDifficult(state),
  };
};

const serializeCard = (card, progressDoc, now) => ({
  id: String(card._id),
  deckId: String(card.deck),
  front: card.front,
  back: card.back,
  order: card.order,
  progress: serializeProgress(progressDoc, now),
});

const serializeDeck = (deck, stats = null) => ({
  id: String(deck._id),
  title: deck.title,
  description: deck.description || '',
  topic: deck.topic || '',
  difficulty: deck.difficulty || '',
  cardStyle: deck.cardStyle || '',
  source: deck.source,
  language: deck.language,
  createdAt: deck.createdAt,
  updatedAt: deck.updatedAt,
  lastStudiedAt: deck.lastStudiedAt || null,
  stats,
});

/* ------------------------------------------------------------------ stats (all derived) */

const EMPTY_STATS = Object.freeze({
  totalCards: 0, reviewedCards: 0, newCards: 0, knownCards: 0, needReviewCards: 0, dueCards: 0, difficultCards: 0,
});

/**
 * Per-deck stats computed from the real card + progress rows (nothing stored, nothing invented).
 * Due / difficult are evaluated with the SAME srs.js predicates the study modes use, so a deck's
 * "12 due" and the "Study due" session can never disagree. Returns Map(deckId string -> stats).
 */
const computeDeckStats = async (userId, deckIds = null, now = new Date()) => {
  const match = { user: oid(userId) };
  if (deckIds) match.deck = { $in: deckIds.map(oid) };

  const [cardCounts, progressRows] = await Promise.all([
    Flashcard.aggregate([{ $match: match }, { $group: { _id: '$deck', total: { $sum: 1 } } }]),
    FlashcardProgress.find(match).select('deck box missedCount lastOutcome lastReviewedAt nextReviewAt').lean(),
  ]);

  const result = new Map();
  cardCounts.forEach((row) => result.set(String(row._id), { ...EMPTY_STATS, totalCards: row.total, newCards: row.total, dueCards: row.total }));

  progressRows.forEach((row) => {
    const stats = result.get(String(row.deck));
    if (!stats || !row.lastReviewedAt) return; // never answered (or card gone) = still "new"
    stats.reviewedCards += 1;
    stats.newCards -= 1;
    if (row.lastOutcome === 'known') stats.knownCards += 1;
    if (row.lastOutcome === 'review') stats.needReviewCards += 1;
    if (!isDue(row, now)) stats.dueCards -= 1; // started as "every card is due", minus the not-yet-due ones
    if (isDifficult(row)) stats.difficultCards += 1;
  });
  return result;
};

const statsFor = (map, deckId) => map.get(String(deckId)) || { ...EMPTY_STATS };

/* ------------------------------------------------------------------ decks */

const findOwnedDeck = async (userId, deckId) => {
  const deck = await FlashcardDeck.findOne({ _id: deckId, user: userId });
  // 404 (not 403) for someone else's deck so ids cannot be probed.
  if (!deck) throw new HttpError(404, 'Deck not found');
  return deck;
};

const listDecks = async (userId, { search = '', topic = '', sort = 'recent', page = 1, limit = LIMITS.PAGE_SIZE_DEFAULT } = {}) => {
  const filter = { user: userId };
  const q = String(search || '').trim().slice(0, 80);
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { topic: rx }];
  }
  if (topic) filter.topic = String(topic).slice(0, LIMITS.TOPIC);

  const safeSort = SORTS.includes(sort) ? sort : 'recent';
  const sortSpec =
    safeSort === 'title'
      ? { titleKey: 1, _id: 1 }
      : safeSort === 'studied'
        ? { lastStudiedAt: -1, createdAt: -1, _id: 1 }
        : { createdAt: -1, _id: 1 };
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || LIMITS.PAGE_SIZE_DEFAULT, 1), LIMITS.PAGE_SIZE_MAX);
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);

  const [total, decks, topics] = await Promise.all([
    FlashcardDeck.countDocuments(filter),
    FlashcardDeck.find(filter)
      .sort(sortSpec)
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    FlashcardDeck.distinct('topic', { user: userId }),
  ]);

  const statsMap = decks.length ? await computeDeckStats(userId, decks.map((d) => d._id)) : new Map();
  return {
    decks: decks.map((deck) => serializeDeck(deck, statsFor(statsMap, deck._id))),
    total,
    page: pageNum,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    topics: topics.filter(Boolean).sort((a, b) => a.localeCompare(b)),
  };
};

const getSummary = async (userId) => {
  const [decks, statsMap] = await Promise.all([FlashcardDeck.countDocuments({ user: userId }), computeDeckStats(userId)]);
  const totals = { ...EMPTY_STATS };
  statsMap.forEach((s) => Object.keys(totals).forEach((k) => { totals[k] += s[k]; }));
  return { decks, ...totals };
};

const assertDeckCapacity = async (userId, tier) => {
  const count = await FlashcardDeck.countDocuments({ user: userId });
  const planLimit = getTierLimits(tier).flashcardDecks;
  const limit = Number.isFinite(planLimit) ? planLimit : LIMITS.DECKS_HARD_CEILING;
  if (count >= Math.min(limit, LIMITS.DECKS_HARD_CEILING)) {
    const error = new HttpError(403, 'You have reached the flashcard deck limit for your plan.');
    error.tierLimit = { usageKey: 'FLASHCARD_DECKS', used: count, limit, unlimited: !Number.isFinite(planLimit) };
    throw error;
  }
};

// `createdAt` is optional and only used by the demo seeder to backdate a deck; normal requests omit it.
const createDeck = async (userId, tier, meta, cards, { sourceContent = null, language = 'en', createdAt = null } = {}) => {
  await assertDeckCapacity(userId, tier);
  const deck = await FlashcardDeck.create({ user: userId, ...meta, sourceContent, language, ...(createdAt ? { createdAt } : {}) });
  try {
    await Flashcard.insertMany(cards.map((card, index) => ({ deck: deck._id, user: userId, front: card.front, back: card.back, order: index })));
  } catch (error) {
    await FlashcardDeck.deleteOne({ _id: deck._id });
    throw error;
  }
  const statsMap = await computeDeckStats(userId, [deck._id]);
  return serializeDeck(deck, statsFor(statsMap, deck._id));
};

const updateDeck = async (userId, deckId, patch) => {
  const deck = await findOwnedDeck(userId, deckId);
  Object.assign(deck, patch);
  await deck.save();
  const statsMap = await computeDeckStats(userId, [deck._id]);
  return serializeDeck(deck, statsFor(statsMap, deck._id));
};

const deleteDeck = async (userId, deckId) => {
  const deck = await findOwnedDeck(userId, deckId);
  await Promise.all([
    Flashcard.deleteMany({ deck: deck._id, user: userId }),
    FlashcardProgress.deleteMany({ deck: deck._id, user: userId }),
    FlashcardSession.deleteMany({ deck: deck._id, user: userId }),
  ]);
  await FlashcardDeck.deleteOne({ _id: deck._id, user: userId });
};

const getActiveSessionInfo = async (userId, deckId) => {
  const cutoff = new Date(Date.now() - LIMITS.SESSION_RESUME_HOURS * 3600 * 1000);
  const active = await FlashcardSession.findOne({ user: userId, deck: deckId, status: 'active', startedAt: { $gte: cutoff } })
    .sort({ startedAt: -1 })
    .lean();
  if (!active) return null;
  return { id: String(active._id), mode: active.mode, answered: active.answers.length, total: active.totalCards };
};

const getDeckDetail = async (userId, deckId) => {
  const deck = await findOwnedDeck(userId, deckId);
  const now = new Date();
  const [cards, progress, statsMap, activeSession] = await Promise.all([
    Flashcard.find({ deck: deck._id, user: userId }).sort({ order: 1, _id: 1 }).lean(),
    FlashcardProgress.find({ deck: deck._id, user: userId }).lean(),
    computeDeckStats(userId, [deck._id], now),
    getActiveSessionInfo(userId, deck._id),
  ]);
  const progressByCard = new Map(progress.map((p) => [String(p.card), p]));
  return {
    deck: serializeDeck(deck, statsFor(statsMap, deck._id)),
    cards: cards.map((card) => serializeCard(card, progressByCard.get(String(card._id)), now)),
    activeSession,
  };
};

/* ------------------------------------------------------------------ cards */

const addCard = async (userId, deckId, card) => {
  const deck = await findOwnedDeck(userId, deckId);
  const count = await Flashcard.countDocuments({ deck: deck._id, user: userId });
  if (count >= LIMITS.CARDS_PER_DECK) throw new HttpError(400, `A deck can hold at most ${LIMITS.CARDS_PER_DECK} cards`);
  const last = await Flashcard.findOne({ deck: deck._id, user: userId }).sort({ order: -1 }).select('order').lean();
  const created = await Flashcard.create({ deck: deck._id, user: userId, ...card, order: last ? last.order + 1 : 0 });
  return serializeCard(created, null, new Date());
};

const findOwnedCard = async (userId, deckId, cardId) => {
  const card = await Flashcard.findOne({ _id: cardId, deck: deckId, user: userId });
  if (!card) throw new HttpError(404, 'Card not found');
  return card;
};

// Editing keeps the card's review history: the student is refining wording, not starting over.
const updateCard = async (userId, deckId, cardId, card) => {
  const doc = await findOwnedCard(userId, deckId, cardId);
  doc.front = card.front;
  doc.back = card.back;
  await doc.save();
  const progress = await FlashcardProgress.findOne({ user: userId, card: doc._id }).lean();
  return serializeCard(doc, progress, new Date());
};

// Deleting removes the card's progress; sessions simply skip cards that no longer exist.
const deleteCard = async (userId, deckId, cardId) => {
  const doc = await findOwnedCard(userId, deckId, cardId);
  await Promise.all([Flashcard.deleteOne({ _id: doc._id }), FlashcardProgress.deleteMany({ user: userId, card: doc._id })]);
};

const reorderCards = async (userId, deckId, cardIds) => {
  const deck = await findOwnedDeck(userId, deckId);
  const existing = await Flashcard.find({ deck: deck._id, user: userId }).select('_id').lean();
  const have = new Set(existing.map((c) => String(c._id)));
  const want = Array.isArray(cardIds) ? cardIds.map(String) : [];
  if (want.length !== have.size || new Set(want).size !== want.length || !want.every((id) => have.has(id))) {
    throw new HttpError(400, 'cardIds must list every card in the deck exactly once');
  }
  await Flashcard.bulkWrite(want.map((id, index) => ({ updateOne: { filter: { _id: id, user: userId }, update: { $set: { order: index } } } })));
};

/* ------------------------------------------------------------------ sessions */

const shuffled = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const answerCounts = (answers) => {
  const known = answers.filter((a) => a.outcome === 'known').length;
  return { reviewed: answers.length, known, needReview: answers.length - known };
};

const serializeSession = async (session, now = new Date()) => {
  const ids = session.cardOrder.map(String);
  const [cards, progress] = await Promise.all([
    Flashcard.find({ _id: { $in: ids }, user: session.user }).lean(),
    FlashcardProgress.find({ user: session.user, card: { $in: ids } }).lean(),
  ]);
  const byId = new Map(cards.map((c) => [String(c._id), c]));
  const progressById = new Map(progress.map((p) => [String(p.card), p]));
  // Cards deleted after the session started are skipped.
  const ordered = ids.filter((id) => byId.has(id)).map((id) => serializeCard(byId.get(id), progressById.get(id), now));
  const answers = {};
  session.answers.forEach((a) => {
    if (byId.has(String(a.card))) answers[String(a.card)] = a.outcome;
  });
  return {
    id: String(session._id),
    deckId: String(session.deck),
    mode: session.mode,
    status: session.status,
    startedAt: session.startedAt,
    totalCards: ordered.length,
    cards: ordered,
    answers,
  };
};

const finalizeSession = async (session, status, now = new Date()) => {
  const existingIds = new Set(
    (await Flashcard.find({ _id: { $in: session.answers.map((a) => a.card) }, user: session.user }).select('_id').lean()).map((c) => String(c._id))
  );
  const { reviewed, known, needReview } = answerCounts(session.answers.filter((a) => existingIds.has(String(a.card))));
  return FlashcardSession.findOneAndUpdate(
    { _id: session._id, status: 'active' },
    { $set: { status, completedAt: now, reviewedCount: reviewed, knownCount: known, reviewAgainCount: needReview } },
    { new: true }
  );
};

// `now` is an injectable clock (defaults to the real time). Only the demo seeder passes it, so
// seeded study history can be backdated through this same logic; HTTP requests never set it.
const startSession = async (userId, deckId, { mode = 'all', shuffle = false, restart = false, now = new Date() } = {}) => {
  if (!STUDY_MODES.includes(mode)) throw new HttpError(400, 'Invalid study mode');
  const deck = await findOwnedDeck(userId, deckId);

  const [cards, progress] = await Promise.all([
    Flashcard.find({ deck: deck._id, user: userId }).sort({ order: 1, _id: 1 }).lean(),
    FlashcardProgress.find({ deck: deck._id, user: userId }).lean(),
  ]);
  if (cards.length === 0) throw new HttpError(409, 'This deck has no cards to study yet');

  // Stale or explicitly restarted sessions are closed (their recorded answers are kept).
  const cutoff = new Date(now.getTime() - LIMITS.SESSION_RESUME_HOURS * 3600 * 1000);
  const openSessions = await FlashcardSession.find({ user: userId, deck: deck._id, status: 'active' });
  for (const open of openSessions) {
    if (restart || open.startedAt < cutoff || open.mode !== mode) {
      await finalizeSession(open, 'abandoned', now);
    }
  }
  if (!restart) {
    const resumable = await FlashcardSession.findOne({ user: userId, deck: deck._id, status: 'active', mode, startedAt: { $gte: cutoff } }).sort({ startedAt: -1 });
    if (resumable) return { resumed: true, session: await serializeSession(resumable, now) };
  }

  const progressById = new Map(progress.map((p) => [String(p.card), p]));
  let selected = cards;
  if (mode === 'due') {
    selected = cards.filter((c) => isDue(progressById.get(String(c._id)), now));
    // Overdue reviewed cards first (oldest due first), then brand-new cards in deck order.
    selected.sort((a, b) => {
      const pa = progressById.get(String(a._id));
      const pb = progressById.get(String(b._id));
      if (!!pa?.lastReviewedAt !== !!pb?.lastReviewedAt) return pa?.lastReviewedAt ? -1 : 1;
      return new Date(pa?.nextReviewAt || 0) - new Date(pb?.nextReviewAt || 0);
    });
    if (selected.length === 0) throw new HttpError(409, 'No cards are due for review right now');
  } else if (mode === 'difficult') {
    selected = cards.filter((c) => isDifficult(progressById.get(String(c._id))));
    if (selected.length === 0) throw new HttpError(409, 'You have no difficult cards right now');
  }
  const order = (shuffle ? shuffled(selected) : selected).map((c) => c._id);
  const session = await FlashcardSession.create({ user: userId, deck: deck._id, mode, cardOrder: order, totalCards: order.length, startedAt: now });
  return { resumed: false, session: await serializeSession(session, now) };
};

const findOwnedSession = async (userId, sessionId) => {
  const session = await FlashcardSession.findOne({ _id: sessionId, user: userId });
  if (!session) throw new HttpError(404, 'Study session not found');
  return session;
};

const shuffleSession = async (userId, sessionId) => {
  const session = await findOwnedSession(userId, sessionId);
  if (session.status !== 'active') throw new HttpError(409, 'This study session has ended');
  session.cardOrder = shuffled(session.cardOrder);
  await session.save();
  return serializeSession(session);
};

const recordAnswer = async (userId, sessionId, cardId, outcome, { now = new Date() } = {}) => {
  if (!OUTCOMES.includes(outcome)) throw new HttpError(400, 'Outcome must be "known" or "review"');
  if (!mongoose.Types.ObjectId.isValid(cardId)) throw new HttpError(400, 'Invalid cardId');
  const session = await findOwnedSession(userId, sessionId);
  if (session.status !== 'active') throw new HttpError(409, 'This study session has ended');
  if (!session.cardOrder.some((id) => String(id) === String(cardId))) throw new HttpError(400, 'Card is not part of this session');
  const card = await Flashcard.findOne({ _id: cardId, deck: session.deck, user: userId }).lean();
  if (!card) throw new HttpError(404, 'This card no longer exists');

  const existing = session.answers.find((a) => String(a.card) === String(cardId));
  const respond = (answers, progressDoc) => ({
    recorded: true,
    cardId: String(cardId),
    outcome,
    ...answerCounts(answers),
    progress: serializeProgress(progressDoc, now),
  });

  if (existing && existing.outcome === outcome) {
    const progressDoc = await FlashcardProgress.findOne({ user: userId, card: cardId }).lean();
    return respond(session.answers, progressDoc);
  }

  const progressDoc = await FlashcardProgress.findOne({ user: userId, card: cardId }).lean();
  // First answer: schedule from the card's current state. Changed answer: undo this session's
  // earlier scheduling (restore the state captured before it) and apply the new outcome instead.
  const baseState = existing ? toState(existing.prev) : toState(progressDoc);
  const next = applyOutcome(baseState, outcome, now);

  let updatedSession;
  if (existing) {
    // Idempotent by construction: `next` is derived from the stored pre-answer state, so two
    // identical requests write the same result. The whole (small) answers array is replaced with
    // a compare-and-swap on answerRev so a concurrent write is never silently overwritten.
    const swapped = session.answers.map((a) =>
      String(a.card) === String(cardId)
        ? { card: a.card, outcome, at: now, prev: a.prev }
        : { card: a.card, outcome: a.outcome, at: a.at, prev: a.prev }
    );
    updatedSession = await FlashcardSession.findOneAndUpdate(
      { _id: session._id, status: 'active', answerRev: session.answerRev || 0 },
      { $set: { answers: swapped }, $inc: { answerRev: 1 } },
      { new: true }
    );
  } else {
    // Atomic claim of the card's slot: only one concurrent request can push the first answer.
    updatedSession = await FlashcardSession.findOneAndUpdate(
      { _id: session._id, status: 'active', 'answers.card': { $ne: cardId } },
      { $push: { answers: { card: cardId, outcome, at: now, prev: baseState } }, $inc: { answerRev: 1 } },
      { new: true }
    );
  }
  if (!updatedSession) {
    // A concurrent identical/competing request already claimed this answer: do not apply twice.
    const fresh = await FlashcardSession.findById(session._id);
    if (!fresh || fresh.status !== 'active') throw new HttpError(409, 'This study session has ended');
    return respond(fresh.answers, progressDoc);
  }

  const saved = await FlashcardProgress.findOneAndUpdate(
    { user: userId, card: cardId },
    { $set: { ...next, deck: session.deck }, $setOnInsert: { user: userId, card: cardId } },
    { new: true, upsert: true }
  ).lean();
  return respond(updatedSession.answers, saved);
};

const buildSummary = async (session, deckStatsMap) => {
  const answerIds = session.answers.map((a) => a.card);
  const cards = await Flashcard.find({ _id: { $in: answerIds }, user: session.user }).select('front').lean();
  const frontById = new Map(cards.map((c) => [String(c._id), c.front]));
  const live = session.answers.filter((a) => frontById.has(String(a.card)));
  const { reviewed, known, needReview } = answerCounts(live);
  return {
    sessionId: String(session._id),
    deckId: String(session.deck),
    mode: session.mode,
    status: session.status,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    totalCards: session.totalCards,
    reviewed,
    known,
    needReview,
    accuracy: reviewed ? Math.round((known / reviewed) * 100) : null,
    unreviewed: Math.max(0, session.totalCards - reviewed),
    missedCards: live.filter((a) => a.outcome === 'review').slice(0, 50).map((a) => ({ id: String(a.card), front: frontById.get(String(a.card)) })),
    deckStats: statsFor(deckStatsMap, session.deck),
  };
};

/** Returns { summary, awardXp } - XP is awarded by the controller, once, for fresh completions. */
const completeSession = async (userId, sessionId, { now = new Date() } = {}) => {
  const session = await findOwnedSession(userId, sessionId);
  if (session.status !== 'active') {
    const statsMap = await computeDeckStats(userId, [session.deck], now);
    return { summary: await buildSummary(session, statsMap), awardXp: false };
  }
  const reviewedAny = session.answers.length > 0;
  const closed = await finalizeSession(session, reviewedAny ? 'completed' : 'abandoned', now);
  const finished = closed || (await FlashcardSession.findById(session._id));
  if (closed && reviewedAny) await FlashcardDeck.updateOne({ _id: session.deck, user: userId }, { $set: { lastStudiedAt: now } });
  const statsMap = await computeDeckStats(userId, [session.deck], now);
  const summary = await buildSummary(finished, statsMap);
  // XP only for a real attempt: at least min(3, deck size) cards answered in this session.
  const awardXp = Boolean(closed) && summary.reviewed >= Math.min(3, Math.max(1, summary.totalCards));
  return { summary, awardXp };
};

const getHistory = async (userId, deckId, limit = 10) => {
  const deck = await findOwnedDeck(userId, deckId);
  const rows = await FlashcardSession.find({
    user: userId,
    deck: deck._id,
    status: { $in: ['completed', 'abandoned'] },
    reviewedCount: { $gt: 0 },
  })
    .sort({ completedAt: -1 })
    .limit(Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50))
    .lean();
  return rows.map((s) => ({
    id: String(s._id),
    mode: s.mode,
    status: s.status,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    totalCards: s.totalCards,
    reviewed: s.reviewedCount,
    known: s.knownCount,
    needReview: s.reviewAgainCount,
  }));
};

module.exports = {
  listDecks,
  getSummary,
  createDeck,
  updateDeck,
  deleteDeck,
  getDeckDetail,
  addCard,
  updateCard,
  deleteCard,
  reorderCards,
  startSession,
  shuffleSession,
  recordAnswer,
  completeSession,
  getHistory,
  computeDeckStats,
  emptyState,
};
