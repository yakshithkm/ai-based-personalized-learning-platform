const mongoose = require('mongoose');
const LearningContent = require('../models/LearningContent');
const svc = require('../services/flashcards/flashcardService');
const {
  validateCard,
  validateCardList,
  validateDeckInput,
  validateDeckPatch,
  validateGenerateInput,
} = require('../services/flashcards/validation');
const { generateFlashcards } = require('../services/ai/flashcardGenerator');
const { processEvent: processGamificationEvent } = require('../services/gamification/gamificationService');
const { resolveRequestLanguage } = require('../config/languages');
const { TIER_ERROR_CODES, TIER_ORDER } = require('../config/tiers');
const { tierRank } = require('../services/tier/tierService');
const { getTierContext } = require('../middleware/tierMiddleware');
const { HttpError } = require('../services/learning/errors');
const { LIMITS } = require('../config/flashcards');

const TIER_LABEL = { FREE: 'Free', PRO: 'Pro', PREMIUM: 'Premium' };

// Services signal client errors with HttpError(statusCode); AI errors carry statusCode too. A
// plan-limit error is answered in the app-wide tier-error shape so the existing upgrade dialog
// opens (see utils/tierErrors on the frontend).
const fail = (req, res, next, error) => {
  if (error && error.tierLimit) {
    const ctx = getTierContext(req);
    const upgrade = TIER_ORDER[tierRank(ctx.tier) + 1] || null;
    return res.status(403).json({
      success: false,
      code: TIER_ERROR_CODES.USAGE_LIMIT_REACHED,
      feature: 'FLASHCARDS',
      usageKey: error.tierLimit.usageKey,
      currentTier: ctx.tier,
      requiredTier: error.tierLimit.unlimited ? null : upgrade,
      limit: error.tierLimit.limit,
      used: error.tierLimit.used,
      fairUse: Boolean(error.tierLimit.unlimited),
      message: error.message,
    });
  }
  if (error && error.statusCode) res.status(error.statusCode);
  return next(error);
};

const wrap = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    fail(req, res, next, error);
  }
};

const requireObjectId = (value, label) => {
  if (!mongoose.Types.ObjectId.isValid(value)) throw new HttpError(400, `Invalid ${label}`);
};

/* ------------------------------------------------------------------ decks */

const listDecks = wrap(async (req, res) => {
  const { search, topic, sort, page, limit } = req.query;
  res.json(await svc.listDecks(req.user._id, {
    search: typeof search === 'string' ? search : '',
    topic: typeof topic === 'string' ? topic : '',
    sort: typeof sort === 'string' ? sort : 'recent',
    page,
    limit,
  }));
});

const getSummary = wrap(async (req, res) => {
  res.json(await svc.getSummary(req.user._id));
});

const createDeck = wrap(async (req, res) => {
  const meta = validateDeckInput(req.body);
  const cards = validateCardList(req.body?.cards);
  let sourceContent = null;
  if (meta.source === 'lesson' && mongoose.Types.ObjectId.isValid(req.body?.learningContentId)) {
    sourceContent = req.body.learningContentId;
  }
  const deck = await svc.createDeck(req.user._id, getTierContext(req).tier, meta, cards, {
    sourceContent,
    language: resolveRequestLanguage(req),
  });
  res.status(201).json({ deck });
});

const getDeck = wrap(async (req, res) => {
  res.json(await svc.getDeckDetail(req.user._id, req.params.deckId));
});

const updateDeck = wrap(async (req, res) => {
  res.json({ deck: await svc.updateDeck(req.user._id, req.params.deckId, validateDeckPatch(req.body)) });
});

const deleteDeck = wrap(async (req, res) => {
  await svc.deleteDeck(req.user._id, req.params.deckId);
  res.json({ deleted: true });
});

const getHistory = wrap(async (req, res) => {
  res.json({ sessions: await svc.getHistory(req.user._id, req.params.deckId, req.query.limit) });
});

/* ------------------------------------------------------------------ cards */

const addCard = wrap(async (req, res) => {
  res.status(201).json({ card: await svc.addCard(req.user._id, req.params.deckId, validateCard(req.body)) });
});

const updateCard = wrap(async (req, res) => {
  res.json({ card: await svc.updateCard(req.user._id, req.params.deckId, req.params.cardId, validateCard(req.body)) });
});

const deleteCard = wrap(async (req, res) => {
  await svc.deleteCard(req.user._id, req.params.deckId, req.params.cardId);
  res.json({ deleted: true });
});

const reorderCards = wrap(async (req, res) => {
  await svc.reorderCards(req.user._id, req.params.deckId, req.body?.cardIds);
  res.json({ reordered: true });
});

/* ------------------------------------------------------------------ AI generation */

