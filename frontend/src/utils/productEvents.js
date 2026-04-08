import api from '../api/client';

export const trackProductEvent = async (eventType, metadata = {}) => {
  try {
    await api.post('/analytics/events', { eventType, metadata });
  } catch (error) {
    // Keep product tracking non-blocking for user flows.
  }
};
