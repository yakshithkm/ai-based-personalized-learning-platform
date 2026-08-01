import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
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

const formatClockTime = (value) => {
  if (!value) return '--:--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
};

const buildConfirmedIntentSeqByQuestion = (intentLedger = {}) =>
  Object.entries(intentLedger || {}).reduce((acc, [questionId, ledger]) => {
    acc[questionId] = Number(ledger?.lastAcceptedIntentSeq || 0);
    return acc;
  }, {});

const getSessionStorageKey = (sessionId, key) => `exam-session:${sessionId}:${key}`;
const ACTIVE_SESSION_STORAGE_KEY = 'exam-active-session-id';
const PENDING_INTENT_STORAGE_KEY = (sessionId) => getSessionStorageKey(sessionId, 'pendingIntent');
const TAB_SWITCH_WARNING_LIMIT = 3;
const TAB_LOCK_STALE_MS = 8000;
const MAX_RETRIES = 2;
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
  isSaving: false,
  hasPendingSync: false,
  syncWarning: '',
  pendingByQuestion: {},
  failedByQuestion: {},
  lastConfirmedAtByQuestion: {},
  lastConfirmedIntentSeqByQuestion: {},
  saveStatus: 'idle',
};

const answerReducer = (state, action) => {
  switch (action.type) {
    case 'RESET':
      return initialAnswerState;
    case 'INIT_CONFIRMED_INTENT_SEQ':
      return {
        ...state,
        lastConfirmedIntentSeqByQuestion: action.payload.intentSeqByQuestion || {},
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
    case 'SET_LAST_CONFIRMED_INTENT_SEQ':
      return {
        ...state,
        lastConfirmedIntentSeqByQuestion: {
          ...state.lastConfirmedIntentSeqByQuestion,
          [action.payload.questionId]: Number(action.payload.intentSeq || 0),
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

const QuestionPalette = memo(function QuestionPalette({
  questions,
  currentIndex,
  answeredByIndex,
  reviewFlags,
  visitedQuestions,
  pendingByQuestion,
  failedByQuestion,
  disabled,
  onSelect,
}) {
  return (
    <div className="palette-grid">
      {questions.map((question, index) => {
        const answered = Boolean(answeredByIndex[index]);
        const marked = Boolean(reviewFlags[question._id]);
        const visited = Boolean(visitedQuestions[question._id]);
        const pending = Boolean(pendingByQuestion[question._id]);
        const failed = Boolean(failedByQuestion[question._id]);
        const paletteState = marked
          ? 'Marked for Review'
          : pending
            ? 'Pending'
            : failed
              ? 'Failed'
              : answered
            ? 'Answered'
            : visited
              ? 'Visited'
              : 'Not Visited';
        const statusClass = pending
          ? 'pending'
          : failed
            ? 'failed'
            : visited
              ? 'visited'
              : 'unanswered';
        return (
          <button
            key={question._id || index}
            className={`palette-btn ${index === currentIndex ? 'current' : ''} ${answered ? 'answered' : ''} ${marked ? 'review' : ''} ${statusClass}`}
            onClick={() => onSelect(index)}
            disabled={disabled}
          >
            <span className="palette-number">{index + 1}</span>
            <span className="palette-state">{paletteState}</span>
            {marked && <span className="palette-review-flag">Review</span>}
          </button>
        );
      })}
    </div>
  );
});

const ExamSimulationPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDevMode = Boolean(import.meta.env.DEV);
  const userExam = (user?.targetExam || user?.exam || 'NEET').trim().toUpperCase();

  const [mode, setMode] = useState('full-length');
  const [examType, setExamType] = useState(userExam || 'NEET');
  const [sectionSubject, setSectionSubject] = useState('Physics');
  const [strictNavigation, setStrictNavigation] = useState(true);

  const [session, setSession] = useState(null);
  const [timeLeftSec, setTimeLeftSec] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [uiLocked, setUiLocked] = useState(false);
  const [error, setError] = useState('');
  const [tabWarning, setTabWarning] = useState('');
  const [restoreNotice, setRestoreNotice] = useState('');
  const [multiTabWarning, setMultiTabWarning] = useState('');
  const [isSecondaryTab, setIsSecondaryTab] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [mismatchCount, setMismatchCount] = useState(0);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  const [navigationState, dispatchNavigation] = useReducer(navigationReducer, initialNavigationState);
  const [answerState, dispatchAnswer] = useReducer(answerReducer, initialAnswerState);
  const [metaState, dispatchMeta] = useReducer(metaReducer, initialMetaState);

  const saveDebounceRef = useRef(null);
  const saveQueueRef = useRef(new Map());
  const inFlightSavesRef = useRef([]);
  const isSavingRef = useRef(false);
  const initializedRef = useRef(false);
  const retryCountRef = useRef(new Map()); // Track retries per questionId
  const [selectedOptionMap, setSelectedOptionMap] = useState({});
  const [confirmedOptionMap, setConfirmedOptionMap] = useState({});
  const [cooldownMap, setCooldownMap] = useState({});
  const [saveErrorByQuestion, setSaveErrorByQuestion] = useState({});
  const submitTriggeredRef = useRef(false);
  const serverOffsetMsRef = useRef(0);
  const tabIdRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const latestVersionRef = useRef(0);

  const dedupeSessionQuestions = (incomingSession, source = 'unknown') => {
    if (!incomingSession || !Array.isArray(incomingSession.questions)) return incomingSession;
    const seen = new Set();
    const duplicates = [];
    const deduped = [];
    for (let i = 0; i < incomingSession.questions.length; i += 1) {
      const q = incomingSession.questions[i];
      const id = q && (q._id || q.id || q.questionId || q.question);
      const key = String(id || '');
      if (!key) continue;
      if (seen.has(key)) {
        duplicates.push(key);
        continue;
      }
      seen.add(key);
      deduped.push(q);
    }
    if (duplicates.length) {
      console.warn('[QUESTION DUPLICATE DETECTED]', {
        duplicates: Array.from(new Set(duplicates)),
        currentQuestionIndex: Number(incomingSession.currentQuestionIndex || 0),
        source,
      });
    }
    // If deduped length changed, create a shallow copy with adjusted metadata
    if (deduped.length !== incomingSession.questions.length) {
      const copy = { ...incomingSession };
      copy.questions = deduped;
      // Remap responses to new question indices to preserve alignment
      const originalQuestions = incomingSession.questions || [];
      const idToNewIndex = {};
      for (let i = 0; i < deduped.length; i += 1) {
        const q = deduped[i];
        const id = String(q._id || q.id || q.question || '');
        idToNewIndex[id] = i;
      }
      const newResponses = (incomingSession.responses || []).map((entry) => {
        const origQ = originalQuestions[Number(entry.questionIndex)];
        const origId = origQ && String(origQ._id || origQ.id || origQ.question || '');
        const mappedIndex = Number.isInteger(idToNewIndex[origId]) ? idToNewIndex[origId] : entry.questionIndex;
        return {
          ...entry,
          questionIndex: mappedIndex,
        };
      });
      copy.responses = newResponses;
      // Keep questionCount consistent with deduped questions
      copy.questionCount = deduped.length;
      const origCurrent = Number(incomingSession.currentQuestionIndex || 0);
      const origCurrentQ = originalQuestions[origCurrent];
      const origCurrentId = origCurrentQ && String(origCurrentQ._id || origCurrentQ.id || origCurrentQ.question || '');
      if (Object.prototype.hasOwnProperty.call(idToNewIndex, origCurrentId)) {
        copy.currentQuestionIndex = idToNewIndex[origCurrentId];
      } else if (Number(copy.currentQuestionIndex) >= deduped.length) {
        copy.currentQuestionIndex = Math.max(0, deduped.length - 1);
      }
      return copy;
    }
    return incomingSession;
  };
  const pendingAnswerRef = useRef(null);
  const pendingQuestionIdRef = useRef('');
  const pendingIntentRef = useRef(null);
  const latestIntentByQuestionRef = useRef(new Map());
  const latestIntentSeqByQuestionRef = useRef(new Map());
  const inFlightIntentMapRef = useRef(new Map());
  // Key: questionId, Value: Promise for active submit request.
  const inFlightRequestMapRef = useRef(new Map());
  const savingQuestionIdRef = useRef(''); // question-scoped saving lock
  const pendingIntentRecoveryAttemptedRef = useRef(''); // sessionId already checked for a crash-recovered answer

  const syncPendingRequestCount = () => {
    setPendingRequestCount(inFlightIntentMapRef.current.size);
  };

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
          // no active session to restore
        }
      }

      if (!restored) return;

      const serverNowMs = new Date(restored.serverNow || Date.now()).getTime();
      serverOffsetMsRef.current = serverNowMs - Date.now();

      if (restored.status !== 'active') {
        localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
        redirectToResultPage(restored, restored.resultSummary);
        return;
      }

      const remaining = computeRemainingSec(restored, serverOffsetMsRef.current);
      if (remaining <= 0) {
        try {
          const { data } = await api.post(`/exams/sessions/${restored.sessionId}/submit`);
          localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
          redirectToResultPage(restored, data);
          return;
        } catch (submitError) {
          setError('Session expired during restore and auto-submit failed. Please retry.');
          return;
        }
      }

      setExamSessionAuth({
        sessionId: restored.sessionId,
        sessionToken: restored.sessionToken,
        requestNonce: restored.requestNonce,
      });
      latestVersionRef.current = Number(restored.version || latestVersionRef.current || 0);
      setLatestVersion(latestVersionRef.current);
      setRestoreNotice('Your exam session was restored. Timer resumed.');
      setSession(dedupeSessionQuestions(restored, 'restore/init'));
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
        const synced = await flushPendingSave();
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
  const selectedAnswer = currentQuestion ? selectedOptionMap[currentQuestion._id] : null;
  const confirmedAnswer = currentQuestion ? confirmedOptionMap[currentQuestion._id] : null;
  const cooldownByQuestion = cooldownMap;
  const currentQuestionCooldown = currentQuestion ? cooldownByQuestion[currentQuestion._id] || 0 : 0;
  const currentQuestionLastConfirmedAt = currentQuestionId
    ? answerState.lastConfirmedAtByQuestion[currentQuestionId]
    : '';
  const currentQuestionLastConfirmedIntentSeq = currentQuestionId
    ? Number(answerState.lastConfirmedIntentSeqByQuestion[currentQuestionId] || 0)
    : 0;
  const currentQuestionPending = Boolean(currentQuestionId && answerState.pendingByQuestion[currentQuestionId]);
  const currentQuestionFailed = Boolean(currentQuestionId && answerState.failedByQuestion[currentQuestionId]);
  const currentQuestionSaving = Boolean(currentQuestionId && savingQuestionIdRef.current === currentQuestionId);

  useEffect(() => {
    setSaveErrorByQuestion({});
  }, [currentQuestionId]);

  const inputsDisabled =
    !session ||
    session.status !== 'active' ||
    timeLeftSec <= 0 ||
    isSubmitting ||
    isReconciling ||
    uiLocked ||
    submitLocked ||
    isSecondaryTab;

  const getAnswerByIndex = (index) => {
    const question = questions[index];
    if (!question) return undefined;
    return selectedOptionMap[question._id];
  };

  const canMoveForwardTo = (targetIndex) => {
    if (!session?.strictNavigation) return true;
    if (targetIndex <= navigationState.currentIndex) return true;

    for (let idx = navigationState.currentIndex; idx < targetIndex; idx += 1) {
      if (!Number.isInteger(getAnswerByIndex(idx))) {
        return false;
      }
    }
    return true;
  };

  const goToNextQuestion = () => {
    dispatchNavigation({
      type: 'NEXT',
      payload: {
        maxIndex: questions.length - 1,
      },
    });
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
    syncPendingRequestCount();
    return pendingIntentRef.current;
  };

  const clearPendingIntent = ({ questionId }) => {
    if (!session?.sessionId) return;
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
    syncPendingRequestCount();
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
  }) => {
    const backendVersion = Number(backendSession?.version || 0);
    if (Number.isInteger(backendVersion) && backendVersion > 0) {
      latestVersionRef.current = Math.max(latestVersionRef.current, backendVersion);
      setLatestVersion(latestVersionRef.current);
    }

    const backendAnswers = buildAnswerMapFromSessionState(backendSession);

    setConfirmedOptionMap(backendAnswers);
    dispatchAnswer({
      type: 'INIT_CONFIRMED_INTENT_SEQ',
      payload: {
        intentSeqByQuestion: buildConfirmedIntentSeqByQuestion(backendSession?.intentLedger),
      },
    });

    const backendIndex = Number(backendSession?.currentQuestionIndex);
    if (Number.isInteger(backendIndex)) {
      dispatchNavigation({
        type: 'SET_INDEX',
        payload: { index: backendIndex },
      });
    }

    const hardMismatchEntries = Object.entries(backendAnswers).filter(([questionId, backendSavedAnswer]) => {
      const localAnswer = selectedOptionMap[questionId];
      return Number.isInteger(backendSavedAnswer) && backendSavedAnswer !== localAnswer;
    });

    if (hardMismatchEntries.length) {
      hardMismatchEntries.forEach(([questionId, backendSavedAnswer]) => {
        void backendSavedAnswer;
      });
      setMismatchCount((count) => count + hardMismatchEntries.length);
      setSelectedOptionMap((prev) => {
        const next = { ...prev };
        hardMismatchEntries.forEach(([questionId, backendSavedAnswer]) => {
          next[questionId] = backendSavedAnswer;
        });
        return next;
      });
    }

    setSession(dedupeSessionQuestions(backendSession, 'reconcile'));
  };

  const forceFullSessionRefetch = async ({
    reason,
    questionId,
    expectedAnswerIndex,
  }) => {
    if (!session?.sessionId) return false;
    setUiLocked(true);
    setIsReconciling(true);
    try {
      const refreshed = await getExamSession(session.sessionId);
      reconcileStateWithBackend({
        backendSession: refreshed,
      });
      dispatchAnswer({
        type: 'SET_SYNC_WARNING',
        payload: {
          hasPendingSync: false,
          message: '',
        },
      });
      return true;
    } catch (error) {
      setError('Hard sync failed. Please reload the exam.');
      return false;
    } finally {
      setIsReconciling(false);
      setUiLocked(false);
    }
  };

  const forceRefetchSession = forceFullSessionRefetch;

  // Single-flight: if a save is already in progress for this question, reuse it instead
  // of firing a duplicate request.
  const submitAnswerSingleFlight = async (questionId, submitPayload) => {
    const existing = inFlightRequestMapRef.current.get(questionId);
    if (existing) {
      return existing;
    }

    const requestPromise = (async () => {
      try {
        const result = await submitExamAnswer(submitPayload);
        return result;
      } catch (error) {
        throw error;
      } finally {
        inFlightRequestMapRef.current.delete(questionId);
      }
    })();

    inFlightRequestMapRef.current.set(questionId, requestPromise);
    return requestPromise;
  };

  const saveAnswerWithRetry = async ({ questionIndex, questionId, answerIndex, intentId, intentSeq }) => {
    if (!session?.sessionId) return false;

    // Acquire question-scoped saving lock immediately to prevent further local mutations
    savingQuestionIdRef.current = questionId;

    const currentIntentId = String(intentId || '');
    const currentIntentSeq = Number(intentSeq || 0);
    const currentVersion = Number(latestVersionRef.current || 0);

    const latestIntentId = latestIntentByQuestionRef.current.get(questionId);
    const latestIntentSeq = Number(latestIntentSeqByQuestionRef.current.get(questionId) || 0);
    if (!latestIntentId || latestIntentId !== intentId || Number(intentSeq) !== latestIntentSeq) {
      setMismatchCount((count) => count + 1);
      await forceRefetchSession({
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
          message: 'Failed to save. Please try again.',
        },
      });
      dispatchAnswer({
        type: 'SET_FAILED_QUESTION',
        payload: { questionId, failed: true },
      });
      dispatchAnswer({ type: 'SET_SAVE_STATUS', payload: { status: 'failed' } });
      return false;
    }

    dispatchAnswer({ type: 'SET_SAVE_STATUS', payload: { status: 'pending' } });

    try {
      const response = await submitAnswerSingleFlight(questionId, {
        sessionId: session.sessionId,
        payload: {
          questionIndex,
          questionId,
          selectedAnswerIndex: answerIndex,
          timeTakenSec: 0,
          intentId,
          intentSeq,
        },
      });

      if (response?.aborted) {
        return false;
      }

      let backendSession = response.data;
      const backendIntentId = String(backendSession?.intentId || '');
      const backendIntentSeq = Number(backendSession?.intentSeq || 0);
      const responseVersion = Number(backendSession?.version || 0);
      const responseMatchesIntent =
        backendIntentId === currentIntentId &&
        Number.isInteger(backendIntentSeq) &&
        backendIntentSeq === currentIntentSeq &&
        Number.isInteger(responseVersion) &&
        responseVersion >= currentVersion;

      if (!responseMatchesIntent) {
        setMismatchCount((count) => count + 1);
        await forceRefetchSession({
          reason: 'response-validation-mismatch',
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
        setIsReconciling(true);
        backendSession = await getExamSession(session.sessionId);
      }

      setIsReconciling(true);
      reconcileStateWithBackend({
        backendSession,
      });
      dispatchAnswer({
        type: 'SET_LAST_CONFIRMED_INTENT_SEQ',
        payload: {
          questionId,
          intentSeq: currentIntentSeq,
        },
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
      setSaveErrorByQuestion((prev) => {
        if (!prev[questionId]) return prev;
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
      setConfirmedOptionMap((prev) => ({
        ...prev,
        [questionId]: answerIndex,
      }));

      retryCountRef.current.delete(questionId);
      return true;
    } catch (requestError) {
      const status = Number(requestError?.response?.status || 0);
      const currentRetries = retryCountRef.current.get(questionId) || 0;

      if (status === 401) {
        setError('Session authentication failed. Restarting exam session is required.');
        clearExamSessionAuth();
        setSession(null);
      } else if (status === 429) {
        // Rate limit: activate cooldown, NO auto-retry
        setError('Too many attempts. Please wait.');
        setSaveErrorByQuestion((prev) => ({
          ...prev,
          [questionId]: true,
        }));
        setCooldownMap((prev) => ({
          ...prev,
          [questionId]: 3,
        }));

        // Start cooldown countdown
        const cooldownInterval = setInterval(() => {
          setCooldownMap((prev) => {
            const next = prev[questionId] - 1;
            if (next <= 0) {
              clearInterval(cooldownInterval);
              const newMap = { ...prev };
              delete newMap[questionId];
              return newMap;
            }
            return {
              ...prev,
              [questionId]: next,
            };
          });
        }, 1000);
      } else if (status === 409) {
        setMismatchCount((count) => count + 1);
        try {
          setIsReconciling(true);
          const data = await getExamSession(session.sessionId);
          latestVersionRef.current = Math.max(latestVersionRef.current, Number(data?.version || 0));
          setLatestVersion(latestVersionRef.current);
          reconcileStateWithBackend({
            backendSession: data,
          });
          setError('Session state mismatch detected. State refreshed.');
          setSaveErrorByQuestion((prev) => {
            if (!prev[questionId]) return prev;
            const next = { ...prev };
            delete next[questionId];
            return next;
          });
        } catch (refreshError) {
          setError('Save failed and state refresh failed. Please reload the exam.');
        }
      } else {
        setError(requestError?.response?.data?.message || 'Failed to save. Please try again.');
        setSaveErrorByQuestion((prev) => ({
          ...prev,
          [questionId]: true,
        }));
      }

      dispatchAnswer({
        type: 'SET_FAILED_QUESTION',
        payload: { questionId, failed: true },
      });
      dispatchAnswer({ type: 'SET_SAVE_STATUS', payload: { status: 'failed' } });
      return false;
    } finally {
      const inFlight = inFlightIntentMapRef.current.get(questionId);
      if (inFlight?.intentId === intentId) {
        inFlightIntentMapRef.current.delete(questionId);
      }
      if (pendingIntentRef.current?.questionId === questionId) {
        clearPendingIntent({ questionId });
      } else {
        dispatchAnswer({
          type: 'CLEAR_PENDING_ANSWER',
          payload: { questionId },
        });
      }
      syncPendingRequestCount();
      setIsReconciling(false);
      // Release question-scoped saving lock when this save completes (success or failure)
      if (savingQuestionIdRef.current === questionId) {
        savingQuestionIdRef.current = '';
      }
    }
  };

  const flushPendingSave = async () => {
    if (!session || session.status !== 'active') return true;
    if (isSavingRef.current) return false;
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }

    const entries = Array.from(saveQueueRef.current.entries()).map(([questionIndex, queuedPayload]) => ({
      questionIndex: Number(questionIndex),
      ...queuedPayload,
    }));
    saveQueueRef.current.clear();

    isSavingRef.current = true;
    dispatchAnswer({ type: 'SET_SAVING', payload: { isSaving: true } });
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
        break;
      }
    }
    isSavingRef.current = false;
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
        acc[index] = Number.isInteger(selectedOptionMap[question._id]);
        return acc;
      }, {}),
    [questions, selectedOptionMap]
  );

  useEffect(() => {
    if (!session?.sessionId) {
      clearExamSessionAuth();
      dispatchNavigation({ type: 'RESET' });
      dispatchAnswer({ type: 'RESET' });
      dispatchMeta({ type: 'RESET' });
      submitTriggeredRef.current = false;
      setSubmitLocked(false);
      setUiLocked(false);
      setMismatchCount(0);
      setPendingRequestCount(0);
      setShowDebugPanel(false);
      pendingAnswerRef.current = null;
      pendingQuestionIdRef.current = '';
      pendingIntentRef.current = null;
      latestIntentByQuestionRef.current.clear();
      latestIntentSeqByQuestionRef.current.clear();
      inFlightIntentMapRef.current.forEach((entry) => entry?.controller?.abort?.());
      inFlightIntentMapRef.current.clear();
      inFlightRequestMapRef.current.clear();
      retryCountRef.current.clear();
      setSelectedOptionMap({});
      setConfirmedOptionMap({});
      setCooldownMap({});
      setSaveErrorByQuestion({});
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

    if (!initializedRef.current) {
      initializedRef.current = true;
      setSelectedOptionMap(storedAnswers);
      setConfirmedOptionMap(serverAnswerMap);
      dispatchAnswer({
        type: 'INIT_CONFIRMED_INTENT_SEQ',
        payload: {
          intentSeqByQuestion: buildConfirmedIntentSeqByQuestion(session.intentLedger),
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

      dispatchNavigation({ type: 'SET_INDEX', payload: { index: restoredIndex } });
      syncPendingRequestCount();
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
    localStorage.setItem(getSessionStorageKey(session.sessionId, 'answers'), JSON.stringify(selectedOptionMap));
  }, [selectedOptionMap, session?.sessionId]);

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

  // Recover an answer that was queued/in-flight when the tab was closed, refreshed, or
  // crashed. `setPendingIntent`/`persistPendingIntentSnapshot` already write a snapshot to
  // localStorage before every save attempt, but nothing previously read it back on load,
  // so the answer was silently dropped even though the recovery data existed on disk.
  useEffect(() => {
    if (!session?.sessionId || session.status !== 'active') return;
    if (pendingIntentRecoveryAttemptedRef.current === session.sessionId) return;
    pendingIntentRecoveryAttemptedRef.current = session.sessionId;

    const storageKey = PENDING_INTENT_STORAGE_KEY(session.sessionId);
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;

    let snapshot = null;
    try {
      snapshot = JSON.parse(raw);
    } catch (parseError) {
      localStorage.removeItem(storageKey);
      return;
    }

    const questionIndex = Number(snapshot?.questionIndex);
    if (!snapshot || !snapshot.questionId || !Number.isInteger(questionIndex) || !Number.isInteger(snapshot.answerIndex)) {
      localStorage.removeItem(storageKey);
      return;
    }

    // If the original request actually reached the server before the tab died, the
    // answer is already in the restored session - nothing to recover, just clean up.
    const alreadySaved = (session.responses || []).some((entry) => entry.questionIndex === questionIndex);
    if (alreadySaved) {
      localStorage.removeItem(storageKey);
      return;
    }

    setRestoreNotice('Recovering an answer that was not confirmed before the exam session closed...');
    setPendingIntent({
      questionIndex,
      questionId: snapshot.questionId,
      answerIndex: snapshot.answerIndex,
      intentId: snapshot.intentId,
      intentSeq: snapshot.intentSeq,
      timestamp: snapshot.timestamp,
    });
    queueAnswerSave({
      questionIndex,
      questionId: snapshot.questionId,
      answerIndex: snapshot.answerIndex,
      intentId: snapshot.intentId,
      intentSeq: snapshot.intentSeq,
      timestamp: snapshot.timestamp,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setSession(dedupeSessionQuestions(data, 'create/init'));
      setTimeLeftSec(Number(data.timeLeftSec || data.timeLimitSec || 0));
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, data.sessionId);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to start exam simulation.');
    }
  };

  const ensureNoPendingIntentBeforeNavigation = async () => true;

  const goToQuestion = useCallback(
    async (index) => {
      if (inputsDisabled) return;
      if (currentQuestionSaving) return;
      if (index < 0 || index >= questions.length) return;
      await ensureNoPendingIntentBeforeNavigation();
      dispatchNavigation({
        type: 'SET_INDEX',
        payload: { index },
      });
    },
    [inputsDisabled, currentQuestionSaving, questions.length]
  );

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
      const synced = await flushPendingSave();
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

  const canGoNext = () => {
    if (!session?.strictNavigation) return true;
    if (!currentQuestion) return false;
    return Number.isInteger(selectedAnswer);
  };

  const handleSaveAndNext = async () => {
    if (inputsDisabled || !questions.length || !currentQuestion) return;
    if (currentQuestionSaving) return;
    if (inFlightRequestMapRef.current.has(currentQuestion._id)) {
      // save already in-flight for this question - ignored
      return;
    }
    if (!Number.isInteger(selectedAnswer)) {
      setError('Select an option before moving to the next question.');
      return;
    }

    const isAlreadyConfirmed =
      Number.isInteger(selectedAnswer) &&
      Number.isInteger(confirmedAnswer) &&
      selectedAnswer === confirmedAnswer;

    if (isAlreadyConfirmed) {
      goToNextQuestion();
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

    saveQueueRef.current.delete(Number(navigationState.currentIndex));
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }

    dispatchAnswer({ type: 'SET_SAVING', payload: { isSaving: true } });
    isSavingRef.current = true;
    const saved = await saveAnswerWithRetry({
      questionIndex: navigationState.currentIndex,
      questionId: currentQuestion._id,
      answerIndex: selectedAnswer,
      intentId: activeIntent?.intentId,
      intentSeq: activeIntent?.intentSeq,
    });
    isSavingRef.current = false;
    dispatchAnswer({ type: 'SET_SAVING', payload: { isSaving: false } });

    // Clear again in case anything re-queued a debounced save for this question while
    // the explicit attempt above was in flight.
    saveQueueRef.current.delete(Number(navigationState.currentIndex));
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }

    if (!saved) {
      return;
    }

    goToNextQuestion();
  };

  const handlePrevious = async () => {
    if (inputsDisabled || !questions.length) return;
    if (currentQuestionSaving) return;
    const canProceed = await ensureNoPendingIntentBeforeNavigation();
    if (!canProceed) return;
    dispatchNavigation({ type: 'PREVIOUS' });
  };

  const handleOptionSelect = (answerIndex) => {
    if (!Number.isInteger(answerIndex) || !currentQuestion || inputsDisabled) return;
    setError('');
    const questionId = currentQuestion._id;
    // Ignore option clicks for question currently saving
    if (currentQuestionSaving) {
      // save already in-flight for this question - ignore the click
      return;
    }
    if (selectedOptionMap[questionId] === answerIndex) {
      goToNextQuestion();
      return;
    }

    setSaveErrorByQuestion((prev) => {
      if (!prev[questionId]) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    
    // Update selection map (only one per question)
    setSelectedOptionMap((prev) => ({
      ...prev,
      [questionId]: answerIndex,
    }));
    
    const pendingIntent = setPendingIntent({
      questionIndex: navigationState.currentIndex,
      questionId,
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
  }, [session, questions.length, navigationState.currentIndex, selectedAnswer, selectedOptionMap, isSubmitting, timeLeftSec, submitLocked]);

  const behaviorText = session?.strictNavigation
    ? 'Strict navigation enabled: only current question can be answered in sequence.'
    : 'Flexible navigation enabled: use the palette to jump between questions.';

  const modeExplanation = session?.behavior?.modeExplanation ||
    'Exam mode mirrors real test pressure. Practice mode is better for hints and on-the-spot explanations.';

  const currentDebugIntentSeq = currentQuestionId
    ? Number(latestIntentSeqByQuestionRef.current.get(currentQuestionId) || 0)
    : 0;
  const currentDebugLastConfirmedIntentSeq = currentQuestionId
    ? Number(answerState.lastConfirmedIntentSeqByQuestion[currentQuestionId] || 0)
    : 0;

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
              <span className="checkbox-custom" aria-hidden="true" />
              <span className="exam-toggle-label">Enable strict navigation</span>
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
      {uiLocked && <section className="panel exam-resync-indicator">Resyncing...</section>}

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

          {/* Debug panel removed */}

          <section className="panel">
            <div className="exam-meta-row">
              <span>Question {navigationState.currentIndex + 1} / {session.questionCount}</span>
              <span className="progress-pill">Question {navigationState.currentIndex + 1} / {questions.length || session.questionCount}</span>
              <span>Hints: OFF</span>
              <span>Explanations: OFF</span>
              <span>Last confirmed save: {formatClockTime(currentQuestionLastConfirmedAt)}</span>
              {uiLocked && <span className="exam-resync-badge">Resyncing...</span>}
              <span>
                {answerState.saveStatus === 'pending'
                  ? 'Saving...'
                  : answerState.saveStatus === 'failed'
                    ? 'Failed'
                    : answerState.saveStatus === 'confirmed'
                      ? 'Saved'
                      : answerState.isSaving
                        ? 'Saving...'
                        : 'Ready'}
              </span>
            </div>

            <div className="exam-question-card question-transition" key={currentQuestion?._id || navigationState.currentIndex}>
              <h3><span>{currentQuestion?.subject}</span> • <span>{currentQuestion?.topic}</span></h3>
              <p className="exam-question-state-line">
                {currentQuestionPending
                  ? 'Pending'
                  : currentQuestionFailed
                    ? 'Failed'
                    : Number.isInteger(selectedAnswer)
                      ? 'Selected'
                      : 'Not visited'}
              </p>
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
                    className={(() => {
                      const isSelected = selectedOptionMap[currentQuestion?._id] === idx;
                      const showSaveFailure = Boolean(saveErrorByQuestion[currentQuestion?._id]) && isSelected;
                      const showCooldown = Boolean(cooldownMap[currentQuestion?._id]) && isSelected;
                      const isSavingQuestion = savingQuestionIdRef.current === currentQuestion?._id;
                      return `option-btn ${showSaveFailure || showCooldown ? 'failed' : isSelected ? 'selected' : ''}${isSavingQuestion && isSelected ? ' saving' : ''}`;
                    })()}
                    onClick={() => handleOptionSelect(idx)}
                    disabled={inputsDisabled || (savingQuestionIdRef.current === currentQuestion?._id)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="exam-action-row">
              <button
                className="outline-btn"
                onClick={handlePrevious}
                disabled={inputsDisabled || currentQuestionSaving || navigationState.currentIndex === 0}
              >
                Previous
              </button>
              <button
                className="solid-btn"
                onClick={handleSaveAndNext}
                disabled={
                  inputsDisabled ||
                  currentQuestionSaving ||
                  answerState.isSaving ||
                  currentQuestionCooldown > 0 ||
                  navigationState.currentIndex === questions.length - 1 ||
                  (session.strictNavigation && !Number.isInteger(selectedAnswer))
                }
              >
                {currentQuestionCooldown > 0
                  ? `Wait ${currentQuestionCooldown}s`
                  : answerState.isSaving
                    ? 'Saving...'
                    : 'Save & Next'}
              </button>
              <button className="outline-btn" onClick={goToFirstUnanswered} disabled={inputsDisabled || currentQuestionSaving}>
                Jump to First Unanswered
              </button>
              <button className="outline-btn" onClick={toggleMarkForReview} disabled={inputsDisabled || currentQuestionSaving || !currentQuestion}>
                {currentQuestion && metaState.reviewFlags[currentQuestion._id] ? 'Unmark Review' : 'Mark for Review'}
              </button>
              <button className="outline-btn" onClick={submitSimulation} disabled={inputsDisabled || currentQuestionSaving}>
                Submit Test
              </button>
            </div>
          </section>

          <section className="panel">
            <h3>Question Palette</h3>
            <QuestionPalette
              questions={questions}
              currentIndex={navigationState.currentIndex}
              answeredByIndex={answeredByIndex}
              reviewFlags={metaState.reviewFlags}
              visitedQuestions={metaState.visitedQuestions}
              pendingByQuestion={answerState.pendingByQuestion}
              failedByQuestion={answerState.failedByQuestion}
              disabled={inputsDisabled || currentQuestionSaving}
              onSelect={goToQuestion}
            />
          </section>
        </>
      )}
    </div>
  );
};

export default ExamSimulationPage;