// Builds trusted source text from a TutorMind lesson the caller is allowed to open.
const loadLessonMaterial = async (req, learningContentId) => {
  requireObjectId(learningContentId, 'learningContentId');
  const content = await LearningContent.findOne({ _id: learningContentId, isActive: true }).lean();
  if (!content) throw new HttpError(404, 'Learning content not found');

  const required = TIER_ORDER.includes(content.accessTier) ? content.accessTier : 'FREE';
  const ctx = getTierContext(req);
  if (tierRank(ctx.tier) < tierRank(required)) {
    const lapsed = ctx.expired && tierRank(ctx.storedTier) >= tierRank(required);
    const error = new HttpError(403, `This learning content requires a ${TIER_LABEL[required]} subscription.`);
    error.tierBlock = {
      code: lapsed ? TIER_ERROR_CODES.SUBSCRIPTION_EXPIRED : TIER_ERROR_CODES.TIER_UPGRADE_REQUIRED,
      feature: 'PREMIUM_CONTENT',
      requiredTier: required,
      currentTier: ctx.tier,
    };
    throw error;
  }

  const parts = [
    content.title,
    content.description,
    content.learningObjectives?.length ? `Learning objectives:\n${content.learningObjectives.map((o) => `- ${o}`).join('\n')}` : '',
    content.body,
  ].filter(Boolean);
  const material = parts.join('\n\n').slice(0, LIMITS.SOURCE_TEXT);
  // A video/link-only item has nothing readable to build from; say so instead of inventing cards.
  if ((content.body || '').trim().length < 80) {
    throw new HttpError(422, 'This lesson has no readable text to build flashcards from. Enter a topic or paste your own notes instead.');
  }
  return { material, title: content.title, topic: content.topic };
};

const generate = async (req, res, next) => {
  try {
    const input = validateGenerateInput(req.body);
    let { topic, sourceText } = input;
    let source = sourceText ? 'text' : 'topic';
    let lesson = null;

    if (input.learningContentId) {
      try {
        const loaded = await loadLessonMaterial(req, input.learningContentId);
        sourceText = loaded.material;
        topic = topic || loaded.topic || loaded.title;
        source = 'lesson';
        lesson = { id: input.learningContentId, title: loaded.title };
      } catch (error) {
        if (error.tierBlock) return res.status(403).json({ success: false, message: error.message, ...error.tierBlock });
        throw error;
      }
    }

    // A client that hangs up mid-generation stops the upstream call.
    const abort = new AbortController();
    res.on('close', () => { if (!res.writableEnded) abort.abort(); });

    const { cards, dropped } = await generateFlashcards({
      topic,
      sourceText,
      count: input.count,
      difficulty: input.difficulty,
      cardStyle: input.cardStyle,
      avoidFronts: input.avoidFronts,
      language: resolveRequestLanguage(req),
      signal: abort.signal,
    });

    return res.json({
      cards,
      meta: {
        requested: input.count,
        returned: cards.length,
        dropped,
        source,
        topic,
        difficulty: input.difficulty,
        cardStyle: input.cardStyle,
        learningContent: lesson,
      },
    });
  } catch (error) {
    return fail(req, res, next, error);
  }
};

/* ------------------------------------------------------------------ sessions */

const startSession = wrap(async (req, res) => {
  const { mode, shuffle, restart } = req.body || {};
  const result = await svc.startSession(req.user._id, req.params.deckId, {
    mode: typeof mode === 'string' ? mode : 'all',
    shuffle: shuffle === true,
    restart: restart === true,
  });
  res.status(result.resumed ? 200 : 201).json(result);
});

const shuffleSession = wrap(async (req, res) => {
  res.json({ session: await svc.shuffleSession(req.user._id, req.params.sessionId) });
});

const recordAnswer = wrap(async (req, res) => {
  const { cardId, outcome } = req.body || {};
  res.json(await svc.recordAnswer(req.user._id, req.params.sessionId, cardId, outcome));
});

const completeSession = wrap(async (req, res) => {
  const { summary, awardXp } = await svc.completeSession(req.user._id, req.params.sessionId);
  let gamification = null;
  if (awardXp) {
    try {
      gamification = await processGamificationEvent({
        userId: req.user._id,
        eventType: 'FLASHCARD_SESSION_COMPLETED',
        sourceId: summary.sessionId,
        metadata: { cardsReviewed: summary.reviewed, deckId: summary.deckId },
      });
    } catch (gamificationError) {
      gamification = null; // XP is a bonus; never fail the session over it
    }
  }
  res.json({ summary, gamification });
});

module.exports = {
  listDecks, getSummary, createDeck, getDeck, updateDeck, deleteDeck, getHistory,
  addCard, updateCard, deleteCard, reorderCards,
  generate,
  startSession, shuffleSession, recordAnswer, completeSession,
};
