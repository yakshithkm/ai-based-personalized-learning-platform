import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

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
const TAB_SWITCH_WARNING_LIMIT = 3;

const initialExamInteractionState = {
  currentIndex: 0,
  answers: {},
  reviewFlags: {},
  visitedQuestions: {},
  tabSwitchCount: 0,
};

const examInteractionReducer = (state, action) => {
  switch (action.type) {
    case 'INIT_SESSION_STATE':
      return {
        ...state,
        currentIndex: 0,
        answers: action.payload.answers || {},
        reviewFlags: action.payload.reviewFlags || {},
        visitedQuestions: action.payload.visitedQuestions || {},
      };
    case 'SET_CURRENT_INDEX':
      return {
        ...state,
        currentIndex: Math.max(0, Number(action.payload.index || 0)),
      };
    case 'NEXT': {
      const maxIndex = Number(action.payload.maxIndex || 0);
      const strictNavigation = Boolean(action.payload.strictNavigation);
      const canAdvance = Boolean(action.payload.canAdvance);
      if (strictNavigation && !canAdvance) return state;
      return {
        ...state,
        currentIndex: Math.min(state.currentIndex + 1, maxIndex),
      };
    }
    case 'PREVIOUS':
      return {
        ...state,
        currentIndex: Math.max(state.currentIndex - 1, 0),
      };
    case 'SET_ANSWER':
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.payload.questionId]: action.payload.answerIndex,
        },
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
    case 'RESET':
      return initialExamInteractionState;
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
  const [error, setError] = useState('');
  const [tabWarning, setTabWarning] = useState('');

  const [examState, dispatch] = useReducer(examInteractionReducer, initialExamInteractionState);
  const saveDebounceRef = useRef(null);
  const pendingSaveRef = useRef(null);

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

  useEffect(() => {
    if (!session || session.status !== 'active') return undefined;

    const tick = () => {
      const expiresAt = new Date(session.expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeftSec(remaining);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!session || session.status !== 'active' || timeLeftSec > 0 || isSubmitting) return;

    const autoSubmit = async () => {
      try {
        setIsSubmitting(true);
        const { data } = await api.post(`/exams/sessions/${session.sessionId}/submit`);
        setSession((prev) => (prev ? { ...prev, status: 'expired', submittedAt: data.submittedAt } : prev));
        navigate('/exam-simulation/result', {
          replace: true,
          state: {
            result: data,
            sessionMeta: {
              examType: session.examType,
              mode: session.mode,
            },
          },
        });
      } catch (err) {
        setError(err?.response?.data?.message || 'Auto-submit failed. Please submit manually.');
      } finally {
        setIsSubmitting(false);
      }
    };

    autoSubmit();
  }, [timeLeftSec, session, isSubmitting, navigate]);

  const questions = session?.questions || [];
  const currentQuestion = questions[examState.currentIndex] || null;
  const selectedAnswer = currentQuestion ? examState.answers[currentQuestion._id] : null;
  const inputsDisabled = !session || session.status !== 'active' || timeLeftSec <= 0 || isSubmitting;

  const getAnswerByIndex = (index) => {
    const question = questions[index];
    if (!question) return undefined;
    return examState.answers[question._id];
  };

  const flushPendingSave = async () => {
    const pending = pendingSaveRef.current;
    if (!pending || !session || session.status !== 'active') return;
    pendingSaveRef.current = null;

    try {
      const { data } = await api.patch(`/exams/sessions/${session.sessionId}/answer`, {
        questionIndex: pending.questionIndex,
        selectedAnswerIndex: pending.answerIndex,
        timeTakenSec: 0,
      });
      setSession(data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save answer.');
    }
  };

  const queueAnswerSave = (questionIndex, answerIndex) => {
    pendingSaveRef.current = { questionIndex, answerIndex };
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
        acc[index] = Number.isInteger(examState.answers[question._id]);
        return acc;
      }, {}),
    [questions, examState.answers]
  );

  useEffect(() => {
    if (!session?.sessionId) {
      dispatch({ type: 'RESET' });
      return;
    }

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

    const storedAnswers = answerRaw ? JSON.parse(answerRaw) : {};
    const storedReviewFlags = reviewRaw ? JSON.parse(reviewRaw) : {};
    const storedVisited = visitedRaw ? JSON.parse(visitedRaw) : {};

    dispatch({
      type: 'INIT_SESSION_STATE',
      payload: {
        answers: {
          ...serverAnswerMap,
          ...storedAnswers,
        },
        reviewFlags: storedReviewFlags,
        visitedQuestions: storedVisited,
      },
    });
    setTabWarning('');
  }, [session?.sessionId]);

  useEffect(() => {
    if (!session?.sessionId) return;
    localStorage.setItem(getSessionStorageKey(session.sessionId, 'answers'), JSON.stringify(examState.answers));
  }, [examState.answers, session?.sessionId]);

  useEffect(() => {
    if (!session?.sessionId) return;
    localStorage.setItem(
      getSessionStorageKey(session.sessionId, 'reviewFlags'),
      JSON.stringify(examState.reviewFlags)
    );
  }, [examState.reviewFlags, session?.sessionId]);

  useEffect(() => {
    if (!session?.sessionId) return;
    localStorage.setItem(
      getSessionStorageKey(session.sessionId, 'visitedQuestions'),
      JSON.stringify(examState.visitedQuestions)
    );
  }, [examState.visitedQuestions, session?.sessionId]);

  useEffect(() => {
    if (!currentQuestion?._id) return;
    dispatch({
      type: 'MARK_VISITED',
      payload: {
        questionId: currentQuestion._id,
      },
    });
  }, [currentQuestion?._id]);

  useEffect(() => {
    console.log('Current Index:', examState.currentIndex);
  }, [examState.currentIndex]);

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

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return;

      const nextCount = examState.tabSwitchCount + 1;
      dispatch({ type: 'INCREMENT_TAB_SWITCH' });
      if (nextCount > TAB_SWITCH_WARNING_LIMIT) {
        setTabWarning(
          `You switched tabs ${nextCount} times. Stay on this tab to avoid invalidating the simulation.`
        );
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [session, examState.tabSwitchCount]);

  useEffect(
    () => () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
      }
    },
    []
  );

  const startSimulation = async () => {
    setError('');
    setTabWarning('');

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
      setSession(data);
      setTimeLeftSec(Number(data.timeLeftSec || data.timeLimitSec || 0));
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to start exam simulation.');
    }
  };

  const goToQuestion = (index) => {
    if (inputsDisabled) return;
    if (index < 0 || index >= questions.length) return;
    if (session.strictNavigation) {
      if (!canGoNext() && index > examState.currentIndex) return;
      if (index > examState.currentIndex + 1) return;
    }
    dispatch({
      type: 'SET_CURRENT_INDEX',
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
    dispatch({
      type: 'TOGGLE_REVIEW',
      payload: {
        questionId: currentQuestion._id,
      },
    });
  };

  const submitSimulation = async () => {
    if (!session || session.status !== 'active') return;
    const ok = window.confirm('Submit test now? You cannot change answers after submission.');
    if (!ok) return;

    try {
      setIsSubmitting(true);
      await flushPendingSave();
      const { data } = await api.post(`/exams/sessions/${session.sessionId}/submit`);
      setSession((prev) => (prev ? { ...prev, status: 'submitted', submittedAt: data.submittedAt } : prev));
      navigate('/exam-simulation/result', {
        replace: true,
        state: {
          result: data,
          sessionMeta: {
            examType: session.examType,
            mode: session.mode,
          },
        },
      });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to submit exam simulation.');
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
    if (!Number.isInteger(selectedAnswer)) {
      setError('Select an option before moving to the next question.');
      return;
    }

    setError('');
    queueAnswerSave(examState.currentIndex, selectedAnswer);

    dispatch({
      type: 'NEXT',
      payload: {
        maxIndex: questions.length - 1,
        strictNavigation: session.strictNavigation,
        canAdvance: canGoNext(),
      },
    });
  };

  const handlePrevious = () => {
    if (inputsDisabled || !questions.length) return;
    dispatch({ type: 'PREVIOUS' });
  };

  const handleOptionSelect = (answerIndex) => {
    if (!Number.isInteger(answerIndex) || !currentQuestion || inputsDisabled) return;
    dispatch({
      type: 'SET_ANSWER',
      payload: {
        questionId: currentQuestion._id,
        answerIndex,
      },
    });

    queueAnswerSave(examState.currentIndex, answerIndex);
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
  }, [session, questions.length, examState.currentIndex, selectedAnswer, examState.answers, isSubmitting, timeLeftSec]);

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
      {tabWarning && <section className="panel error-text">{tabWarning}</section>}

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
              <span>Question {examState.currentIndex + 1} / {session.questionCount}</span>
              <span className="progress-pill">Question {examState.currentIndex + 1} / {questions.length || session.questionCount}</span>
              <span>Hints: OFF</span>
              <span>Explanations: OFF</span>
            </div>

            <div className="exam-question-card question-transition" key={currentQuestion?._id || examState.currentIndex}>
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
              <button className="outline-btn" onClick={handlePrevious} disabled={inputsDisabled || examState.currentIndex === 0}>
                Previous
              </button>
              <button
                className="solid-btn"
                onClick={handleSaveAndNext}
                disabled={
                  inputsDisabled ||
                  examState.currentIndex === questions.length - 1 ||
                  (session.strictNavigation && !Number.isInteger(selectedAnswer))
                }
              >
                Save & Next
              </button>
              <button className="outline-btn" onClick={goToFirstUnanswered} disabled={inputsDisabled}>
                Jump to First Unanswered
              </button>
              <button className="outline-btn" onClick={toggleMarkForReview} disabled={inputsDisabled || !currentQuestion}>
                {currentQuestion && examState.reviewFlags[currentQuestion._id] ? 'Unmark Review' : 'Mark for Review'}
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
                const marked = Boolean(examState.reviewFlags[question._id]);
                const visited = Boolean(examState.visitedQuestions[question._id]);
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
                  className={`palette-btn ${index === examState.currentIndex ? 'current' : ''} ${answered ? 'answered' : ''} ${visited ? 'visited' : ''} ${!answered && !visited ? 'unanswered' : ''} ${marked ? 'review' : ''}`}
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
