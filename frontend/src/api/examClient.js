import api from './client';

const RETRY_DELAY_MS = 1200;
const requestState = {
  sessionId: '',
  sessionToken: '',
  requestNonce: '',
  latestVersion: 0,
  requestId: 0,
  latestRequestId: 0,
  activeController: null,
};
const ENABLE_DEV_LATENCY = String(import.meta.env.VITE_EXAM_CLIENT_DELAY_SIM || 'false').toLowerCase() === 'true';
const ENABLE_DEBUG_LOGS = Boolean(import.meta.env.DEV);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomDelay = () => 100 + Math.floor(Math.random() * 1900);

const isAbortError = (error) =>
  error?.name === 'CanceledError' ||
  error?.code === 'ERR_CANCELED' ||
  error?.message === 'canceled';

const isLatestRequest = (requestId) => requestId === requestState.latestRequestId;

const parseVersion = (value) => {
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : null;
};

const versionIsOutdated = (incomingVersion) =>
  incomingVersion !== null && incomingVersion < Number(requestState.latestVersion || 0);

const applyVersionIfNew = (incomingVersion) => {
  if (incomingVersion === null) return;
  requestState.latestVersion = Math.max(Number(requestState.latestVersion || 0), incomingVersion);
};

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

const setLatestVersion = (version) => {
  const parsed = parseVersion(version);
  if (parsed === null) return;
  applyVersionIfNew(parsed);
};

const clearExamSessionAuth = () => {
  if (requestState.activeController) {
    requestState.activeController.abort();
    requestState.activeController = null;
  }
  requestState.sessionId = '';
  requestState.sessionToken = '';
  requestState.requestNonce = '';
  requestState.latestVersion = 0;
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

  const incomingVersion = parseVersion(response?.data?.version);
  if (incomingVersion !== null) {
    applyVersionIfNew(incomingVersion);
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
  const incomingVersion = parseVersion(data?.version);
  applyVersionIfNew(incomingVersion);
  return data;
};

const submitExamAnswer = async ({
  sessionId,
  payload,
  allowRateRetry = true,
  allowConflictRetry = true,
  didRetry = false,
  externalSignal = null,
}) => {
  const { requestId, signal: internalSignal } = beginRequest();
  const signal = externalSignal || internalSignal;
  const requestConfig = attachExamAuthHeaders({ signal });
  console.log('[exam-client] request-start', {
    requestId,
    latestRequestId: requestState.latestRequestId,
  });

  try {
    const response = await api.patch(`/exams/sessions/${sessionId}/answer`, payload, requestConfig);
    if (!isLatestRequest(requestId)) {
      console.log('[exam-client] ignored-stale-response', { requestId, latestRequestId: requestState.latestRequestId });
      if (ENABLE_DEBUG_LOGS) {
        console.log({
          intentId: payload?.intentId || null,
          version: parseVersion(response?.data?.version),
          ignored: true,
          retryUsed: didRetry,
          reconciled: false,
        });
      }
      return { aborted: true, requestId, stale: true };
    }
    const incomingVersion = parseVersion(response?.data?.version);
    if (versionIsOutdated(incomingVersion)) {
      console.log('[exam-client] ignored-outdated-response-version', {
        requestId,
        latestVersion: requestState.latestVersion,
        incomingVersion,
      });
      if (ENABLE_DEBUG_LOGS) {
        console.log({
          intentId: payload?.intentId || null,
          version: incomingVersion,
          ignored: true,
          retryUsed: didRetry,
          reconciled: false,
        });
      }
      return {
        aborted: true,
        staleVersion: true,
        requestId,
        responseVersion: incomingVersion,
      };
    }
    if (response?.data?.requestNonce) {
      requestState.requestNonce = response.data.requestNonce;
    }
    if (response?.data?.sessionToken) {
      requestState.sessionToken = response.data.sessionToken;
    }
    applyVersionIfNew(incomingVersion);
    if (ENABLE_DEV_LATENCY) {
      await delay(randomDelay());
    }
    response.__examMeta = {
      didRetry,
      refetched: false,
      version: incomingVersion,
    };
    if (ENABLE_DEBUG_LOGS) {
      console.log({
        intentId: payload?.intentId || response?.data?.intentId || null,
        version: incomingVersion,
        ignored: false,
        retryUsed: didRetry,
        reconciled: false,
      });
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
      await refreshExamSession(sessionId);
      if (!isLatestRequest(requestId)) {
        console.log('[exam-client] ignored-stale-response', { requestId, latestRequestId: requestState.latestRequestId });
        if (ENABLE_DEBUG_LOGS) {
          console.log({
            intentId: payload?.intentId || null,
            version: null,
            ignored: true,
            retryUsed: true,
            reconciled: false,
          });
        }
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
      const retryVersion = parseVersion(retryResponse?.data?.version);
      if (versionIsOutdated(retryVersion)) {
        console.log('[exam-client] ignored-outdated-response-version', {
          requestId,
          latestVersion: requestState.latestVersion,
          incomingVersion: retryVersion,
        });
        if (ENABLE_DEBUG_LOGS) {
          console.log({
            intentId: payload?.intentId || null,
            version: retryVersion,
            ignored: true,
            retryUsed: true,
            reconciled: false,
          });
        }
        return {
          aborted: true,
          staleVersion: true,
          requestId,
          responseVersion: retryVersion,
        };
      }
      applyVersionIfNew(retryVersion);
      if (ENABLE_DEV_LATENCY) {
        await delay(randomDelay());
      }
      retryResponse.__examMeta = {
        didRetry: true,
        refetched: true,
        retryReason: 409,
        version: retryVersion,
      };
      if (ENABLE_DEBUG_LOGS) {
        console.log({
          intentId: payload?.intentId || retryResponse?.data?.intentId || null,
          version: retryVersion,
          ignored: false,
          retryUsed: true,
          reconciled: false,
        });
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
        didRetry: true,
        externalSignal,
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
  setLatestVersion,
  submitExamAnswer,
  submitExamSession,
};
