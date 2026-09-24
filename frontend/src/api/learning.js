import api from './client';

// Thin wrappers over the learning-content recommendation endpoints
// (backend: /api/recommendations/*). Each returns response.data.
const unwrap = (promise) => promise.then((res) => res.data);

export const getLearningBundle = (params) => unwrap(api.get('/recommendations/learning', { params }));
export const getDailyPlan = (params) => unwrap(api.get('/recommendations/daily-plan', { params }));
export const getLearnNext = () => unwrap(api.get('/recommendations/learn-next'));
export const getRecommendation = (id) => unwrap(api.get(`/recommendations/${id}`));
export const startRecommendation = (id) => unwrap(api.post(`/recommendations/${id}/start`));
export const reportProgress = (id, body) => unwrap(api.post(`/recommendations/${id}/progress`, body));
export const completeRecommendation = (id, body = {}) => unwrap(api.post(`/recommendations/${id}/complete`, body));
export const skipRecommendation = (id) => unwrap(api.post(`/recommendations/${id}/skip`));
export const sendFeedback = (id, body) => unwrap(api.post(`/recommendations/${id}/feedback`, body));
export const getPracticeSet = (id, count = 5) => unwrap(api.get(`/recommendations/${id}/practice`, { params: { count } }));