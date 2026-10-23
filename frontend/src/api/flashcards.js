import api from './client';

// Thin wrappers over /api/flashcards. Every call is authenticated by the shared axios client; the
// server decides ownership - nothing here sends a user id.
const data = (promise) => promise.then((response) => response.data);

export const listDecks = (params) => data(api.get('/flashcards/decks', { params }));
export const getSummary = () => data(api.get('/flashcards/summary'));
export const getDeck = (deckId) => data(api.get(`/flashcards/decks/${deckId}`));
export const createDeck = (payload) => data(api.post('/flashcards/decks', payload));
export const updateDeck = (deckId, payload) => data(api.patch(`/flashcards/decks/${deckId}`, payload));
export const deleteDeck = (deckId) => data(api.delete(`/flashcards/decks/${deckId}`));
export const getHistory = (deckId, limit = 8) => data(api.get(`/flashcards/decks/${deckId}/history`, { params: { limit } }));

export const addCard = (deckId, card) => data(api.post(`/flashcards/decks/${deckId}/cards`, card));
export const updateCard = (deckId, cardId, card) => data(api.patch(`/flashcards/decks/${deckId}/cards/${cardId}`, card));
export const deleteCard = (deckId, cardId) => data(api.delete(`/flashcards/decks/${deckId}/cards/${cardId}`));
export const reorderCards = (deckId, cardIds) => data(api.put(`/flashcards/decks/${deckId}/cards/order`, { cardIds }));

export const generateCards = (payload, options = {}) => data(api.post('/flashcards/generate', payload, options));

export const startSession = (deckId, payload) => data(api.post(`/flashcards/decks/${deckId}/sessions`, payload));
export const shuffleSession = (sessionId) => data(api.post(`/flashcards/sessions/${sessionId}/shuffle`));
export const recordAnswer = (sessionId, cardId, outcome) => data(api.post(`/flashcards/sessions/${sessionId}/answers`, { cardId, outcome }));
export const completeSession = (sessionId) => data(api.post(`/flashcards/sessions/${sessionId}/complete`));
