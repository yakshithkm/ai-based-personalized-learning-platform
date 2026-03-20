import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const PracticePage = () => {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [result, setResult] = useState(null);
  const [startTime, setStartTime] = useState(Date.now());
  const [error, setError] = useState('');

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

  const topics = useMemo(() => {
    const entry = subjects.find((s) => s.subject === selectedSubject);
    return entry?.topics || [];
  }, [subjects, selectedSubject]);

  const loadQuestions = async () => {
    setError('');
    setResult(null);
    setSelectedAnswer(null);
    setCurrentIndex(0);

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

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Practice Zone</h2>
        <p>Choose a subject/topic and solve curated questions.</p>

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
          <h3>
            Question {currentIndex + 1} / {questions.length}
          </h3>
          <p>{question.text}</p>

          <div className="option-list">
            {question.options.map((option, idx) => (
              <button
                key={option}
                className={`option-btn ${selectedAnswer === idx ? 'selected' : ''}`}
                onClick={() => setSelectedAnswer(idx)}
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
            <div className="feedback-box">
              <strong>{result.isCorrect ? 'Correct Answer' : 'Incorrect Answer'}</strong>
              <p>{result.explanation}</p>
              {currentIndex < questions.length - 1 && (
                <button className="outline-btn" onClick={nextQuestion}>
                  Next Question
                </button>
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
