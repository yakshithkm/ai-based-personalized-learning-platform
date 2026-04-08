import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { trackProductEvent } from '../utils/productEvents';

const makeSessionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const PracticePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [result, setResult] = useState(null);
  const [startTime, setStartTime] = useState(Date.now());
  const [error, setError] = useState('');
  const [recommendedMode, setRecommendedMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [sessionResults, setSessionResults] = useState([]);
  const [sessionMeta, setSessionMeta] = useState(null);
  const [xpPulse, setXpPulse] = useState(0);
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const { data } = await api.get('/questions/subjects-topics');
        setSubjects(data.subjects || []);
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load subjects/topics');
      }
    };
    loadSubjects();
  }, []);

  useEffect(() => {
    const mode = searchParams.get('mode');
    const requestedTopic = searchParams.get('topic');

    if (requestedTopic && requestedTopic.includes(' - ')) {
      const [subject, topic] = requestedTopic.split(' - ');
      setSelectedSubject(subject);
      setSelectedTopic(topic);
    }

    if (mode === 'recommended') {
      setRecommendedMode(true);
      setFocusMode(false);
      const loadRecommended = async () => {
        try {
          const { data } = await api.get('/recommendations/me');
          const newSessionId = makeSessionId();
          setSessionId(newSessionId);
          setQuestions(data.recommendations || []);
          setCurrentIndex(0);
          setResult(null);
          setSelectedAnswer(null);
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
  }, [searchParams]);

  const topics = useMemo(() => {
    const entry = subjects.find((s) => s.subject === selectedSubject);
    return entry?.topics || [];
  }, [subjects, selectedSubject]);

  const loadQuestions = async () => {
    setError('');
    setResult(null);
    setSelectedAnswer(null);
    setCurrentIndex(0);
    setRecommendedMode(false);
    setFocusMode(false);
    setSessionResults([]);

    try {
      const { data } = await api.get('/questions', {
        params: {
          subject: selectedSubject || undefined,
          topic: selectedTopic || undefined,
          limit: 10,
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
      });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load questions');
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
      setSessionResults((prev) => [
        ...prev,
        {
          questionId: question._id,
          topic: `${question.subject} - ${question.topic}`,
          isCorrect: data.result.isCorrect,
          performanceLabel: data.result.performanceLabel,
          xpEarned: data.result?.xpEarned || 0,
        },
      ]);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to submit attempt');
    }
  };

  const nextQuestion = () => {
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

      setQuestions([next]);
      setCurrentIndex(0);
      setResult(null);
      setSelectedAnswer(null);
      setStartTime(Date.now());
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load adaptive question');
    }
  };

  const openSessionSummary = () => {
    const total = sessionResults.length;
    const correct = sessionResults.filter((entry) => entry.isCorrect).length;
    const accuracy = total ? (correct / total) * 100 : 0;

    const weakAreas = Array.from(
      new Set(sessionResults.filter((entry) => !entry.isCorrect).map((entry) => entry.topic))
    ).slice(0, 4);

    const improvementSuggestion = weakAreas.length
      ? `Focus on ${weakAreas[0]} first, then continue guided practice.`
      : 'You performed well. Increase difficulty in your strongest topic next.';

    const earnedXp = sessionResults.reduce((sum, entry) => sum + Number(entry.xpEarned || 0), 0);

    navigate('/session-summary', {
      state: {
        summary: {
          total,
          correct,
          accuracy: Number(accuracy.toFixed(1)),
          weakAreas,
          improvementSuggestion,
          earnedXp,
          sessionId,
          nextRecommendedSession: sessionMeta?.mix || null,
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

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Practice Zone</h2>
        <p>
          {focusMode
            ? 'Focus session is active: weak topics + mistakes + one harder challenge.'
            : recommendedMode
              ? 'Recommended adaptive set is active.'
              : 'Choose a subject/topic and solve curated questions.'}
        </p>

        <div className="filters-row">
          <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
            <option value="">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.subject} value={s.subject}>
                {s.subject}
              </option>
            ))}
          </select>

          <select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)}>
            <option value="">All Topics</option>
            {topics.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>

          <button className="solid-btn" onClick={loadQuestions}>
            Load Questions
          </button>
        </div>
      </section>

      {error && <section className="panel error-text">{error}</section>}

      {!!question && (
        <section className="panel">
          <div className="progress-head">
            <h3>
              Question {currentIndex + 1} / {questions.length}
            </h3>
            <span className="progress-tag">{Math.round(progress)}% Complete</span>
          </div>
          <div className="progress-bar">
            <span className="progress-fill" style={{ width: `${progress}%` }} />
          </div>

          <p>{question.text}</p>

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
            </div>
          )}
        </section>
      )}

      {!question && questions.length === 0 && (
        <section className="panel">
          <p>No question loaded yet. Use filters and click Load Questions.</p>
        </section>
      )}
    </div>
  );
};

export default PracticePage;
