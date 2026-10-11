import axios from 'axios';
import i18n from '../i18n';
import { isTierError, emitTierBlocked, emitUsageChanged, consumesQuota } from '../utils/tierErrors';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['Accept-Language'] = i18n.language || 'en';
  return config;
});

// Any request the backend refuses for tier reasons (403 upgrade / expired, 429 quota) is announced
// once, app-wide, so the shell can show a proper upgrade prompt instead of each page improvising.
// The rejection itself is untouched - pages keep their existing error handling.
api.interceptors.response.use(
  (response) => {
    if (consumesQuota(response.config?.method, response.config?.url)) emitUsageChanged();
    return response;
  },
  (error) => {
    const data = error?.response?.data;
    if (isTierError(data)) emitTierBlocked(data);
    return Promise.reject(error);
  }
);

export default api;
