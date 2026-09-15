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
  const requestPayload = {
    ...payload,
    retryAttempt: didRetry ? 1 : 0,
  };
  const requestConfig = attachExamAuthHeaders({ signal });

  try {
    const response = await api.patch(`/exams/sessions/${sessionId}/answer`, requestPayload, requestConfig);
    if (!isLatestRequest(requestId)) {
      if (ENABLE_DEBUG_LOGS) {
        console.log({
          intentId: payload?.intentId || null,
          intentSeq: payload?.intentSeq || null,
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
      if (ENABLE_DEBUG_LOGS) {
        console.log({
          intentId: payload?.intentId || null,
          intentSeq: payload?.intentSeq || null,
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
        intentSeq: payload?.intentSeq || response?.data?.intentSeq || null,
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
      if (isLatestRequest(requestId)) {
        requestState.activeController = null;
      }
      return { aborted: true, requestId, cancelled: true };
    }

    const status = Number(error?.response?.status || 0);
    if (status === 409 && allowConflictRetry) {
      await refreshExamSession(sessionId);
      if (!isLatestRequest(requestId)) {
        if (ENABLE_DEBUG_LOGS) {
          console.log({
            intentId: payload?.intentId || null,
            intentSeq: payload?.intentSeq || null,
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
        requestPayload,
        attachExamAuthHeaders({ signal })
      );
      if (!isLatestRequest(requestId)) {
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
        if (ENABLE_DEBUG_LOGS) {
          console.log({
            intentId: payload?.intentId || null,
            intentSeq: payload?.intentSeq || null,
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
          intentSeq: payload?.intentSeq || retryResponse?.data?.intentSeq || null,
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
      await delay(RETRY_DELAY_MS);
      if (!isLatestRequest(requestId)) {
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
  try {
    const response = await api.post(`/exams/sessions/${sessionId}/submit`, undefined, attachExamAuthHeaders({ signal }));
    if (!isLatestRequest(requestId)) {
      return { aborted: true, requestId, stale: true };
    }
    requestState.activeController = null;
    return response;
  } catch (error) {
    if (isAbortError(error)) {
      return { aborted: true, requestId, cancelled: true };
    }
    if (isLatestRequest(requestId)) {
      requestState.activeController = null;
    }
    throw error;
  }
};

const getExamSession = async (sessionId) => refreshExamSession(sessionId);

// Extracts a server-sent error message from a failed blob download. When the backend
// responds with a JSON error body but the request was made with responseType: 'blob',
// axios still hands back a Blob (not the parsed JSON) - so we have to read and parse it
// ourselves before we can show the real message instead of a generic failure.
const extractBlobErrorMessage = async (error, fallback) => {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      if (parsed?.message) return parsed.message;
    } catch (parseError) {
      // fall through to fallback below - the blob wasn't JSON we could read
    }
  }
  return error?.response?.data?.message || fallback;
};

const parseFilenameFromContentDisposition = (contentDisposition, fallbackFilename) => {
  if (!contentDisposition) return fallbackFilename;
  const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return match?.[1] || fallbackFilename;
};

const triggerBlobDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// Downloads the exam report / certificate PDF for a submitted session and saves it via
// the browser, without navigating away from the result page. These are independent of
// the answer/submit request machinery above (no session token, versioning, or retry
// semantics apply here - it's a plain authenticated GET returning a binary file).
const downloadExamReport = async (sessionId) => {
  try {
    const response = await api.get(`/exams/sessions/${sessionId}/report`, { responseType: 'blob' });
    const filename = parseFilenameFromContentDisposition(
      response.headers['content-disposition'],
      `TutorMind_Exam_Report_${sessionId}.pdf`
    );
    triggerBlobDownload(response.data, filename);
  } catch (error) {
    const message = await extractBlobErrorMessage(error, 'Unable to generate the exam report. Please try again.');
    throw new Error(message);
  }
};

const downloadExamCertificate = async (sessionId) => {
  try {
    const response = await api.get(`/exams/sessions/${sessionId}/certificate`, { responseType: 'blob' });
    const filename = parseFilenameFromContentDisposition(
      response.headers['content-disposition'],
      `TutorMind_Certificate_${sessionId}.pdf`
    );
    triggerBlobDownload(response.data, filename);
  } catch (error) {
    const message = await extractBlobErrorMessage(error, 'Unable to generate the certificate. Please try again.');
    throw new Error(message);
  }
};

export {
  clearExamSessionAuth,
  downloadExamCertificate,
  downloadExamReport,
  getExamSession,
  setExamSessionAuth,
  setLatestVersion,
  submitExamAnswer,
  submitExamSession,
};
