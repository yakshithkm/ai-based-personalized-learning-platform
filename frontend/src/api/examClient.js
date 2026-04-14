import api from './client';

const RETRY_DELAY_MS = 1200;

const examSessionState = {
  sessionId: '',
  sessionToken: '',
  requestNonce: '',
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const setExamSessionAuth = ({ sessionId, sessionToken, requestNonce }) => {
  if (sessionId) examSessionState.sessionId = sessionId;
  if (sessionToken) examSessionState.sessionToken = sessionToken;
  if (requestNonce) examSessionState.requestNonce = requestNonce;
};

const clearExamSessionAuth = () => {
  examSessionState.sessionId = '';
  examSessionState.sessionToken = '';
  examSessionState.requestNonce = '';
};

const attachExamAuthHeaders = (config = {}) => {
  const headers = { ...(config.headers || {}) };
  if (examSessionState.sessionToken) {
    headers['x-exam-session-token'] = examSessionState.sessionToken;
  }
  if (examSessionState.requestNonce) {
    headers['x-exam-request-nonce'] = examSessionState.requestNonce;
  }
  return {
    ...config,
    headers,
  };
};

api.interceptors.response.use((response) => {
  const nextNonce = response?.data?.requestNonce;
  const nextToken = response?.data?.sessionToken;

  if (nextNonce) {
    examSessionState.requestNonce = nextNonce;
  }
  if (nextToken) {
    examSessionState.sessionToken = nextToken;
  }

  return response;
});

const refreshExamSession = async (sessionId) => {
  const { data } = await api.get(`/exams/sessions/${sessionId}`);
  if (data?.sessionToken) {
    examSessionState.sessionToken = data.sessionToken;
  }
  if (data?.requestNonce) {
    examSessionState.requestNonce = data.requestNonce;
  }
  return data;
};

const submitExamAnswer = async ({
  sessionId,
  payload,
  allowRateRetry = true,
  allowConflictRetry = true,
}) => {
  const requestConfig = attachExamAuthHeaders({});

  try {
    const response = await api.patch(`/exams/sessions/${sessionId}/answer`, payload, requestConfig);
    if (response?.data?.requestNonce) {
      examSessionState.requestNonce = response.data.requestNonce;
    }
    if (response?.data?.sessionToken) {
      examSessionState.sessionToken = response.data.sessionToken;
    }
    return response;
  } catch (error) {
    const status = Number(error?.response?.status || 0);
    if (status === 409 && allowConflictRetry) {
      const refreshed = await refreshExamSession(sessionId);
      const retryResponse = await api.patch(
        `/exams/sessions/${sessionId}/answer`,
        payload,
        attachExamAuthHeaders({})
      );
      if (retryResponse?.data?.requestNonce) {
        examSessionState.requestNonce = retryResponse.data.requestNonce;
      }
      if (retryResponse?.data?.sessionToken) {
        examSessionState.sessionToken = retryResponse.data.sessionToken;
      }
      return retryResponse;
    }

    if (status === 429 && allowRateRetry) {
      await delay(RETRY_DELAY_MS);
      return submitExamAnswer({
        sessionId,
        payload,
        allowRateRetry: false,
        allowConflictRetry,
      });
    }

    throw error;
  }
};

const submitExamSession = async ({ sessionId }) => api.post(`/exams/sessions/${sessionId}/submit`);

const getExamSession = async (sessionId) => refreshExamSession(sessionId);

export {
  clearExamSessionAuth,
  getExamSession,
  setExamSessionAuth,
  submitExamAnswer,
  submitExamSession,
  examSessionState,
};
