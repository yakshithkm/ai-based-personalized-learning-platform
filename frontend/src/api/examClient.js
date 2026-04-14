import api from './client';

const RETRY_DELAY_MS = 1200;
const requestState = {
  sessionId: '',
  sessionToken: '',
  requestNonce: '',
  requestId: 0,
  latestRequestId: 0,
  activeController: null,
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isAbortError = (error) =>
  error?.name === 'CanceledError' ||
  error?.code === 'ERR_CANCELED' ||
  error?.message === 'canceled';

const isLatestRequest = (requestId) => requestId === requestState.latestRequestId;

const beginRequest = () => {
  const requestId = requestState.requestId + 1;
  requestState.requestId = requestId;
  requestState.latestRequestId = requestId;

  if (requestState.activeController) {
    console.log('[exam-client] aborting-previous-request', {
      latestRequestId: requestState.latestRequestId,
    });
    requestState.activeController.abort();
  }

  requestState.activeController = new AbortController();
  return {
    requestId,
    signal: requestState.activeController.signal,
  };
};

const setExamSessionAuth = ({ sessionId, sessionToken, requestNonce }) => {
  if (sessionId && sessionId !== requestState.sessionId) {
    if (requestState.activeController) {
      requestState.activeController.abort();
      requestState.activeController = null;
    }
    requestState.requestId = 0;
    requestState.latestRequestId = 0;
  }

  if (sessionId) requestState.sessionId = sessionId;
  if (sessionToken) requestState.sessionToken = sessionToken;
  if (requestNonce) requestState.requestNonce = requestNonce;
};

const clearExamSessionAuth = () => {
  if (requestState.activeController) {
    requestState.activeController.abort();
    requestState.activeController = null;
  }
  requestState.sessionId = '';
  requestState.sessionToken = '';
  requestState.requestNonce = '';
  requestState.requestId = 0;
  requestState.latestRequestId = 0;
};

const attachExamAuthHeaders = (config = {}) => {
  const headers = { ...(config.headers || {}) };
  if (requestState.sessionToken) {
    headers['x-exam-session-token'] = requestState.sessionToken;
  }
  if (requestState.requestNonce) {
    headers['x-exam-request-nonce'] = requestState.requestNonce;
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
    requestState.requestNonce = nextNonce;
  }
  if (nextToken) {
    requestState.sessionToken = nextToken;
  }

  return response;
});

const refreshExamSession = async (sessionId) => {
  const { data } = await api.get(`/exams/sessions/${sessionId}`);
  if (data?.sessionToken) {
    requestState.sessionToken = data.sessionToken;
  }
  if (data?.requestNonce) {
    requestState.requestNonce = data.requestNonce;
  }
  return data;
};

const submitExamAnswer = async ({
  sessionId,
  payload,
  allowRateRetry = true,
  allowConflictRetry = true,
}) => {
  const { requestId, signal } = beginRequest();
  const requestConfig = attachExamAuthHeaders({ signal });
  console.log('[exam-client] request-start', {
    requestId,
    latestRequestId: requestState.latestRequestId,
  });

  try {
    const response = await api.patch(`/exams/sessions/${sessionId}/answer`, payload, requestConfig);
    if (!isLatestRequest(requestId)) {
      console.log('[exam-client] ignored-stale-response', { requestId, latestRequestId: requestState.latestRequestId });
      return { aborted: true, requestId, stale: true };
    }
    if (response?.data?.requestNonce) {
      requestState.requestNonce = response.data.requestNonce;
    }
    if (response?.data?.sessionToken) {
      requestState.sessionToken = response.data.sessionToken;
    }
    requestState.activeController = null;
    return response;
  } catch (error) {
    if (isAbortError(error)) {
      console.log('[exam-client] request-aborted', { requestId });
      if (isLatestRequest(requestId)) {
        requestState.activeController = null;
      }
      return { aborted: true, requestId, cancelled: true };
    }

    const status = Number(error?.response?.status || 0);
    if (status === 409 && allowConflictRetry) {
      const refreshed = await refreshExamSession(sessionId);
      if (!isLatestRequest(requestId)) {
        console.log('[exam-client] ignored-stale-response', { requestId, latestRequestId: requestState.latestRequestId });
        return { aborted: true, requestId, stale: true };
      }
      const retryResponse = await api.patch(
        `/exams/sessions/${sessionId}/answer`,
        payload,
        attachExamAuthHeaders({ signal })
      );
      if (!isLatestRequest(requestId)) {
        console.log('[exam-client] ignored-stale-response', { requestId, latestRequestId: requestState.latestRequestId });
        return { aborted: true, requestId, stale: true };
      }
      if (retryResponse?.data?.requestNonce) {
        requestState.requestNonce = retryResponse.data.requestNonce;
      }
      if (retryResponse?.data?.sessionToken) {
        requestState.sessionToken = retryResponse.data.sessionToken;
      }
      requestState.activeController = null;
      return retryResponse;
    }

    if (status === 429 && allowRateRetry) {
      console.log('[exam-client] rate-limit-retry-scheduled', { requestId });
      await delay(RETRY_DELAY_MS);
      if (!isLatestRequest(requestId)) {
        console.log('[exam-client] ignored-stale-response', { requestId, latestRequestId: requestState.latestRequestId });
        return { aborted: true, requestId, stale: true };
      }
      return submitExamAnswer({
        sessionId,
        payload,
        allowRateRetry: false,
        allowConflictRetry,
      });
    }

    if (isLatestRequest(requestId)) {
      requestState.activeController = null;
    }
    throw error;
  }
};

const submitExamSession = async ({ sessionId }) => {
  const { requestId, signal } = beginRequest();
  console.log('[exam-client] submit-start', { requestId, latestRequestId: requestState.latestRequestId });
  try {
    const response = await api.post(`/exams/sessions/${sessionId}/submit`, undefined, attachExamAuthHeaders({ signal }));
    if (!isLatestRequest(requestId)) {
      console.log('[exam-client] ignored-stale-response', { requestId, latestRequestId: requestState.latestRequestId });
      return { aborted: true, requestId, stale: true };
    }
    requestState.activeController = null;
    return response;
  } catch (error) {
    if (isAbortError(error)) {
      console.log('[exam-client] request-aborted', { requestId });
      return { aborted: true, requestId, cancelled: true };
    }
    if (isLatestRequest(requestId)) {
      requestState.activeController = null;
    }
    throw error;
  }
};

const getExamSession = async (sessionId) => refreshExamSession(sessionId);

export {
  clearExamSessionAuth,
  getExamSession,
  setExamSessionAuth,
  submitExamAnswer,
  submitExamSession,
};
