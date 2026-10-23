const express = require('express');
const c = require('../controllers/flashcardController');
const { protect } = require('../middleware/authMiddleware');
const { requireFeature, checkUsageLimit } = require('../middleware/tierMiddleware');
const { validateObjectIdParam } = require('../middleware/validateObjectIdParam');
const { FEATURES } = require('../config/tiers');

const router = express.Router();

// Every route: authenticated + the Flashcards feature. Ownership is enforced per query in the
// service layer ({ _id, user: req.user._id }) - a client-supplied user id is never read.
router.use(protect, requireFeature(FEATURES.FLASHCARDS));

router.get('/summary', c.getSummary);

// AI generation spends the shared daily AI quota (refunded automatically when it fails).
router.post('/generate', checkUsageLimit('AI'), c.generate);

router.get('/decks', c.listDecks);
router.post('/decks', c.createDeck);
router.get('/decks/:deckId', validateObjectIdParam('deckId'), c.getDeck);
router.patch('/decks/:deckId', validateObjectIdParam('deckId'), c.updateDeck);
router.delete('/decks/:deckId', validateObjectIdParam('deckId'), c.deleteDeck);
router.get('/decks/:deckId/history', validateObjectIdParam('deckId'), c.getHistory);

router.post('/decks/:deckId/cards', validateObjectIdParam('deckId'), c.addCard);
router.put('/decks/:deckId/cards/order', validateObjectIdParam('deckId'), c.reorderCards);
router.patch('/decks/:deckId/cards/:cardId', validateObjectIdParam('deckId'), validateObjectIdParam('cardId'), c.updateCard);
router.delete('/decks/:deckId/cards/:cardId', validateObjectIdParam('deckId'), validateObjectIdParam('cardId'), c.deleteCard);

router.post('/decks/:deckId/sessions', validateObjectIdParam('deckId'), c.startSession);
router.post('/sessions/:sessionId/shuffle', validateObjectIdParam('sessionId'), c.shuffleSession);
router.post('/sessions/:sessionId/answers', validateObjectIdParam('sessionId'), c.recordAnswer);
router.post('/sessions/:sessionId/complete', validateObjectIdParam('sessionId'), c.completeSession);

module.exports = router;
