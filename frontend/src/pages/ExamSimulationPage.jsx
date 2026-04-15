import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  clearExamSessionAuth,
  getExamSession,
  setExamSessionAuth,
  setLatestVersion,
  submitExamAnswer,
  submitExamSession,
} from '../api/examClient';
const EXAM_TAB_LOCK_KEY = 'exam-active-tab-lock';

const SECTION_SUBJECT_OPTIONS = {
  NEET: ['Physics', 'Chemistry', 'Biology'],
  CET: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
  JEE: ['Physics', 'Chemistry', 'Mathematics'],
};

const formatTime = (seconds) => {
  const safe = Math.max(0, Number(seconds || 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const withPad = (n) => String(n).padStart(2, '0');
  return `${withPad(hrs)}:${withPad(mins)}:${withPad(secs)}`;
};

const formatClockTime = (isoValue) => {
  if (!isoValue) return '--:--:--';
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString('en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getSessionStorageKey = (sessionId, key) => `exam-session:${sessionId}:${key}`;
const ACTIVE_SESSION_STORAGE_KEY = 'exam-active-session-id';
const PENDING_INTENT_STORAGE_KEY = (sessionId) => getSessionStorageKey(sessionId, 'pendingIntent');
const TAB_SWITCH_WARNING_LIMIT = 3;
const TAB_LOCK_STALE_MS = 8000;
const buildIntentId = () => {
  if (window?.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const initialNavigationState = {
  currentIndex: 0,
};

const navigationReducer = (state, action) => {
  switch (action.type) {
    case 'RESET':
      return initialNavigationState;
    case 'SET_INDEX':
      return {
        ...state,
        currentIndex: Math.max(0, Number(action.payload.index || 0)),
      };
    case 'PREVIOUS':
      return {
        ...state,
        currentIndex: Math.max(state.currentIndex - 1, 0),
      };
    case 'NEXT':
      return {
        ...state,
        currentIndex: Math.min(state.currentIndex + 1, Number(action.payload.maxIndex || 0)),
      };
    default:
      return state;
  }
};

const initialAnswerState = {
  answers: {},
  isSaving: false,
  hasPendingSync: false,
  syncWarning: '',
  pendingByQuestion: {},
  failedByQuestion: {},
  lastConfirmedAtByQuestion: {},
  saveStatus: 'idle',
};

const answerReducer = (state, action) => {
  switch (action.type) {
    case 'RESET':
      return initialAnswerState;
    case 'INIT_ANSWERS':
      return {
        ...state,
        answers: action.payload.answers || {},
        hasPendingSync: false,
        syncWarning: '',
      };
    case 'SET_ANSWER':
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.payload.questionId]: action.payload.answerIndex,
        },
      };
    case 'SET_PENDING_ANSWER':
      return {
        ...state,
        pendingByQuestion: {
          ...state.pendingByQuestion,
          [action.payload.questionId]: action.payload.answerIndex,
        },
        failedByQuestion: {
          ...state.failedByQuestion,
          [action.payload.questionId]: false,
        },
      };
    case 'CLEAR_PENDING_ANSWER': {
      const nextPending = { ...state.pendingByQuestion };
      delete nextPending[action.payload.questionId];
      return {
        ...state,
        pendingByQuestion: nextPending,
      };
    }
    case 'SET_FAILED_QUESTION':
      return {
        ...state,
        failedByQuestion: {
          ...state.failedByQuestion,
          [action.payload.questionId]: Boolean(action.payload.failed),
        },
      };
    case 'SET_LAST_CONFIRMED_AT':
      return {
        ...state,
        lastConfirmedAtByQuestion: {
          ...state.lastConfirmedAtByQuestion,
          [action.payload.questionId]: action.payload.timestamp,
        },
      };
    case 'SET_SAVING':
      return {
        ...state,
        isSaving: Boolean(action.payload.isSaving),
      };
    case 'SET_SYNC_WARNING':
      return {
        ...state,
        hasPendingSync: Boolean(action.payload.hasPendingSync),
        syncWarning: action.payload.message || '',
      };
    case 'SET_SAVE_STATUS':
      return {
        ...state,
        saveStatus: action.payload.status || 'idle',
      };
    default:
      return state;
  }
};

const initialMetaState = {
  reviewFlags: {},
  visitedQuestions: {},
  tabSwitchCount: 0,
};

const metaReducer = (state, action) => {
  switch (action.type) {
    case 'RESET':
      return initialMetaState;
    case 'INIT_META':
      return {
        ...state,
        reviewFlags: action.payload.reviewFlags || {},
        visitedQuestions: action.payload.visitedQuestions || {},
      };
    case 'TOGGLE_REVIEW': {
      const next = { ...state.reviewFlags };
      if (next[action.payload.questionId]) {
        delete next[action.payload.questionId];
      } else {
        next[action.payload.questionId] = true;
      }
      return {
        ...state,
        reviewFlags: next,
      };
    }
    case 'MARK_VISITED':
      return {
        ...state,
        visitedQuestions: {
          ...state.visitedQuestions,
          [action.payload.questionId]: true,
        },
      };
    case 'INCREMENT_TAB_SWITCH':
      return {
        ...state,
        tabSwitchCount: state.tabSwitchCount + 1,
      };
    default:
      return state;
  }
};

const ExamSimulationPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userExam = (user?.targetExam || user?.exam || 'NEET').trim().toUpperCase();

  const [mode, setMode] = useState('full-length');
  const [examType, setExamType] = useState(userExam || 'NEET');
  const [sectionSubject, setSectionSubject] = useState('Physics');
  const [strictNavigation, setStrictNavigation] = useState(true);

  const [session, setSession] = useState(null);
  const [timeLeftSec, setTimeLeftSec] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [error, setError] = useState('');
  const [tabWarning, setTabWarning] = useState('');
  const [restoreNotice, setRestoreNotice] = useState('');
  const [multiTabWarning, setMultiTabWarning] = useState('');
  const [isSecondaryTab, setIsSecondaryTab] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [syncIndicator, setSyncIndicator] = useState('');

  const [navigationState, dispatchNavigation] = useReducer(navigationReducer, initialNavigationState);
  const [answerState, dispatchAnswer] = useReducer(answerReducer, initialAnswerState);
  const [metaState, dispatchMeta] = useReducer(metaReducer, initialMetaState);

  const saveDebounceRef = useRef(null);
  const saveQueueRef = useRef(new Map());
  const inFlightSavesRef = useRef([]);
  const isSaveInFlightRef = useRef(false);
  const syncIndicatorTimeoutRef = useRef(null);
  const pendingRetryTimeoutRef = useRef(null);
  const submitTriggeredRef = useRef(false);
  const serverOffsetMsRef = useRef(0);
  const tabIdRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const latestVersionRef = useRef(0);
  const pendingAnswerRef = useRef(null);
  const pendingQuestionIdRef = useRef('');
  const pendingIntentRef = useRef(null);
  const latestIntentByQuestionRef = useRef(new Map());
  const latestIntentSeqByQuestionRef = useRef(new Map());
  const inFlightIntentMapRef = useRef(new Map());

  const allowedSectionSubjects = useMemo(
    () => SECTION_SUBJECT_OPTIONS[examType] || SECTION_SUBJECT_OPTIONS.NEET,
    [examType]
  );

  useEffect(() => {
    if (mode !== 'section-wise') return;
    if (!allowedSectionSubjects.includes(sectionSubject)) {
      setSectionSubject(allowedSectionSubjects[0]);
    }
  }, [mode, sectionSubject, allowedSectionSubjects]);

  const computeRemainingSec = (sessionData, offsetMs = serverOffsetMsRef.current) => {
    const expiresAtMs = new Date(sessionData.expiresAt).getTime();
    return Math.max(0, Math.floor((expiresAtMs - (Date.now() + offsetMs)) / 1000));
  };

  const redirectToResultPage = (sessionData, resultData) => {
    navigate('/exam-simulation/result', {
      replace: true,
      state: {
        result: resultData || sessionData.resultSummary,
        sessionId: sessionData.sessionId,
        sessionMeta: {
          examType: sessionData.examType,
          mode: sessionData.mode,
        },
      },
    });
  };

  useEffect(() => {
    if (session) return;

    const restoreSession = async () => {
      const storedSessionId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      let restored = null;
      let restoreSource = null;

      if (storedSessionId) {
        try {
          const data = await getExamSession(storedSessionId);
          restored = data;
          restoreSource = 'stored-session-id';
        } catch (requestError) {
          console.log('[exam-restore] stored-session-fetch-failed', { storedSessionId });
          localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
        }
      }

      if (!restored) {
        try {
          const { data } = await api.get('/exams/sessions/active/latest');
          if (data?.session) {
            restored = data.session;
            restoreSource = 'latest-active-session';
          }
        } catch (requestError) {
          console.log('[exam-restore] latest-active-none');
        }
      }

      if (!restored) return;

      const serverNowMs = new Date(restored.serverNow || Date.now()).getTime();
      serverOffsetMsRef.current = serverNowMs - Date.now();

      if (restored.status !== 'active') {
        console.log('[exam-restore] redirect-non-active', {
          source: restoreSource,
          sessionId: restored.sessionId,
          status: restored.status,
        });
        localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
        redirectToResultPage(restored, restored.resultSummary);
        return;
      }

      const remaining = computeRemainingSec(restored, serverOffsetMsRef.current);
      if (remaining <= 0) {
        try {
          console.log('[exam-restore] expired-on-restore-submit', {
            source: restoreSource,
            sessionId: restored.sessionId,
          });
          const { data } = await api.post(`/exams/sessions/${restored.sessionId}/submit`);
          localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
          redirectToResultPage(restored, data);
          return;
        } catch (submitError) {
          setError('Session expired during restore and auto-submit failed. Please retry.');
          return;
        }
      }

      console.log('[exam-restore] restored-active-session', {
        source: restoreSource,
        sessionId: restored.sessionId,
      });
      setExamSessionAuth({
        sessionId: restored.sessionId,
        sessionToken: restored.sessionToken,
        requestNonce: restored.requestNonce,
      });
      latestVersionRef.current = Number(restored.version || latestVersionRef.current || 0);
      setLatestVersion(latestVersionRef.current);
      setRestoreNotice('Your exam session was restored. Timer resumed.');
      setSession(restored);
      setTimeLeftSec(remaining);
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, restored.sessionId);
    };

    restoreSession();
  }, [session, navigate]);

  useEffect(() => {
    if (!session || session.status !== 'active') return undefined;

    const tick = () => {
      const remaining = computeRemainingSec(session);
      setTimeLeftSec(remaining);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!session || session.status !== 'active' || timeLeftSec > 0 || isSubmitting || submitLocked) return;

    const autoSubmit = async () => {
      try {
        if (submitTriggeredRef.current) return;
        submitTriggeredRef.current = true;
        setSubmitLocked(true);
        setIsSubmitting(true);
        const synced = await flushSaveQueue();
        if (!synced) {
          throw new Error('Unable to sync answers before auto-submit.');
        }
        await Promise.all(inFlightSavesRef.current);
        const submitResponse = await submitExamSession({ sessionId: session.sessionId });
        if (submitResponse?.aborted) {
          throw new Error('Submit was superseded by a newer request.');
        }
        const { data } = submitResponse;
        setSession((prev) => (prev ? { ...prev, status: 'expired', submittedAt: data.submittedAt } : prev));
        navigate('/exam-simulation/result', {
          replace: true,
          state: {
            result: data,
            sessionId: session.sessionId,
            sessionMeta: {
              examType: session.examType,
              mode: session.mode,
            },
          },
        });
        localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
        localStorage.removeItem(EXAM_TAB_LOCK_KEY);
      } catch (err) {
        setError(err?.response?.data?.message || 'Auto-submit failed. Please submit manually.');
        submitTriggeredRef.current = false;
        setSubmitLocked(false);
      } finally {
        setIsSubmitting(false);
      }
    };

    autoSubmit();
  }, [timeLeftSec, session, isSubmitting, submitLocked, navigate]);

  const questions = session?.questions || [];
  const currentQuestion = questions[navigationState.currentIndex] || null;
  const currentQuestionId = currentQuestion?._id || '';
  const selectedAnswer = currentQuestion ? answerState.answers[currentQuestion._id] : null;
  const currentQuestionPending = Boolean(answerState.pendingByQuestion[currentQuestionId] !== undefined);
  const currentQuestionFailed = Boolean(answerState.failedByQuestion[currentQuestionId]);
  const currentLastConfirmedAt = answerState.lastConfirmedAtByQuestion[currentQuestionId] || '';
  const inputsDisabled =
    !session ||
    session.status !== 'active' ||
    timeLeftSec <= 0 ||
    isSubmitting ||
    answerState.isSaving ||
    isReconciling ||
    submitLocked ||
    isSecondaryTab;

  const getAnswerByIndex = (index) => {
    const question = questions[index];
    if (!question) return undefined;
    return answerState.answers[question._id];
  };

  const canMoveForwardTo = (targetIndex) => {
    if (!session?.strictNavigation) return true;
    if (targetIndex <= navigationState.currentIndex) return true;

    for (let idx = navigationState.currentIndex; idx < targetIndex; idx += 1) {
      if (!Number.isInteger(getAnswerByIndex(idx))) {
        console.log('[exam-nav] blocked-forward', {
          from: navigationState.currentIndex,
          to: targetIndex,
          blockedAt: idx,
        });
        return false;
      }
    }
    return true;
  };

  const setSyncIndicatorWithReset = (message) => {
    setSyncIndicator(message);
    if (syncIndicatorTimeoutRef.current) {
      clearTimeout(syncIndicatorTimeoutRef.current);
    }
    syncIndicatorTimeoutRef.current = setTimeout(() => {
      setSyncIndicator('');
      syncIndicatorTimeoutRef.current = null;
    }, 1800);
  };

  const buildAnswerMapFromSessionState = (sessionState) => {
    const questionList = sessionState?.questions || [];
    return (sessionState?.responses || []).reduce((acc, entry) => {
      if (!Number.isInteger(entry?.selectedAnswerIndex)) return acc;
      const question = questionList[Number(entry.questionIndex)];
      if (question?._id) {
        acc[question._id] = entry.selectedAnswerIndex;
      }
      return acc;
    }, {});
  };

  const debugIntentLog = ({ intentId, intentSeq, version, ignored = false, retryUsed = false, reconciled = false }) => {
    if (import.meta.env.DEV) {
      console.log({
        intentId,
        intentSeq,
        version,
        ignored,
        retryUsed,
        reconciled,
      });
    }
  };

  const setPendingIntent = ({ questionIndex, questionId, answerIndex, intentId, intentSeq, timestamp }) => {
    if (!session?.sessionId || !questionId || !Number.isInteger(answerIndex)) return;
    const resolvedIntentId = intentId || buildIntentId();
    const previousSeq = Number(latestIntentSeqByQuestionRef.current.get(questionId) || 0);
    const resolvedIntentSeq = Number.isInteger(Number(intentSeq))
      ? Number(intentSeq)
      : previousSeq + 1;
    const resolvedTimestamp = Number(timestamp || Date.now());

    const previousInFlight = inFlightIntentMapRef.current.get(questionId);
    if (previousInFlight?.controller) {
      previousInFlight.obsolete = true;
      previousInFlight.controller.abort();
    }

    const nextController = new AbortController();
    inFlightIntentMapRef.current.set(questionId, {
      intentId: resolvedIntentId,
      intentSeq: resolvedIntentSeq,
      controller: nextController,
      obsolete: false,
    });
    latestIntentByQuestionRef.current.set(questionId, resolvedIntentId);
    latestIntentSeqByQuestionRef.current.set(questionId, resolvedIntentSeq);

    pendingAnswerRef.current = answerIndex;
    pendingQuestionIdRef.current = questionId;
    pendingIntentRef.current = {
      questionIndex: Number(questionIndex),
      questionId,
      answerIndex,
      intentId: resolvedIntentId,
      intentSeq: resolvedIntentSeq,
      timestamp: resolvedTimestamp,
    };
    localStorage.setItem(PENDING_INTENT_STORAGE_KEY(session.sessionId), JSON.stringify(pendingIntentRef.current));
    dispatchAnswer({
      type: 'SET_PENDING_ANSWER',
      payload: { questionId, answerIndex },
    });
    dispatchAnswer({
      type: 'SET_FAILED_QUESTION',
      payload: { questionId, failed: false },
    });
    dispatchAnswer({ type: 'SET_SAVE_STATUS', payload: { status: 'pending' } });
    return pendingIntentRef.current;
  };

  const clearPendingIntent = ({ questionId }) => {
    if (!session?.sessionId) return;
    if (pendingRetryTimeoutRef.current) {
      clearTimeout(pendingRetryTimeoutRef.current);
      pendingRetryTimeoutRef.current = null;
    }
    pendingAnswerRef.current = null;
    pendingQuestionIdRef.current = '';
    pendingIntentRef.current = null;
    localStorage.removeItem(PENDING_INTENT_STORAGE_KEY(session.sessionId));
    if (questionId) {
      inFlightIntentMapRef.current.delete(questionId);
      dispatchAnswer({
        type: 'CLEAR_PENDING_ANSWER',
        payload: { questionId },
      });
    }
  };

  const schedulePendingRetry = () => {
    if (pendingRetryTimeoutRef.current) {
      clearTimeout(pendingRetryTimeoutRef.current);
    }
    pendingRetryTimeoutRef.current = setTimeout(() => {
      flushPendingSave();
    }, 1500);
  };

  const persistPendingIntentSnapshot = () => {
    if (!session?.sessionId || !pendingIntentRef.current) return;
    localStorage.setItem(
      PENDING_INTENT_STORAGE_KEY(session.sessionId),
      JSON.stringify({
        ...pendingIntentRef.current,
        timestamp: Number(pendingIntentRef.current.timestamp || Date.now()),
      })
    );
  };

  const reconcileStateWithBackend = ({
    backendSession,
    selectedQuestionId,
    selectedAnswerIndex,
  }) => {
    const backendVersion = Number(backendSession?.version || 0);
    if (Number.isInteger(backendVersion) && backendVersion > 0) {
      latestVersionRef.current = Math.max(latestVersionRef.current, backendVersion);
      setLatestVersion(latestVersionRef.current);
    }

    const backendAnswers = buildAnswerMapFromSessionState(backendSession);
    const mergedAnswers = {
      ...answerState.answers,
      ...backendAnswers,
    };

    dispatchAnswer({
      type: 'INIT_ANSWERS',
      payload: {
        answers: mergedAnswers,
      },
    });

    const backendIndex = Number(backendSession?.currentQuestionIndex);
    if (Number.isInteger(backendIndex)) {
      dispatchNavigation({
        type: 'SET_INDEX',
        payload: { index: backendIndex },
      });
    }

    if (selectedQuestionId && Number.isInteger(selectedAnswerIndex)) {
      const backendSavedAnswer = backendAnswers[selectedQuestionId];
      if (Number.isInteger(backendSavedAnswer) && backendSavedAnswer !== selectedAnswerIndex) {
        console.log('[exam-sync] mismatch-detected', {
          questionId: selectedQuestionId,
          localAnswer: selectedAnswerIndex,
          backendAnswer: backendSavedAnswer,
        });
        dispatchAnswer({
          type: 'SET_ANSWER',
          payload: {
            questionId: selectedQuestionId,
            answerIndex: backendSavedAnswer,
          },
        });
        setSyncIndicatorWithReset('Corrected to latest saved state');
      } else {
        setSyncIndicatorWithReset('Synced');
      }
    } else {
      setSyncIndicatorWithReset('Synced');
    }

    setSession(backendSession);
  };

  const forceFullSessionRefetch = async ({
    reason,
    questionId,
    expectedAnswerIndex,
  }) => {
    if (!session?.sessionId) return false;
    setIsReconciling(true);
    try {
      const refreshed = await getExamSession(session.sessionId);
      reconcileStateWithBackend({
        backendSession: refreshed,
        selectedQuestionId: questionId,
        selectedAnswerIndex: expectedAnswerIndex,
      });
      dispatchAnswer({
        type: 'SET_SYNC_WARNING',
        payload: {
          hasPendingSync: true,
          message: 'State corrected to server',
        },
      });
      setSyncIndicatorWithReset('State corrected to server');
      if (import.meta.env.DEV) {
        console.log('[exam-sync] hard-refetch', { reason, questionId });
      }
      return true;
    } catch (error) {
      setError('Hard sync failed. Please reload the exam.');
      return false;
    } finally {
      setIsReconciling(false);
    }
  };

  const saveAnswerWithRetry = async ({ questionIndex, questionId, answerIndex, intentId, intentSeq }) => {
    if (!session?.sessionId) return false;

    const latestIntentId = latestIntentByQuestionRef.current.get(questionId);
    const latestIntentSeq = Number(latestIntentSeqByQuestionRef.current.get(questionId) || 0);
    if (!latestIntentId || latestIntentId !== intentId || Number(intentSeq) !== latestIntentSeq) {
      debugIntentLog({
        intentId,
        intentSeq,
        version: latestVersionRef.current,
        ignored: true,
        retryUsed: false,
        reconciled: false,
      });
      await forceFullSessionRefetch({
        reason: 'local-intent-mismatch-before-request',
        questionId,
        expectedAnswerIndex: answerIndex,
      });
      return false;
    }

    if (!navigator.onLine) {
      dispatchAnswer({
        type: 'SET_SYNC_WARNING',
        payload: {
          hasPendingSync: true,
          message: 'Failed to save. Retrying...',
        },
      });
      dispatchAnswer({
        type: 'SET_FAILED_QUESTION',
        payload: { questionId, failed: true },
      });
      dispatchAnswer({ type: 'SET_SAVE_STATUS', payload: { status: 'failed' } });
      schedulePendingRetry();
      return false;
    }

    dispatchAnswer({ type: 'SET_SAVE_STATUS', payload: { status: 'pending' } });

    console.log('[exam-save] outgoing-auth', {
      questionIndex,
      nonce: 'managed-by-wrapper',
      hasToken: true,
      intentId,
    });

    try {
      const currentInFlight = inFlightIntentMapRef.current.get(questionId);
      const response = await submitExamAnswer({
        sessionId: session.sessionId,
        payload: {
          questionIndex,
          questionId,
          selectedAnswerIndex: answerIndex,
          timeTakenSec: 0,
          intentId,
          intentSeq,
        },
        externalSignal: currentInFlight?.controller?.signal,
      });

      if (response?.aborted) {
        console.log('[exam-save] ignored-aborted-response', {
          questionIndex,
          requestId: response.requestId,
        });
        if (response?.staleVersion) {
          console.log('[exam-sync] ignored-outdated-response', {
            requestId: response.requestId,
            incomingVersion: response.responseVersion,
            latestVersion: latestVersionRef.current,
          });
        }
        debugIntentLog({
          intentId,
          intentSeq,
          version: response?.responseVersion || latestVersionRef.current,
          ignored: true,
          retryUsed: Boolean(response?.__examMeta?.didRetry),
          reconciled: false,
        });
        return false;
      }

      let backendSession = response.data;
      const backendIntentId = String(backendSession?.intentId || '');
      const backendIntentSeq = Number(backendSession?.intentSeq || 0);
      const latestKnownIntentId = latestIntentByQuestionRef.current.get(questionId);
      const latestKnownIntentSeq = Number(latestIntentSeqByQuestionRef.current.get(questionId) || 0);
      if (
        !backendIntentId ||
        backendIntentId !== latestKnownIntentId ||
        !Number.isInteger(backendIntentSeq) ||
        backendIntentSeq !== latestKnownIntentSeq
      ) {
        debugIntentLog({
          intentId,
          intentSeq,
          version: Number(backendSession?.version || latestVersionRef.current),
          ignored: true,
          retryUsed: Boolean(response?.__examMeta?.didRetry),
          reconciled: false,
        });
        await forceFullSessionRefetch({
          reason: 'response-intent-mismatch',
          questionId,
          expectedAnswerIndex: answerIndex,
        });
        return false;
      }

      const responseVersion = Number(backendSession?.version || 0);
      if (Number.isInteger(responseVersion) && responseVersion < latestVersionRef.current) {
        console.log('[exam-sync] ignored-outdated-response', {
          incomingVersion: responseVersion,
          latestVersion: latestVersionRef.current,
          questionIndex,
        });
        debugIntentLog({
          intentId,
          intentSeq,
          version: responseVersion,
          ignored: true,
          retryUsed: Boolean(response?.__examMeta?.didRetry),
          reconciled: false,
        });
        await forceFullSessionRefetch({
          reason: 'version-rollback',
          questionId,
          expectedAnswerIndex: answerIndex,
        });
        return false;
      }

      const didRetry = Boolean(response?.__examMeta?.didRetry);
      const missingExpectedFields =
        !backendSession ||
        !Array.isArray(backendSession.responses) ||
        !Number.isInteger(Number(backendSession.currentQuestionIndex)) ||
        !Number.isInteger(Number(backendSession.version));

      if (didRetry || missingExpectedFields) {
        console.log('[exam-sync] refetch-triggered', {
          reason: didRetry ? 'retry-path' : 'missing-fields',
          questionIndex,
        });
        setIsReconciling(true);
        backendSession = await getExamSession(session.sessionId);
      }

      const backendAnswerMap = buildAnswerMapFromSessionState(backendSession);
      const backendSavedAnswer = backendAnswerMap[questionId];
      let reconciled = false;
      if (!Number.isInteger(backendSavedAnswer) || backendSavedAnswer !== answerIndex) {
        await forceFullSessionRefetch({
          reason: 'answer-mismatch',
          questionId,
          expectedAnswerIndex: answerIndex,
        });
        const correctedSession = await getExamSession(session.sessionId);
        backendSession = correctedSession;
        reconciled = true;
      }

      console.log('[exam-save] incoming-auth', {
        questionIndex,
        nonce: backendSession?.requestNonce,
        intentId: backendSession?.intentId,
      });

      setIsReconciling(true);
      reconcileStateWithBackend({
        backendSession,
        selectedQuestionId: questionId,
        selectedAnswerIndex: answerIndex,
      });
      dispatchAnswer({
        type: 'SET_SYNC_WARNING',
        payload: {
          hasPendingSync: false,
          message: '',
        },
      });
      if (
        pendingIntentRef.current?.questionId === questionId &&
        pendingIntentRef.current?.answerIndex === answerIndex &&
        pendingIntentRef.current?.intentId === intentId &&
        Number(pendingIntentRef.current?.intentSeq) === Number(intentSeq)
      ) {
        clearPendingIntent({ questionId });
      }
      dispatchAnswer({
        type: 'SET_FAILED_QUESTION',
        payload: { questionId, failed: false },
      });
      dispatchAnswer({
        type: 'SET_LAST_CONFIRMED_AT',
        payload: {
          questionId,
          timestamp: new Date().toISOString(),
        },
      });
      dispatchAnswer({ type: 'SET_SAVE_STATUS', payload: { status: 'confirmed' } });
      debugIntentLog({
        intentId,
        intentSeq,
        version: Number(backendSession?.version || latestVersionRef.current),
        ignored: false,
        retryUsed: didRetry,
        reconciled,
      });
      return true;
    } catch (requestError) {
      const status = Number(requestError?.response?.status || 0);
      console.log('[exam-save] rejected-request', {
        questionIndex,
        status,
        message: requestError?.response?.data?.message,
      });

      if (status === 401) {
        setError('Session authentication failed. Restarting exam session is required.');
        localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
        clearExamSessionAuth();
        setSession(null);
      } else if (status === 409 || status === 429) {
        try {
          setIsReconciling(true);
          console.log('[exam-sync] refetch-triggered', {
            reason: status === 409 ? 'conflict-failure' : 'rate-limit-failure',
            questionIndex,
          });
          const data = await getExamSession(session.sessionId);
          latestVersionRef.current = Math.max(latestVersionRef.current, Number(data?.version || 0));
          setLatestVersion(latestVersionRef.current);
          reconcileStateWithBackend({
            backendSession: data,
            selectedQuestionId: questionId,
            selectedAnswerIndex: answerIndex,
          });
          setError('Session was refreshed after save failure. Retry your action.');
        } catch (refreshError) {
          setError('Save failed and state refresh failed. Please reload the exam.');
        }
      } else {
        setError(requestError?.response?.data?.message || 'Failed to save answer.');
      }

      dispatchAnswer({
        type: 'SET_SYNC_WARNING',
        payload: {
          hasPendingSync: true,
          message: 'Failed to save. Retrying...',
        },
      });
      dispatchAnswer({
        type: 'SET_FAILED_QUESTION',
        payload: { questionId, failed: true },
      });
      dispatchAnswer({ type: 'SET_SAVE_STATUS', payload: { status: 'failed' } });
      debugIntentLog({
        intentId,
        intentSeq,
        version: latestVersionRef.current,
        ignored: false,
        retryUsed: true,
        reconciled: false,
      });
      schedulePendingRetry();
      return false;
    } finally {
      const inFlight = inFlightIntentMapRef.current.get(questionId);
      if (inFlight?.intentId === intentId) {
        inFlightIntentMapRef.current.delete(questionId);
      }
      setIsReconciling(false);
    }
  };

  const flushPendingSave = async () => {
    if (!session || session.status !== 'active') return true;
    if (isSaveInFlightRef.current) return false;
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }

    const entries = Array.from(saveQueueRef.current.entries()).map(([questionIndex, queuedPayload]) => ({
      questionIndex: Number(questionIndex),
      ...queuedPayload,
    }));
    saveQueueRef.current.clear();

    if (!entries.length) return true;
    dispatchAnswer({ type: 'SET_SAVING', payload: { isSaving: true } });
    isSaveInFlightRef.current = true;
    console.log('[exam-save] flushing-queue', { size: entries.length });

    const outcomes = [];
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      const questionId = entry.questionId || questions[entry.questionIndex]?._id;
      const savePromise = saveAnswerWithRetry({ ...entry, questionId });
      inFlightSavesRef.current.push(savePromise);
      const success = await savePromise;
      outcomes.push(success);
      inFlightSavesRef.current = inFlightSavesRef.current.filter((promise) => promise !== savePromise);
      if (!success) {
        for (let retryIdx = i; retryIdx < entries.length; retryIdx += 1) {
          saveQueueRef.current.set(Number(entries[retryIdx].questionIndex), {
            questionId: entries[retryIdx].questionId,
            answerIndex: entries[retryIdx].answerIndex,
            intentId: entries[retryIdx].intentId,
            intentSeq: entries[retryIdx].intentSeq,
            timestamp: entries[retryIdx].timestamp,
          });
        }
        break;
      }
    }
    isSaveInFlightRef.current = false;
    dispatchAnswer({ type: 'SET_SAVING', payload: { isSaving: false } });

    return outcomes.every(Boolean);
  };

  const queueAnswerSave = ({ questionIndex, questionId, answerIndex, intentId, intentSeq, timestamp }) => {
    saveQueueRef.current.set(Number(questionIndex), {
      questionId,
      answerIndex,
      intentId,
      intentSeq,
      timestamp,
    });
    console.log('[exam-save] queued', {
      questionIndex,
      queueSize: saveQueueRef.current.size,
    });

    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }

    saveDebounceRef.current = setTimeout(() => {
      flushPendingSave();
    }, 300);
  };

  const answeredByIndex = useMemo(
    () =>
      questions.reduce((acc, question, index) => {
        acc[index] = Number.isInteger(answerState.answers[question._id]);
        return acc;
      }, {}),
    [questions, answerState.answers]
  );

  useEffect(() => {
    if (!session?.sessionId) {
      clearExamSessionAuth();
      dispatchNavigation({ type: 'RESET' });
      dispatchAnswer({ type: 'RESET' });
      dispatchMeta({ type: 'RESET' });
      submitTriggeredRef.current = false;
      setSubmitLocked(false);
      pendingAnswerRef.current = null;
      pendingQuestionIdRef.current = '';
      pendingIntentRef.current = null;
      latestIntentByQuestionRef.current.clear();
      latestIntentSeqByQuestionRef.current.clear();
      inFlightIntentMapRef.current.forEach((entry) => entry?.controller?.abort?.());
      inFlightIntentMapRef.current.clear();
      return;
    }

    setExamSessionAuth({
      sessionId: session.sessionId,
      sessionToken: session.sessionToken,
      requestNonce: session.requestNonce,
    });
    latestVersionRef.current = Math.max(latestVersionRef.current, Number(session.version || 0));
    setLatestVersion(latestVersionRef.current);

    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, session.sessionId);

    const serverAnswerMap = (session.responses || {}).reduce
      ? session.responses.reduce((acc, entry) => {
          if (Number.isInteger(entry.selectedAnswerIndex)) {
            const question = questions[entry.questionIndex];
            if (question?._id) {
              acc[question._id] = entry.selectedAnswerIndex;
            }
          }
          return acc;
        }, {})
      : {};

    const answerRaw = localStorage.getItem(getSessionStorageKey(session.sessionId, 'answers'));
    const reviewRaw = localStorage.getItem(getSessionStorageKey(session.sessionId, 'reviewFlags'));
    const visitedRaw = localStorage.getItem(getSessionStorageKey(session.sessionId, 'visitedQuestions'));
    const currentIndexRaw = localStorage.getItem(getSessionStorageKey(session.sessionId, 'currentIndex'));

    const storedAnswers = answerRaw ? JSON.parse(answerRaw) : {};
    const storedReviewFlags = reviewRaw ? JSON.parse(reviewRaw) : {};
    const storedVisited = visitedRaw ? JSON.parse(visitedRaw) : {};
    const parsedStoredIndex = Number(currentIndexRaw);

    const mergedAnswers = { ...storedAnswers, ...serverAnswerMap };

    dispatchAnswer({
      type: 'INIT_ANSWERS',
      payload: {
        answers: mergedAnswers,
      },
    });
    dispatchMeta({
      type: 'INIT_META',
      payload: {
        reviewFlags: storedReviewFlags,
        visitedQuestions: storedVisited,
      },
    });

    const maxIndex = Math.max((session.questionCount || 1) - 1, 0);
    const serverIndex = Number(session.currentQuestionIndex);
    const hasServerIndex = Number.isInteger(serverIndex);
    const fallbackIndex = Number.isInteger(parsedStoredIndex)
      ? Math.min(Math.max(parsedStoredIndex, 0), maxIndex)
      : 0;
    const restoredIndex = hasServerIndex
      ? Math.min(Math.max(serverIndex, 0), maxIndex)
      : fallbackIndex;

    console.log('[exam-restore] merge-decisions', {
      sessionId: session.sessionId,
      serverAnswers: Object.keys(serverAnswerMap).length,
      localAnswers: Object.keys(storedAnswers).length,
      mergedAnswers: Object.keys(mergedAnswers).length,
      indexSource: hasServerIndex ? 'server' : 'local-fallback',
      restoredIndex,
    });

    dispatchNavigation({ type: 'SET_INDEX', payload: { index: restoredIndex } });

    const pendingRaw = localStorage.getItem(PENDING_INTENT_STORAGE_KEY(session.sessionId));
    if (pendingRaw) {
      try {
        const pendingParsed = JSON.parse(pendingRaw);
        const pendingQuestion = questions[Number(pendingParsed?.questionIndex)];
        if (
          pendingQuestion?._id === pendingParsed?.questionId &&
          Number.isInteger(Number(pendingParsed?.answerIndex)) &&
          typeof pendingParsed?.intentId === 'string' &&
          Number.isInteger(Number(pendingParsed?.intentSeq))
        ) {
          const existingLatestIntentId = latestIntentByQuestionRef.current.get(pendingParsed.questionId);
          const existingLatestIntentSeq = Number(
            latestIntentSeqByQuestionRef.current.get(pendingParsed.questionId) || 0
          );
          if (existingLatestIntentId && existingLatestIntentId !== pendingParsed.intentId) {
            localStorage.removeItem(PENDING_INTENT_STORAGE_KEY(session.sessionId));
            return;
          }
          if (existingLatestIntentSeq && existingLatestIntentSeq !== Number(pendingParsed.intentSeq)) {
            localStorage.removeItem(PENDING_INTENT_STORAGE_KEY(session.sessionId));
            return;
          }

          const answerIndex = Number(pendingParsed.answerIndex);
          const serverConfirmedAnswer = serverAnswerMap[pendingParsed.questionId];
          if (Number.isInteger(serverConfirmedAnswer) && serverConfirmedAnswer === answerIndex) {
            localStorage.removeItem(PENDING_INTENT_STORAGE_KEY(session.sessionId));
            dispatchAnswer({ type: 'SET_SAVE_STATUS', payload: { status: 'confirmed' } });
            return;
          }

          setPendingIntent({
            questionIndex: Number(pendingParsed.questionIndex),
            questionId: pendingParsed.questionId,
            answerIndex,
            intentId: pendingParsed.intentId,
            intentSeq: Number(pendingParsed.intentSeq || 1),
            timestamp: Number(pendingParsed.timestamp || Date.now()),
          });
          dispatchAnswer({
            type: 'SET_ANSWER',
            payload: {
              questionId: pendingParsed.questionId,
              answerIndex,
            },
          });
          saveQueueRef.current.set(Number(pendingParsed.questionIndex), {
            questionId: pendingParsed.questionId,
            answerIndex,
            intentId: pendingParsed.intentId,
            intentSeq: Number(pendingParsed.intentSeq || 1),
            timestamp: Number(pendingParsed.timestamp || Date.now()),
          });
          schedulePendingRetry();
          dispatchAnswer({
            type: 'SET_SYNC_WARNING',
            payload: {
              hasPendingSync: true,
              message: 'Failed to save. Retrying...',
            },
          });
          dispatchAnswer({ type: 'SET_SAVE_STATUS', payload: { status: 'failed' } });
        } else {
          localStorage.removeItem(PENDING_INTENT_STORAGE_KEY(session.sessionId));
        }
      } catch (error) {
        localStorage.removeItem(PENDING_INTENT_STORAGE_KEY(session.sessionId));
      }
    }

    setTabWarning('');
    submitTriggeredRef.current = false;
    setSubmitLocked(false);
  }, [session?.sessionId]);

  useEffect(() => {
    if (!session?.sessionId) return;
    localStorage.setItem(
      getSessionStorageKey(session.sessionId, 'currentIndex'),
      String(navigationState.currentIndex)
    );
  }, [session?.sessionId, navigationState.currentIndex]);

  useEffect(() => {
    if (!session?.sessionId) return;
    localStorage.setItem(getSessionStorageKey(session.sessionId, 'answers'), JSON.stringify(answerState.answers));
  }, [answerState.answers, session?.sessionId]);

  useEffect(() => {
    if (!session?.sessionId) return;
    localStorage.setItem(
      getSessionStorageKey(session.sessionId, 'reviewFlags'),
      JSON.stringify(metaState.reviewFlags)
    );
  }, [metaState.reviewFlags, session?.sessionId]);

  useEffect(() => {
    if (!session?.sessionId) return;
    localStorage.setItem(
      getSessionStorageKey(session.sessionId, 'visitedQuestions'),
      JSON.stringify(metaState.visitedQuestions)
    );
  }, [metaState.visitedQuestions, session?.sessionId]);

  useEffect(() => {
    if (!currentQuestion?._id) return;
    dispatchMeta({
      type: 'MARK_VISITED',
      payload: {
        questionId: currentQuestion._id,
      },
    });
  }, [currentQuestion?._id]);

  useEffect(() => {
    console.log('Current Index:', navigationState.currentIndex);
  }, [navigationState.currentIndex]);

  useEffect(() => {
    if (!session || session.status !== 'active') return undefined;

    const onBeforeUnload = (event) => {
      if (!pendingIntentRef.current && saveQueueRef.current.size === 0) return;
      persistPendingIntentSnapshot();
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [session]);

  useEffect(() => {
    if (!session || session.status !== 'active') return undefined;

    const lockBelongsToCurrentTab = (lockValue) => {
      if (!lockValue) return false;
      try {
        const parsed = JSON.parse(lockValue);
        return parsed.tabId === tabIdRef.current;
      } catch (error) {
        return false;
      }
    };

    const tryAcquireLock = () => {
      const now = Date.now();
      const existingRaw = localStorage.getItem(EXAM_TAB_LOCK_KEY);
      let canAcquire = false;

      if (!existingRaw) {
        canAcquire = true;
      } else {
        try {
          const existing = JSON.parse(existingRaw);
          const isSameTab = existing.tabId === tabIdRef.current;
          const isSameSession = existing.sessionId === session.sessionId;
          const isStale = now - Number(existing.timestamp || 0) > TAB_LOCK_STALE_MS;
          canAcquire = isSameTab || !isSameSession || isStale;
        } catch (error) {
          canAcquire = true;
        }
      }

      if (canAcquire) {
        localStorage.setItem(
          EXAM_TAB_LOCK_KEY,
          JSON.stringify({
            tabId: tabIdRef.current,
            sessionId: session.sessionId,
            timestamp: now,
          })
        );
      }

      const currentRaw = localStorage.getItem(EXAM_TAB_LOCK_KEY);
      const isOwner = lockBelongsToCurrentTab(currentRaw);
      setIsSecondaryTab(!isOwner);
      if (isOwner) {
        setMultiTabWarning('');
      } else {
        setMultiTabWarning('This exam is active in another tab. Interaction is disabled in this tab.');
      }
    };

    const onStorage = (event) => {
      if (event.key !== EXAM_TAB_LOCK_KEY) return;
      const isOwner = lockBelongsToCurrentTab(event.newValue || localStorage.getItem(EXAM_TAB_LOCK_KEY));
      setIsSecondaryTab(!isOwner);
      if (isOwner) {
        setMultiTabWarning('');
      } else {
        setMultiTabWarning('This exam is active in another tab. Interaction is disabled in this tab.');
      }
    };

    tryAcquireLock();
    const heartbeat = setInterval(tryAcquireLock, 2000);
    window.addEventListener('storage', onStorage);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('storage', onStorage);
      const currentRaw = localStorage.getItem(EXAM_TAB_LOCK_KEY);
      if (lockBelongsToCurrentTab(currentRaw)) {
        localStorage.removeItem(EXAM_TAB_LOCK_KEY);
      }
    };
  }, [session?.sessionId, session?.status]);

  useEffect(() => {
    if (!session || session.status !== 'active') return undefined;

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return;

      if (pendingIntentRef.current) {
        persistPendingIntentSnapshot();
      }

      const nextCount = metaState.tabSwitchCount + 1;
      dispatchMeta({ type: 'INCREMENT_TAB_SWITCH' });
      if (nextCount > TAB_SWITCH_WARNING_LIMIT) {
        setTabWarning(
          `You switched tabs ${nextCount} times. Stay on this tab to avoid invalidating the simulation.`
        );
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [session, metaState.tabSwitchCount]);

  useEffect(
    () => () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
      }
      if (syncIndicatorTimeoutRef.current) {
        clearTimeout(syncIndicatorTimeoutRef.current);
      }
      if (pendingRetryTimeoutRef.current) {
        clearTimeout(pendingRetryTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!session || session.status !== 'active') return undefined;
    const onReconnect = () => {
      if (pendingIntentRef.current) {
        flushPendingSave();
      }
    };
    window.addEventListener('online', onReconnect);
    return () => window.removeEventListener('online', onReconnect);
  }, [session?.sessionId, session?.status]);

  const startSimulation = async () => {
    setError('');
    setTabWarning('');
    setRestoreNotice('');
    setMultiTabWarning('');
    setIsSecondaryTab(false);

    try {
      const payload = {
        mode,
        examType,
        strictNavigation,
      };

      if (mode === 'section-wise') {
        payload.sectionSubject = sectionSubject;
      }

      const { data } = await api.post('/exams/sessions', payload);
      setExamSessionAuth({
        sessionId: data.sessionId,
        sessionToken: data.sessionToken,
        requestNonce: data.requestNonce,
      });
      latestVersionRef.current = Number(data.version || 0);
      setLatestVersion(latestVersionRef.current);
      setSession(data);
      setTimeLeftSec(Number(data.timeLeftSec || data.timeLimitSec || 0));
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, data.sessionId);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to start exam simulation.');
    }
  };

  const ensureNoPendingIntentBeforeNavigation = async () => {
    if (!pendingIntentRef.current) return true;
    dispatchAnswer({ type: 'SET_SAVE_STATUS', payload: { status: 'pending' } });
    const synced = await flushPendingSave();
    if (!synced) {
      setError('Unsaved answer detected. Retry save before navigating.');
      dispatchAnswer({ type: 'SET_SAVE_STATUS', payload: { status: 'failed' } });
      return false;
    }
    return true;
  };

  const goToQuestion = async (index) => {
    console.log('[exam-nav] attempt', {
      from: navigationState.currentIndex,
      to: index,
      strict: Boolean(session?.strictNavigation),
    });

    if (inputsDisabled) return;
    if (index < 0 || index >= questions.length) return;
    const canProceed = await ensureNoPendingIntentBeforeNavigation();
    if (!canProceed) return;
    if (!canMoveForwardTo(index)) {
      return;
    }
    dispatchNavigation({
      type: 'SET_INDEX',
      payload: { index },
    });
  };

  const goToFirstUnanswered = () => {
    const unansweredIndex = questions.findIndex((_, index) => !answeredByIndex[index]);
    if (unansweredIndex < 0) return;
    goToQuestion(unansweredIndex);
  };

  const toggleMarkForReview = () => {
    if (!currentQuestion) return;
    dispatchMeta({
      type: 'TOGGLE_REVIEW',
      payload: {
        questionId: currentQuestion._id,
      },
    });
  };

  const submitSimulation = async () => {
    if (!session || session.status !== 'active' || isSubmitting || submitLocked) return;
    const ok = window.confirm('Submit test now? You cannot change answers after submission.');
    if (!ok) return;

    try {
      if (submitTriggeredRef.current) return;
      submitTriggeredRef.current = true;
      setSubmitLocked(true);
      setIsSubmitting(true);
      const synced = await flushSaveQueue();
      if (!synced) {
        throw new Error('Unable to sync answers before submit.');
      }
      await Promise.all(inFlightSavesRef.current);
      const submitResponse = await submitExamSession({ sessionId: session.sessionId });
      if (submitResponse?.aborted) {
        throw new Error('Submit was superseded by a newer request.');
      }
      const { data } = submitResponse;
      setSession((prev) => (prev ? { ...prev, status: 'submitted', submittedAt: data.submittedAt } : prev));
      navigate('/exam-simulation/result', {
        replace: true,
        state: {
          result: data,
          sessionId: session.sessionId,
          sessionMeta: {
            examType: session.examType,
            mode: session.mode,
          },
        },
      });
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
      localStorage.removeItem(EXAM_TAB_LOCK_KEY);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to submit exam simulation.');
      submitTriggeredRef.current = false;
      setSubmitLocked(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const flushSaveQueue = async () => {
    return flushPendingSave();
  };

  const canGoNext = () => {
    if (!session?.strictNavigation) return true;
    if (!currentQuestion) return false;
    return Number.isInteger(selectedAnswer);
  };

  const handleSaveAndNext = async () => {
    if (inputsDisabled || !questions.length || !currentQuestion) return;
    if (!Number.isInteger(selectedAnswer)) {
      setError('Select an option before moving to the next question.');
      return;
    }

    const targetIndex = navigationState.currentIndex + 1;
    if (!canMoveForwardTo(targetIndex)) {
      return;
    }

    setError('');

    const activeIntent =
      pendingIntentRef.current?.questionId === currentQuestion._id
        ? pendingIntentRef.current
        : setPendingIntent({
            questionIndex: navigationState.currentIndex,
            questionId: currentQuestion._id,
            answerIndex: selectedAnswer,
          });

    if (activeIntent) {
      queueAnswerSave({
        questionIndex: navigationState.currentIndex,
        questionId: currentQuestion._id,
        answerIndex: selectedAnswer,
        intentId: activeIntent.intentId,
        intentSeq: activeIntent.intentSeq,
        timestamp: activeIntent.timestamp,
      });
    }

    dispatchAnswer({ type: 'SET_SAVING', payload: { isSaving: true } });
    const saved = await saveAnswerWithRetry({
      questionIndex: navigationState.currentIndex,
      questionId: currentQuestion._id,
      answerIndex: selectedAnswer,
      intentId: activeIntent?.intentId,
      intentSeq: activeIntent?.intentSeq,
    });
    dispatchAnswer({ type: 'SET_SAVING', payload: { isSaving: false } });

    if (!saved) {
      return;
    }

    saveQueueRef.current.delete(Number(navigationState.currentIndex));

    dispatchNavigation({
      type: 'NEXT',
      payload: {
        maxIndex: questions.length - 1,
      },
    });
  };

  const handlePrevious = async () => {
    if (inputsDisabled || !questions.length) return;
    const canProceed = await ensureNoPendingIntentBeforeNavigation();
    if (!canProceed) return;
    dispatchNavigation({ type: 'PREVIOUS' });
  };

  const handleOptionSelect = (answerIndex) => {
    if (!Number.isInteger(answerIndex) || !currentQuestion || inputsDisabled) return;
    setError('');
    dispatchAnswer({
      type: 'SET_ANSWER',
      payload: {
        questionId: currentQuestion._id,
        answerIndex,
      },
    });

    const pendingIntent = setPendingIntent({
      questionIndex: navigationState.currentIndex,
      questionId: currentQuestion._id,
      answerIndex,
    });

    queueAnswerSave({
      questionIndex: navigationState.currentIndex,
      questionId: currentQuestion._id,
      answerIndex,
      intentId: pendingIntent?.intentId,
      intentSeq: pendingIntent?.intentSeq,
      timestamp: pendingIntent?.timestamp,
    });
  };

  useEffect(() => {
    if (!session || session.status !== 'active' || !questions.length) return undefined;

    const onKeyDown = (event) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleSaveAndNext();
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePrevious();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session, questions.length, navigationState.currentIndex, selectedAnswer, answerState.answers, isSubmitting, timeLeftSec, submitLocked]);

  const behaviorText = session?.strictNavigation
    ? 'Strict navigation enabled: only current question can be answered in sequence.'
    : 'Flexible navigation enabled: use the palette to jump between questions.';

  const modeExplanation = session?.behavior?.modeExplanation ||
    'Exam mode mirrors real test pressure. Practice mode is better for hints and on-the-spot explanations.';

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Exam Simulation</h2>
        <p>Real exam environment with timer, palette, strict test flow, and post-test analysis.</p>

        {!session && (
          <div className="exam-setup-grid">
            <label>
              Exam Type
              <select value={examType} onChange={(e) => setExamType(e.target.value)}>
                <option value="NEET">NEET</option>
                <option value="CET">CET</option>
                <option value="JEE">JEE</option>
              </select>
            </label>

            <label>
              Mode
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="full-length">Full-Length Mock Test</option>
                <option value="section-wise">Section-Wise Test</option>
              </select>
            </label>

            {mode === 'section-wise' && (
              <label>
                Section Subject
                <select value={sectionSubject} onChange={(e) => setSectionSubject(e.target.value)}>
                  {allowedSectionSubjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="exam-toggle-row">
              <input
                type="checkbox"
                checked={strictNavigation}
                onChange={(e) => setStrictNavigation(e.target.checked)}
              />
              Enable strict navigation
            </label>

            <button className="solid-btn" onClick={startSimulation}>Start Exam Simulation</button>
          </div>
        )}
      </section>

      {error && <section className="panel error-text">{error}</section>}
      {restoreNotice && <section className="panel">{restoreNotice}</section>}
      {multiTabWarning && <section className="panel error-text">{multiTabWarning}</section>}
      {tabWarning && <section className="panel error-text">{tabWarning}</section>}
      {answerState.syncWarning && <section className="panel error-text">{answerState.syncWarning}</section>}

      {session?.generationNotice && (
        <section className="panel">
          <p>{session.generationNotice}</p>
        </section>
      )}

      {session && (
        <>
          <section className="panel exam-live-header">
            <div>
              <h3>
                {session.mode === 'full-length' ? 'Full-Length Mock Test' : `${session.sectionSubject} Section Test`}
              </h3>
              <p>{behaviorText}</p>
              <p className="exam-mode-note">{modeExplanation}</p>
            </div>
            <div className={`exam-timer ${timeLeftSec < 300 ? 'danger' : ''}`}>
              <span>Time Left</span>
              <strong>{formatTime(timeLeftSec)}</strong>
            </div>
          </section>

          <section className="panel">
            <div className="exam-meta-row">
              <span>Question {navigationState.currentIndex + 1} / {session.questionCount}</span>
              <span className="progress-pill">Question {navigationState.currentIndex + 1} / {questions.length || session.questionCount}</span>
              <span>Hints: OFF</span>
              <span>Explanations: OFF</span>
              {syncIndicator && <span>{syncIndicator}</span>}
              <span>
                {answerState.saveStatus === 'pending'
                  ? 'Saving...'
                  : answerState.saveStatus === 'failed'
                    ? 'Retry needed'
                    : answerState.saveStatus === 'confirmed'
                      ? 'Saved'
                      : answerState.isSaving
                        ? 'Saving...'
                        : 'All changes synced'}
              </span>
              <span>Last confirmed save: {formatClockTime(currentLastConfirmedAt)}</span>
              {(currentQuestionPending || currentQuestionFailed) && (
                <span className={`progress-pill ${currentQuestionFailed ? 'risk' : 'warning'}`}>
                  {currentQuestionFailed ? 'Unsaved change' : 'Pending save'}
                </span>
              )}
              {answerState.saveStatus === 'failed' && (
                <button
                  className="outline-btn"
                  onClick={flushSaveQueue}
                  disabled={inputsDisabled || answerState.isSaving}
                >
                  Retry Save
                </button>
              )}
            </div>

            <div className="exam-question-card question-transition" key={currentQuestion?._id || navigationState.currentIndex}>
              <h3>{currentQuestion?.subject} • {currentQuestion?.topic}</h3>
              <div className="exam-question-tags">
                <span className={`exam-tag-chip ${currentQuestion?.isPreviousYear ? 'pyq' : 'mock'}`}>
                  {currentQuestion?.isPreviousYear ? 'PYQ Priority' : currentQuestion?.yearTag || 'Mock'}
                </span>
                <span className="exam-tag-chip">{currentQuestion?.difficultyLevel || currentQuestion?.difficulty}</span>
                <span className="exam-tag-chip">{currentQuestion?.weightage || 'Medium'} Weightage</span>
              </div>
              <p className="exam-question-text">{currentQuestion?.text}</p>

              <div className="option-list">
                {(currentQuestion?.options || []).map((option, idx) => (
                  <button
                    key={`${currentQuestion?._id}-${idx}`}
                    className={`option-btn ${selectedAnswer === idx ? 'selected' : ''} ${
                      answerState.pendingByQuestion[currentQuestion?._id] === idx ? 'pending' : ''
                    }`}
                    onClick={() => handleOptionSelect(idx)}
                    disabled={inputsDisabled}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="exam-action-row">
              <button className="outline-btn" onClick={handlePrevious} disabled={inputsDisabled || navigationState.currentIndex === 0}>
                Previous
              </button>
              <button
                className="solid-btn"
                onClick={handleSaveAndNext}
                disabled={
                  inputsDisabled ||
                  answerState.isSaving ||
                  navigationState.currentIndex === questions.length - 1 ||
                  (session.strictNavigation && !Number.isInteger(selectedAnswer))
                }
              >
                {answerState.isSaving ? 'Saving...' : 'Save & Next'}
              </button>
              <button className="outline-btn" onClick={goToFirstUnanswered} disabled={inputsDisabled}>
                Jump to First Unanswered
              </button>
              <button className="outline-btn" onClick={toggleMarkForReview} disabled={inputsDisabled || !currentQuestion}>
                {currentQuestion && metaState.reviewFlags[currentQuestion._id] ? 'Unmark Review' : 'Mark for Review'}
              </button>
              <button className="outline-btn" onClick={submitSimulation} disabled={inputsDisabled}>
                Submit Test
              </button>
            </div>
          </section>

          <section className="panel">
            <h3>Question Palette</h3>
            <div className="palette-grid">
              {questions.map((question, index) => {
                const answered = Boolean(answeredByIndex[index]);
                const marked = Boolean(metaState.reviewFlags[question._id]);
                const visited = Boolean(metaState.visitedQuestions[question._id]);
                const pending = Boolean(answerState.pendingByQuestion[question._id] !== undefined);
                const failed = Boolean(answerState.failedByQuestion[question._id]);
                const confirmed = answered && !pending && !failed;
                const paletteState = failed
                  ? 'Failed'
                  : pending
                    ? 'Pending'
                    : marked
                      ? 'Marked for Review'
                      : confirmed
                        ? 'Answered'
                        : visited
                          ? 'Visited'
                          : 'Not Visited';
                return (
                <button
                  key={question._id || index}
                  className={`palette-btn ${index === navigationState.currentIndex ? 'current' : ''} ${confirmed ? 'answered' : ''} ${visited ? 'visited' : ''} ${!answered && !visited ? 'unanswered' : ''} ${marked ? 'review' : ''} ${pending ? 'pending' : ''} ${failed ? 'failed' : ''}`}
                  onClick={() => goToQuestion(index)}
                  disabled={inputsDisabled}
                >
                  <span className="palette-number">{index + 1}</span>
                  <span className="palette-state">{paletteState}</span>
                  {(pending || failed) && <span className="palette-unsaved">Unsaved</span>}
                  {marked && <span className="palette-review-flag">Review</span>}
                </button>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default ExamSimulationPage;
