import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { API_BASE_URL } from '../api/client';
import { trackProductEvent } from '../utils/productEvents';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/EmptyState';
import { subjectColor } from '../utils/subjectVisuals';
import { emitAttemptSubmitted } from '../utils/appEvents';
import AISidebar from '../components/AISidebar';

const makeSessionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const makeAiMessageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ai-msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

// Not shown in the chat UI as a "You:" bubble - this only exists to trigger
// the automatic initial explanation when the sidebar opens for a question.
const INITIAL_AI_PROMPT = 'Please explain this question to me so I understand it.';
const AI_ERROR_FALLBACK = "Sorry, I couldn't generate an explanation right now. Please try again.";

const formatDuration = (totalSeconds = 0) => {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

const TargetIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2l8 4v6c0 5.25-3.4 9.74-8 11-4.6-1.26-8-5.75-8-11V6l8-4zm-1 12l6-6-1.4-1.4L11 11.2 8.8 9 7.4 10.4 11 14z" />
  </svg>
);

const BoltIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M13 2 3 14h6l-1 8 10-12h-6l1-8z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.2 14.6-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7z" />
  </svg>
);

const XCircleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm3.5 12.1-1.4 1.4L12 13.4l-2.1 2.1-1.4-1.4L10.6 12l-2.1-2.1 1.4-1.4L12 10.6l2.1-2.1 1.4 1.4L13.4 12l2.1 2.1z" />
  </svg>
);

const AIIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2 9.5 8.5 3 11l6.5 2.5L12 20l2.5-6.5L21 11l-6.5-2.5L12 2zM19 3l-1 2-2 1 2 1 1 2 1-2 2-1-2-1-1-2z" />
  </svg>
);

const PracticePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [questionCount, setQuestionCount] = useState(15);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [result, setResult] = useState(null);
  const [startTime, setStartTime] = useState(Date.now());
  const [error, setError] = useState('');
  const [recommendedMode, setRecommendedMode] = useState(false);
  // Set when the session is a "practice after learning" set opened from a learning recommendation.
  const [contentRecId, setContentRecId] = useState(null);
  const [focusMode, setFocusMode] = useState(false);
  const [sessionResults, setSessionResults] = useState([]);
  const [sessionMeta, setSessionMeta] = useState(null);
  const [xpPulse, setXpPulse] = useState(0);
  const [sessionId, setSessionId] = useState('');
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  // Ask with AI sidebar state - scoped to whichever question is currently
  // displayed. Every question-navigation action (Retry Similar, Move to
  // Harder, Next Question, and starting a fresh set) must close the sidebar
  // and clear these so the AI conversation never leaks across questions.
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiLastPayload, setAiLastPayload] = useState(null);
  // The id of the assistant message currently being streamed into, if any -
  // drives the blinking-cursor affordance so the student can see a reply is
  // still in progress. null once the stream finishes, errors, or is reset.
  const [aiStreamingMessageId, setAiStreamingMessageId] = useState(null);
  // Not React state - aborting a fetch is an imperative action, not
  // something that should trigger a re-render on its own.
  const aiStreamAbortRef = useRef(null);

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const exam = (user?.targetExam || user?.exam || '').trim().toUpperCase();

        const { data } = await api.get('/questions/subjects-topics', {
          params: {
            exam: exam || undefined,
          },
        });
        setSubjects(data.subjects || []);
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load subjects/topics');
      }
    };
    loadSubjects();
  }, [user]);

  useEffect(() => {
    const mode = searchParams.get('mode');
    const requestedTopic = searchParams.get('topic');

    if (requestedTopic && requestedTopic.includes(' - ')) {
      const [subject, topic] = requestedTopic.split(' - ');
      setSelectedSubject(subject);
      setSelectedTopic(topic);
    }

    if (mode !== 'content-practice') setContentRecId(null);

    if (mode === 'content-practice' && searchParams.get('rec')) {
      const recId = searchParams.get('rec');
      setRecommendedMode(true);
      setFocusMode(false);
      setContentRecId(recId);
      const loadContentPractice = async () => {
        try {
          const { data } = await api.get(`/recommendations/${recId}/practice`, {
            params: { count: searchParams.get('count') || 5 },
          });
          if (!(data.questions || []).length) {
            setError('No practice questions are available for this topic yet.');
            return;
          }
          const newSessionId = makeSessionId();
          setSessionId(newSessionId);
          resetAiSidebar();
          setQuestions(data.questions);
          setCurrentIndex(0);
          setResult(null);
          setSelectedAnswer(null);
          setSessionResults([]);
          setStartTime(Date.now());
          trackProductEvent('session_started', {
            sessionId: newSessionId,
            sessionMode: 'content-practice',
            totalQuestions: data.questions.length,
          });
        } catch (err) {
          setError(err?.response?.data?.message || 'Failed to load the practice set for this lesson');
        }
      };

      loadContentPractice();
    }

    if (mode === 'recommended') {
      setRecommendedMode(true);
      setFocusMode(false);
      const loadRecommended = async () => {
        try {
          const { data } = await api.get('/recommendations/me');
          const newSessionId = makeSessionId();
          setSessionId(newSessionId);
          resetAiSidebar();
          setQuestions(data.recommendations || []);
          setCurrentIndex(0);
          setResult(null);
          setSelectedAnswer(null);
          setSessionResults([]);
          setStartTime(Date.now());
          trackProductEvent('session_started', {
            sessionId: newSessionId,
            sessionMode: 'recommended',
            totalQuestions: (data.recommendations || []).length,
          });
        } catch (err) {
          setError(err?.response?.data?.message || 'Failed to load recommended practice set');
        }
      };

      loadRecommended();
    }

    if (mode === 'focus') {
      setRecommendedMode(false);
      setFocusMode(true);
      const loadFocus = async () => {
        try {
          const { data } = await api.get('/recommendations/focus-session');
          const newSessionId = makeSessionId();
          setSessionId(newSessionId);
          resetAiSidebar();
          setQuestions(data.questions || []);
          setSessionMeta(data);
          setSessionResults([]);
          setCurrentIndex(0);
          setResult(null);
          setSelectedAnswer(null);
          setStartTime(Date.now());
          trackProductEvent('focus_session_started', {
            sessionId: newSessionId,
            sessionMode: 'focus',
            totalQuestions: (data.questions || []).length,
          });
          trackProductEvent('session_started', {
            sessionId: newSessionId,
            sessionMode: 'focus',
            totalQuestions: (data.questions || []).length,
          });
        } catch (err) {
          setError(err?.response?.data?.message || 'Failed to load focus session');
        }
      };

      loadFocus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const topics = useMemo(() => {
    const entry = subjects.find((s) => s.subject === selectedSubject);
    return entry?.topics || [];
  }, [subjects, selectedSubject]);

  const loadQuestions = async () => {
    setError('');
    resetAiSidebar();
    setResult(null);
    setSelectedAnswer(null);
    setCurrentIndex(0);
    setRecommendedMode(false);
    setFocusMode(false);
    setSessionResults([]);
    setIsLoadingQuestions(true);

    try {
      const exam = (user?.targetExam || user?.exam || '').trim().toUpperCase();

      const { data } = await api.get('/questions', {
        params: {
          exam: exam || undefined,
          subject: selectedSubject || undefined,
          topic: selectedTopic || undefined,
          difficulty: selectedDifficulty || undefined,
          limit: questionCount,
        },
      });
      const newSessionId = makeSessionId();
      setSessionId(newSessionId);
      setQuestions(data.questions || []);
      setStartTime(Date.now());
      trackProductEvent('session_started', {
        sessionId: newSessionId,
        sessionMode: 'manual',
        totalQuestions: (data.questions || []).length,
        subject: selectedSubject || null,
        topic: selectedTopic || null,
        difficulty: selectedDifficulty || null,
      });
      if (!(data.questions || []).length) {
        toast?.showToast?.('No questions matched those filters yet. Try a different subject, topic, or difficulty.', { type: 'error' });
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load questions');
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const question = questions[currentIndex];
  const progress = questions.length ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const submitCurrent = async () => {
    if (!question || selectedAnswer === null) return;

    const timeTakenSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));

    try {
      const { data } = await api.post('/attempts', {
        questionId: question._id,
        selectedAnswerIndex: selectedAnswer,
        timeTakenSec,
        sessionId,
        sessionMode: focusMode ? 'focus' : recommendedMode ? 'recommended' : 'manual',
        questionIndex: currentIndex + 1,
        totalQuestions: questions.length,
      });
      setResult(data.result);
      setXpPulse(data.result?.xpEarned || 0);
      // Let the app shell know an attempt just landed so the header streak
      // pill can refresh immediately instead of only on next page load.
      emitAttemptSubmitted({ isCorrect: data.result?.isCorrect });
      setSessionResults((prev) => [
        ...prev,
        {
          questionId: question._id,
          topic: `${question.subject} - ${question.topic}`,
          subject: question.subject,
          isCorrect: data.result.isCorrect,
          performanceLabel: data.result.performanceLabel,
          xpEarned: data.result?.xpEarned || 0,
          timeTakenSec,
          selectedAnswerText: question.options?.[selectedAnswer] ?? '',
          correctAnswerText: data.result?.correctAnswer ?? '',
        },
      ]);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to submit attempt');
    }
  };

  const resetAiSidebar = () => {
    // Cancel any in-flight stream before clearing state - otherwise a
    // still-arriving chunk from the PREVIOUS question could land after
    // this reset and get appended into whatever the NEXT question's
    // sidebar state becomes.
    aiStreamAbortRef.current?.abort();
    aiStreamAbortRef.current = null;
    setIsAiSidebarOpen(false);
    setAiMessages([]);
    setAiLoading(false);
    setAiError('');
    setAiLastPayload(null);
    setAiStreamingMessageId(null);
  };

  const nextQuestion = () => {
    resetAiSidebar();
    setResult(null);
    setSelectedAnswer(null);
    setCurrentIndex((prev) => prev + 1);
    setStartTime(Date.now());
  };

  const loadAdaptiveActionQuestion = async (actionParams) => {
    if (!actionParams) return;

    try {
      const { data } = await api.get('/questions', { params: actionParams });
      const next = data.questions?.[0];
      if (!next) {
        setError('No adaptive follow-up question found for this action.');
        return;
      }

      // Only close/reset the AI sidebar once the new question has actually
      // loaded - an action that fails to find a follow-up question should
      // leave the current question (and its AI conversation) untouched.
      resetAiSidebar();
      setQuestions([next]);
      setCurrentIndex(0);
      setResult(null);
      setSelectedAnswer(null);
      setStartTime(Date.now());
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load adaptive question');
    }
  };

  const sendToAI = async (payload) => {
    if (!question) return;

    // Cancel any still-in-flight request for this sidebar before starting a
    // new one - prevents two overlapping streams (e.g. a rapid double-click
    // on retry) from interleaving their chunks into the same message.
    aiStreamAbortRef.current?.abort();
    const abortController = new AbortController();
    aiStreamAbortRef.current = abortController;
    const isCurrent = () => aiStreamAbortRef.current === abortController;

    setAiLoading(true);
    setAiError('');
    setAiLastPayload(payload);

    const assistantMessageId = makeAiMessageId();
    let hasStartedMessage = false;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/ai/explain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ questionId: question._id, ...payload }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        // A failure before the backend even starts streaming (e.g. the
        // rate-limit middleware itself rejecting the request) still comes
        // back as plain JSON, not SSE.
        let message = AI_ERROR_FALLBACK;
        try {
          const data = await response.json();
          message = data?.message || message;
        } catch {
          // Body wasn't JSON (or was already consumed) - keep the fallback.
        }
        throw new Error(message);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        // eslint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf('\n\n');

          const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data:'));
          if (!dataLine) continue;
          const jsonText = dataLine.slice(5).trim();
          if (!jsonText) continue;

          let event;
          try {
            event = JSON.parse(jsonText);
          } catch {
            continue;
          }

          if (event.type === 'chunk' && event.text) {
            if (!isCurrent()) continue; // superseded mid-parse - drop it
            if (!hasStartedMessage) {
              hasStartedMessage = true;
              setAiLoading(false);
              setAiStreamingMessageId(assistantMessageId);
              setAiMessages((prev) => [...prev, { id: assistantMessageId, role: 'assistant', content: event.text }]);
            } else {
              setAiMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId ? { ...msg, content: msg.content + event.text } : msg
                )
              );
            }
          } else if (event.type === 'error') {
            throw new Error(event.message || AI_ERROR_FALLBACK);
          }
          // 'done' needs no handling here - the loop ends naturally when
          // the server closes the stream right after sending it.
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Superseded by a newer request (navigation or a fresh retry) -
        // not a real failure, and this request's state is stale, so don't
        // touch anything the newer request may already be updating.
        return;
      }
      if (isCurrent()) {
        setAiError(err.message || AI_ERROR_FALLBACK);
      }
    } finally {
      if (isCurrent()) {
        aiStreamAbortRef.current = null;
        setAiLoading(false);
        setAiStreamingMessageId(null);
      }
    }
  };

  const openAiSidebar = () => {
    if (!result || !question) return;
    setIsAiSidebarOpen(true);
    // Auto-send the current question the first time the sidebar opens for
    // it; reopening (after just closing with X) shows the existing
    // conversation instead of re-triggering this.
    if (aiMessages.length === 0 && !aiLoading && !aiError) {
      sendToAI({ message: INITIAL_AI_PROMPT, history: [] });
    }
  };

  const closeAiSidebar = () => {
    // Closing does NOT reset the conversation - only navigating to another
    // question does (see resetAiSidebar, called from nextQuestion /
    // loadAdaptiveActionQuestion / loadQuestions / the recommended & focus
    // session loaders).
    setIsAiSidebarOpen(false);
  };

  const sendAiFollowUp = (text) => {
    const history = aiMessages.map((msg) => ({ role: msg.role, content: msg.content }));
    setAiMessages((prev) => [...prev, { id: makeAiMessageId(), role: 'user', content: text }]);
    sendToAI({ message: text, history });
  };

  const retryLastAiRequest = () => {
    if (aiLastPayload) sendToAI(aiLastPayload);
  };

  const openSessionSummary = () => {
    const total = sessionResults.length;
    const correct = sessionResults.filter((entry) => entry.isCorrect).length;
    const accuracy = total ? (correct / total) * 100 : 0;

    const weakAreas = Array.from(
      new Set(sessionResults.filter((entry) => !entry.isCorrect).map((entry) => entry.topic))
    ).slice(0, 4);

    const strengths = Array.from(
      new Set(sessionResults.filter((entry) => entry.isCorrect).map((entry) => entry.topic))
    ).slice(0, 2);

    const keyPattern = weakAreas.length
      ? `You are repeating the same mistake pattern in ${weakAreas[0]}. Practicing more without fixing the concept will not help.`
      : 'Your execution is controlled right now. Keep the same process and raise the difficulty.';

    const mentorFeedback = accuracy >= 75
      ? `You are improving, and the results are becoming more dependable. Keep the method, but do not relax your error checks.`
      : weakAreas.length
        ? `Your performance is inconsistent — the issue is not effort, it is execution in ${weakAreas[0]}.`
        : 'The session is stable, but stable is not enough. Turn this into repeatable accuracy.';

    const scoreInterpretation = accuracy >= 75
      ? 'Improving'
      : accuracy >= 50
        ? 'Not ready yet, but the trend can be repaired quickly.'
        : 'Not ready — the current method is not converting into marks.';

    const nextAction = contentRecId
      ? { label: 'See your learning progress', route: '/learn' }
      : weakAreas.length
      ? {
          label: 'Retry Mistake Questions',
          route: '/practice?mode=recommended',
        }
      : {
          label: 'Take Full Mock Test',
          route: '/exam-simulation',
        };

    const improvementSuggestion = weakAreas.length
      ? `Fix ${weakAreas[0]} first. More volume will not help until the concept is corrected.`
      : 'Your result is stable. Raise pressure with a full mock or harder set next.';

    const earnedXp = sessionResults.reduce((sum, entry) => sum + Number(entry.xpEarned || 0), 0);

    navigate('/session-summary', {
      state: {
        summary: {
          total,
          correct,
          accuracy: Number(accuracy.toFixed(1)),
          weakAreas,
          strengths,
          keyPattern,
          mentorFeedback,
          scoreInterpretation,
          improvementSuggestion,
          earnedXp,
          sessionId,
          recommendationId: contentRecId || undefined,
          nextRecommendedSession: sessionMeta?.mix || null,
          nextAction,
        },
      },
    });

    trackProductEvent('session_completed', {
      sessionId,
      sessionMode: focusMode ? 'focus' : recommendedMode ? 'recommended' : 'manual',
      totalQuestions: total,
      answeredQuestions: total,
      accuracy: Number(accuracy.toFixed(1)),
      earnedXp,
    });
  };

  const aiLabels = question?.aiSignals?.labels || (recommendedMode || focusMode ? ['AI-selected question'] : []);
  const aiWhy = question?.aiSignals?.why ||
    ((recommendedMode || focusMode)
      ? 'Selected based on your recent performance and adaptive strategy.'
      : 'Question loaded from your current filters.');

  const sessionTotal = sessionResults.length;
  const sessionCorrect = sessionResults.filter((entry) => entry.isCorrect).length;
  const sessionIncorrect = sessionTotal - sessionCorrect;
  const sessionAccuracy = sessionTotal ? (sessionCorrect / sessionTotal) * 100 : 0;
  const sessionTimeSec = sessionResults.reduce((sum, entry) => sum + Number(entry.timeTakenSec || 0), 0);
  const recentQuestions = [...sessionResults].reverse().slice(0, 6);

  const modeLabel = focusMode ? 'Focus Session' : contentRecId ? 'Practice After Learning' : recommendedMode ? 'Recommended Set' : 'Custom Practice';
  const modeSubtitle = focusMode
    ? 'Focus session is active: weak topics + mistakes + one harder challenge.'
    : contentRecId
      ? 'Practice after learning — questions chosen from the topic you just studied.'
      : recommendedMode
      ? 'Recommended adaptive set is active — questions chosen from your performance profile.'
      : 'Choose a subject, topic, and difficulty, then start practice to begin.';

  return (
    <div className="dash-grid">
      <section className="dash-greeting practice-header">
        <h1>Practice</h1>
        <p>{modeSubtitle}</p>
      </section>

      <section className="dash-card practice-control-card">
        <div className="dash-card-head">
          <div>
            <h3><BoltIcon /> {modeLabel}</h3>
            <p className="dash-card-subtitle">Pick your filters and start a curated question set.</p>
          </div>
        </div>

        <div className="practice-control-grid">
          <label className="practice-control-field">
            <span>Subject</span>
            <select value={selectedSubject} onChange={(e) => { setSelectedSubject(e.target.value); setSelectedTopic(''); }}>
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.subject} value={s.subject}>
                  {s.subject}
                </option>
              ))}
            </select>
          </label>

          <label className="practice-control-field">
            <span>Topic</span>
            <select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)}>
              <option value="">All Topics</option>
              {topics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </label>

          <label className="practice-control-field">
            <span>Difficulty</span>
            <select value={selectedDifficulty} onChange={(e) => setSelectedDifficulty(e.target.value)}>
              <option value="">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </label>

          <label className="practice-control-field">
            <span>Question Count</span>
            <select value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))}>
              <option value={10}>10 Questions</option>
              <option value={15}>15 Questions</option>
              <option value={20}>20 Questions</option>
            </select>
          </label>

          <button
            type="button"
            className={`solid-btn practice-start-btn ${isLoadingQuestions ? 'btn-loading-pulse' : ''}`}
            onClick={loadQuestions}
            disabled={isLoadingQuestions}
          >
            {isLoadingQuestions ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                Loading...
              </>
            ) : (
              'Start Practice'
            )}
          </button>
        </div>

        {!!topics.length && (
          <div className="practice-topic-chips">
            {topics.slice(0, 12).map((topic) => (
              <button
                type="button"
                key={topic}
                className={`topic-chip ${selectedTopic === topic ? 'active' : ''}`}
                onClick={() => setSelectedTopic(selectedTopic === topic ? '' : topic)}
              >
                {topic}
              </button>
            ))}
          </div>
        )}
      </section>

      {error && <section className="dash-card error-text">{error}</section>}

      {!!question && (
        <section className="dash-main-grid practice-main-grid">
          <article className="dash-card question-card" key={question._id || `${sessionId}-${currentIndex}`}>
            <div className="progress-head">
              <h3>
                Question {currentIndex + 1} / {questions.length}
              </h3>
              <span className="progress-tag">{Math.round(progress)}% Complete</span>
            </div>
            <div className="progress-bar">
              <span className="progress-fill" style={{ width: `${progress}%` }} />
            </div>

            <div className="practice-question-tags">
              <span className="exam-tag-chip" style={{ borderColor: `${subjectColor(question.subject)}55`, color: subjectColor(question.subject) }}>
                {question.subject}
              </span>
              {question.topic && <span className="exam-tag-chip">{question.topic}</span>}
              {question.difficulty && <span className="exam-tag-chip">{question.difficulty}</span>}
            </div>

            <p className="practice-question-text">{question.text}</p>

            {(recommendedMode || focusMode) && (
              <div className="ai-meta-box">
                <div className="chip-wrap">
                  {aiLabels.map((label) => (
                    <span key={label} className="chip ai-chip">{label}</span>
                  ))}
                </div>
                <small>WHY: {aiWhy}</small>
                {question?.aiSignals?.adaptiveDifficultyApplied && (
                  <small>Adaptive difficulty applied for this step.</small>
                )}
              </div>
            )}

            <div className="option-list">
              {question.options.map((option, idx) => (
                <button
                  key={option}
                  className={`option-btn ${selectedAnswer === idx ? 'selected' : ''} ${
                    result && idx === result.correctAnswerIndex ? 'correct' : ''
                  } ${result && selectedAnswer === idx && !result.isCorrect ? 'wrong' : ''}`}
                  onClick={() => setSelectedAnswer(idx)}
                  disabled={Boolean(result)}
                >
                  {option}
                </button>
              ))}
            </div>

            {!result ? (
              <button className="solid-btn" onClick={submitCurrent} disabled={selectedAnswer === null}>
                Submit Answer
              </button>
            ) : (
              <div className={`feedback-box ${result.isCorrect ? 'feedback-correct' : 'feedback-wrong'}`}>
                <strong>{result.isCorrect ? 'Correct Answer' : 'Incorrect Answer'}</strong>
                <p className="correct-answer-text">Correct answer: {result.correctAnswer}</p>
                {!!xpPulse && <p className="xp-pop">+{xpPulse} XP earned</p>}
                <p>{result.explanation}</p>
                <p className="improvement-tip">Tip: {result.improvementTip}</p>
                {result.performanceLabel && <p className="improvement-tip">Performance: {result.performanceLabel}</p>}
                {result.mistakeClassification && <p className="why-wrong-text">Mistake Type: {result.mistakeClassification}</p>}
                {result.motivationMessage && <p className="improvement-tip">{result.motivationMessage}</p>}
                {!result.isCorrect && result.whyGotWrong && (
                  <p className="why-wrong-text">Why you got it wrong: {result.whyGotWrong}</p>
                )}
                <div className="feedback-actions">
                  <button
                    className="outline-btn"
                    onClick={() => loadAdaptiveActionQuestion(result.actions?.retrySimilarQuestion?.params)}
                  >
                    Retry Similar Question
                  </button>
                  <button
                    className="outline-btn"
                    onClick={() => loadAdaptiveActionQuestion(result.actions?.moveToHarderQuestion?.params)}
                    disabled={Boolean(result.actions?.moveToHarderQuestion?.disabled)}
                  >
                    Move to Harder Question
                  </button>
                </div>
                {currentIndex < questions.length - 1 && (
                  <button className="outline-btn" onClick={nextQuestion}>
                    Next Question
                  </button>
                )}
                {currentIndex >= questions.length - 1 && (
                  <div className="feedback-actions">
                    <span className="progress-tag">Practice set completed</span>
                    <button className="solid-btn" onClick={openSessionSummary}>View Session Summary</button>
                  </div>
                )}
                <div className="feedback-actions ai-sidebar-trigger-row">
                  <button type="button" className="outline-btn" onClick={openAiSidebar}>
                    <AIIcon /> Ask with AI
                  </button>
                </div>
              </div>
            )}
          </article>

          <div className="practice-side-stack">
            <article className="dash-card practice-session-card">
              <div className="dash-card-head">
                <h3>Performance This Session</h3>
              </div>
              {sessionTotal ? (
                <div className="practice-session-ring-row">
                  <div className="overall-ring-wrap practice-ring">
                    <svg viewBox="0 0 120 120" className="overall-ring">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="12" />
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        stroke="#60a5fa"
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 52}
                        strokeDashoffset={2 * Math.PI * 52 * (1 - sessionAccuracy / 100)}
                        transform="rotate(-90 60 60)"
                      />
                    </svg>
                    <span className="overall-ring-label">
                      {sessionAccuracy.toFixed(0)}%
                      <small>Accuracy</small>
                    </span>
                  </div>
                  <div className="practice-session-stats">
                    <div className="practice-stat">
                      <span className="practice-stat-icon practice-stat-correct"><CheckCircleIcon /></span>
                      <span>
                        <strong>{sessionCorrect}</strong>
                        <small>Correct</small>
                      </span>
                    </div>
                    <div className="practice-stat">
                      <span className="practice-stat-icon practice-stat-wrong"><XCircleIcon /></span>
                      <span>
                        <strong>{sessionIncorrect}</strong>
                        <small>Incorrect</small>
                      </span>
                    </div>
                    <div className="practice-stat">
                      <span className="practice-stat-icon practice-stat-time"><TargetIcon /></span>
                      <span>
                        <strong>{formatDuration(sessionTimeSec)}</strong>
                        <small>Time Taken</small>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="dash-empty-line">Submit your first answer to see live session stats here.</p>
              )}
            </article>

            <article className="dash-card practice-recent-card">
              <div className="dash-card-head">
                <h3>Recent Questions</h3>
              </div>
              {recentQuestions.length ? (
                <div className="recent-question-list">
                  {recentQuestions.map((entry, idx) => (
                    <div className={`recent-question-row ${entry.isCorrect ? 'is-correct' : 'is-wrong'}`} key={`${entry.questionId}-${idx}`}>
                      <span className="recent-question-status" aria-hidden="true">
                        {entry.isCorrect ? <CheckCircleIcon /> : <XCircleIcon />}
                      </span>
                      <span className="recent-question-topic">{entry.topic}</span>
                      <span className="recent-question-time">{entry.timeTakenSec}s</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="dash-empty-line">Your recently answered questions will appear here.</p>
              )}
            </article>
          </div>
        </section>
      )}

      {!question && questions.length === 0 && (
        <EmptyState
          icon="practice"
          title="No questions loaded yet"
          description="Pick a subject and topic above, then start practice to begin."
        />
      )}

      <AISidebar
        isOpen={isAiSidebarOpen}
        question={question}
        messages={aiMessages}
        isLoading={aiLoading}
        error={aiError}
        streamingMessageId={aiStreamingMessageId}
        onSendMessage={sendAiFollowUp}
        onClose={closeAiSidebar}
        onRetryLast={retryLastAiRequest}
      />
    </div>
  );
};

export default PracticePage;