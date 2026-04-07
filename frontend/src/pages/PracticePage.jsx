import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';

const PracticePage = () => {
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
      const loadRecommended = async () => {
        try {
          const { data } = await api.get('/recommendations/me');
          setQuestions(data.recommendations || []);
          setCurrentIndex(0);
          setResult(null);
          setSelectedAnswer(null);
          setStartTime(Date.now());
        } catch (err) {
          setError(err?.response?.data?.message || 'Failed to load recommended practice set');
        }
      };

      loadRecommended();
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

    try {
      const { data } = await api.get('/questions', {
        params: {
          subject: selectedSubject || undefined,
          topic: selectedTopic || undefined,
          limit: 10,
        },
      });
      setQuestions(data.questions || []);
      setStartTime(Date.now());
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
      });
      setResult(data.result);
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

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Practice Zone</h2>
        <p>{recommendedMode ? 'Recommended adaptive set is active.' : 'Choose a subject/topic and solve curated questions.'}</p>

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
              <p>{result.explanation}</p>
              <p className="improvement-tip">Tip: {result.improvementTip}</p>
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
                <span className="progress-tag">Practice set completed</span>
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
