import api from './client';

// Focus-violation reporting for the Exam Simulation.
//
// Deliberately separate from `examClient.js`: reporting a violation must never touch the
// answer-request machinery there (session token / nonce rotation, request versioning,
// abort-on-newer-request). It is a plain authenticated POST, and its response carries no
// `version`, `sessionToken` or `requestNonce`, so it cannot disturb that state.
//
// Only focus/tab/window/route-leave violations are ever sent. Camera problems are a
// client-side warning and are never reported or counted. No webcam data is ever uploaded.

const buildViolationEventId = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

// `eventId` is an idempotency key: retrying the same event can never be counted twice.
const reportExamViolation = async ({ sessionId, eventId, type }) => {
  const { data } = await api.post(`/exams/sessions/${sessionId}/violations`, { eventId, type });
  return data;
};

export { buildViolationEventId, reportExamViolation };