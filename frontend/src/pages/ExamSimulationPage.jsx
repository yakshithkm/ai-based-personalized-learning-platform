import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  clearExamSessionAuth,
  getExamSession,
  setExamSessionAuth,
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

const getSessionStorageKey = (sessionId, key) => `exam-session:${sessionId}:${key}`;
const ACTIVE_SESSION_STORAGE_KEY = 'exam-active-session-id';
const TAB_SWITCH_WARNING_LIMIT = 3;
const TAB_LOCK_STALE_MS = 8000;

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

  const [navigationState, dispatchNavigation] = useReducer(navigationReducer, initialNavigationState);
  const [answerState, dispatchAnswer] = useReducer(answerReducer, initialAnswerState);
  const [metaState, dispatchMeta] = useReducer(metaReducer, initialMetaState);

  const saveDebounceRef = useRef(null);
  const saveQueueRef = useRef(new Map());
  const inFlightSavesRef = useRef([]);
  const isSaveInFlightRef = useRef(false);
  const retryTimeoutRef = useRef(null);
  const submitTriggeredRef = useRef(false);
  const serverOffsetMsRef = useRef(0);
  const tabIdRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`);

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
  const selectedAnswer = currentQuestion ? answerState.answers[currentQuestion._id] : null;
  const inputsDisabled =
    !session ||
    session.status !== 'active' ||
    timeLeftSec <= 0 ||
    isSubmitting ||
    answerState.isSaving ||
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

  const waitMs = (ms) => new Promise((resolve) => {
    retryTimeoutRef.current = setTimeout(resolve, ms);
  });

  const saveAnswerWithRetry = async ({ questionIndex, questionId, answerIndex, allowRateRetry = true }) => {
    if (!session?.sessionId) return false;

    console.log('[exam-save] outgoing-auth', {
      questionIndex,
      nonce: 'managed-by-wrapper',
      hasToken: true,
    });

    try {
      const response = await submitExamAnswer({
        sessionId: session.sessionId,
        payload: {
          questionIndex,
          questionId,
          selectedAnswerIndex: answerIndex,
          timeTakenSec: 0,
        },
      });

      if (response?.aborted) {
        console.log('[exam-save] ignored-aborted-response', {
          questionIndex,
          requestId: response.requestId,
        });
        return false;
      }

      const { data } = response;

      console.log('[exam-save] incoming-auth', {
        questionIndex,
        nonce: data?.requestNonce,
      });

      setSession(data);
      dispatchAnswer({
        type: 'SET_SYNC_WARNING',
        payload: {
          hasPendingSync: false,
          message: '',
        },
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
        setSession(null);
      } else if (status === 409) {
        try {
          const data = await getExamSession(session.sessionId);
          setSession(data);
          setError('Session was refreshed due to request conflict. Retry your action.');
        } catch (refreshError) {
          setError('Session conflict detected and state refresh failed. Please reload.');
        }
      } else if (status === 429 && allowRateRetry) {
        setError('Rate limit reached. Retrying answer save...');
        await waitMs(1200);
        return saveAnswerWithRetry({ questionIndex, questionId, answerIndex, allowRateRetry: false });
      } else {
        setError(requestError?.response?.data?.message || 'Failed to save answer.');
      }

      dispatchAnswer({
        type: 'SET_SYNC_WARNING',
        payload: {
          hasPendingSync: true,
          message: 'Answer sync failed. Please retry.',
        },
      });
      return false;
    }
  };

  const flushPendingSave = async () => {
    if (!session || session.status !== 'active') return true;
    if (isSaveInFlightRef.current) return false;
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }

    const entries = Array.from(saveQueueRef.current.entries()).map(([questionIndex, answerIndex]) => ({
      questionIndex: Number(questionIndex),
      answerIndex,
    }));
    saveQueueRef.current.clear();

    if (!entries.length) return true;
    dispatchAnswer({ type: 'SET_SAVING', payload: { isSaving: true } });
    isSaveInFlightRef.current = true;
    console.log('[exam-save] flushing-queue', { size: entries.length });

    const outcomes = [];
    for (const entry of entries) {
      const questionId = questions[entry.questionIndex]?._id;
      const savePromise = saveAnswerWithRetry({ ...entry, questionId });
      inFlightSavesRef.current.push(savePromise);
      const success = await savePromise;
      outcomes.push(success);
      inFlightSavesRef.current = inFlightSavesRef.current.filter((promise) => promise !== savePromise);
      if (!success) {
        break;
      }
    }
    isSaveInFlightRef.current = false;
    dispatchAnswer({ type: 'SET_SAVING', payload: { isSaving: false } });

    return outcomes.every(Boolean);
  };

  const queueAnswerSave = (questionIndex, answerIndex) => {
    saveQueueRef.current.set(Number(questionIndex), answerIndex);
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
      return;
    }

    setExamSessionAuth({
      sessionId: session.sessionId,
      sessionToken: session.sessionToken,
      requestNonce: session.requestNonce,
    });

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
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    },
    []
  );

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
      setSession(data);
      setTimeLeftSec(Number(data.timeLeftSec || data.timeLimitSec || 0));
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, data.sessionId);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to start exam simulation.');
    }
  };

  const goToQuestion = (index) => {
    console.log('[exam-nav] attempt', {
      from: navigationState.currentIndex,
      to: index,
      strict: Boolean(session?.strictNavigation),
    });

    if (inputsDisabled) return;
    if (index < 0 || index >= questions.length) return;
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

    dispatchAnswer({ type: 'SET_SAVING', payload: { isSaving: true } });
    const saved = await saveAnswerWithRetry({
      questionIndex: navigationState.currentIndex,
      questionId: currentQuestion._id,
      answerIndex: selectedAnswer,
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

  const handlePrevious = () => {
    if (inputsDisabled || !questions.length) return;
    dispatchNavigation({ type: 'PREVIOUS' });
  };

  const handleOptionSelect = (answerIndex) => {
    if (!Number.isInteger(answerIndex) || !currentQuestion || inputsDisabled) return;
    dispatchAnswer({
      type: 'SET_ANSWER',
      payload: {
        questionId: currentQuestion._id,
        answerIndex,
      },
    });

    queueAnswerSave(navigationState.currentIndex, answerIndex);
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
              <span>{answerState.isSaving ? 'Saving...' : 'All changes synced'}</span>
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
                    className={`option-btn ${selectedAnswer === idx ? 'selected' : ''}`}
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
                const paletteState = marked
                  ? 'Marked for Review'
                  : answered
                    ? 'Answered'
                    : visited
                      ? 'Visited'
                      : 'Not Visited';
                return (
                <button
                  key={question._id || index}
                  className={`palette-btn ${index === navigationState.currentIndex ? 'current' : ''} ${answered ? 'answered' : ''} ${visited ? 'visited' : ''} ${!answered && !visited ? 'unanswered' : ''} ${marked ? 'review' : ''}`}
                  onClick={() => goToQuestion(index)}
                  disabled={inputsDisabled}
                >
                  <span className="palette-number">{index + 1}</span>
                  <span className="palette-state">{paletteState}</span>
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
