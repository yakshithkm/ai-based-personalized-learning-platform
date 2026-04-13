import { useEffect, useMemo, useState } from 'react';
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

const ExamSimulationPage = () => {
  const { user } = useAuth();
  const userExam = (user?.targetExam || user?.exam || 'NEET').trim().toUpperCase();

  const [mode, setMode] = useState('full-length');
  const [examType, setExamType] = useState(userExam || 'NEET');
  const [sectionSubject, setSectionSubject] = useState('Physics');
  const [strictNavigation, setStrictNavigation] = useState(true);

  const [session, setSession] = useState(null);
  const [result, setResult] = useState(null);
  const [timeLeftSec, setTimeLeftSec] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [localAnswers, setLocalAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

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
    if (!session || session.status !== 'active' || timeLeftSec > 0 || isSubmitting || result) return;

    const autoSubmit = async () => {
      try {
        setIsSubmitting(true);
        const { data } = await api.post(`/exams/sessions/${session.sessionId}/submit`);
        setResult(data);
        setSession((prev) => (prev ? { ...prev, status: 'expired', submittedAt: data.submittedAt } : prev));
      } catch (err) {
        setError(err?.response?.data?.message || 'Auto-submit failed. Please submit manually.');
      } finally {
        setIsSubmitting(false);
      }
    };

    autoSubmit();
  }, [timeLeftSec, session, isSubmitting, result]);

  const responsesMap = useMemo(() => {
    const map = new Map();
    (session?.responses || []).forEach((entry) => {
      map.set(entry.questionIndex, entry.selectedAnswerIndex);
    });
    return map;
  }, [session]);

  const questions = session?.questions || [];
  const currentQuestion = questions[currentIndex] || null;

  const getAnsweredValueByIndex = (index) => {
    const question = questions[index];
    if (!question) return undefined;
    const local = localAnswers[question._id];
    if (Number.isInteger(local)) return local;
    return responsesMap.get(index);
  };

  const answeredByIndex = useMemo(
    () =>
      questions.reduce((acc, question, index) => {
        acc[index] = Number.isInteger(getAnsweredValueByIndex(index));
        return acc;
      }, {}),
    [questions, responsesMap, localAnswers]
  );

  useEffect(() => {
    setCurrentIndex(0);
  }, [session?.sessionId]);

  useEffect(() => {
    if (!session?.sessionId) {
      setLocalAnswers({});
      setMarkedForReview({});
      return;
    }

    const answerRaw = localStorage.getItem(getSessionStorageKey(session.sessionId, 'answers'));
    const reviewRaw = localStorage.getItem(getSessionStorageKey(session.sessionId, 'review'));

    setLocalAnswers(answerRaw ? JSON.parse(answerRaw) : {});
    setMarkedForReview(reviewRaw ? JSON.parse(reviewRaw) : {});
  }, [session?.sessionId]);

  useEffect(() => {
    if (!session?.sessionId) return;
    localStorage.setItem(getSessionStorageKey(session.sessionId, 'answers'), JSON.stringify(localAnswers));
  }, [localAnswers, session?.sessionId]);

  useEffect(() => {
    if (!session?.sessionId) return;
    localStorage.setItem(getSessionStorageKey(session.sessionId, 'review'), JSON.stringify(markedForReview));
  }, [markedForReview, session?.sessionId]);

  useEffect(() => {
    if (!session || !session.strictNavigation) return;
    setCurrentIndex(Number(session.currentQuestionIndex || 0));
  }, [session]);

  useEffect(() => {
    console.log('Current Index:', currentIndex);
  }, [currentIndex]);

  useEffect(() => {
    if (!session || !currentQuestion) return;
    const preselected = getAnsweredValueByIndex(currentIndex);
    setSelectedAnswer(Number.isInteger(preselected) ? preselected : null);
  }, [currentIndex, responsesMap, localAnswers, session, currentQuestion]);

  useEffect(() => {
    if (!session || session.status !== 'active' || result) return undefined;

    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [session, result]);

  const startSimulation = async () => {
    setError('');
    setResult(null);

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
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setLocalAnswers({});
      setMarkedForReview({});
      setTimeLeftSec(Number(data.timeLeftSec || data.timeLimitSec || 0));
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to start exam simulation.');
    }
  };

  const saveAnswer = async (targetIndex = currentIndex, answerIndex = selectedAnswer) => {
    if (!session || session.status !== 'active') return;
    if (!Number.isInteger(answerIndex)) {
      setError('Select an option before saving your answer.');
      return;
    }

    const question = questions[targetIndex];
    if (!question) return;

    setLocalAnswers((prev) => ({
      ...prev,
      [question._id]: answerIndex,
    }));

    try {
      setError('');
      const { data } = await api.patch(`/exams/sessions/${session.sessionId}/answer`, {
        questionIndex: targetIndex,
        selectedAnswerIndex: answerIndex,
        timeTakenSec: 0,
      });
      setSession(data);

      const nextServerIndex = Number(data.currentQuestionIndex || targetIndex);
      setCurrentIndex(nextServerIndex);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save answer.');
    }
  };

  const goToQuestion = (index) => {
    if (!session || session.status !== 'active') return;
    if (index < 0 || index >= questions.length) return;
    if (session.strictNavigation) {
      if (!canGoNext() && index > currentIndex) return;
      if (index > currentIndex + 1) return;
    }
    setCurrentIndex(index);
  };

  const goToFirstUnanswered = () => {
    const unansweredIndex = questions.findIndex((_, index) => !answeredByIndex[index]);
    if (unansweredIndex < 0) return;
    goToQuestion(unansweredIndex);
  };

  const toggleMarkForReview = () => {
    if (!currentQuestion) return;
    setMarkedForReview((prev) => {
      const next = { ...prev };
      if (next[currentQuestion._id]) {
        delete next[currentQuestion._id];
      } else {
        next[currentQuestion._id] = true;
      }
      return next;
    });
  };

  const submitSimulation = async () => {
    if (!session || session.status !== 'active') return;
    const ok = window.confirm('Submit test now? You cannot change answers after submission.');
    if (!ok) return;

    try {
      setIsSubmitting(true);
      const { data } = await api.post(`/exams/sessions/${session.sessionId}/submit`);
      setResult(data);
      setSession((prev) => (prev ? { ...prev, status: 'submitted', submittedAt: data.submittedAt } : prev));
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to submit exam simulation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canGoNext = () => {
    if (!session?.strictNavigation) return true;
    if (!currentQuestion) return false;
    return Number.isInteger(getAnsweredValueByIndex(currentIndex));
  };

  const handleNext = () => {
    if (!session || !questions.length) return;
    setCurrentIndex((prev) => {
      if (session.strictNavigation && !Number.isInteger(getAnsweredValueByIndex(prev))) return prev;
      return Math.min(prev + 1, questions.length - 1);
    });
  };

  const handlePrevious = () => {
    if (!session || !questions.length) return;
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleOptionSelect = (answerIndex) => {
    if (!Number.isInteger(answerIndex)) return;
    setSelectedAnswer(answerIndex);
    saveAnswer(currentIndex, answerIndex);
  };

  useEffect(() => {
    if (!session || session.status !== 'active' || !questions.length || result) return undefined;

    const onKeyDown = (event) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleNext();
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePrevious();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session, questions.length, currentIndex, selectedAnswer, result, localAnswers, responsesMap]);

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

      {session?.generationNotice && (
        <section className="panel">
          <p>{session.generationNotice}</p>
        </section>
      )}

      {session && !result && (
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
              <span>Question {currentIndex + 1} / {session.questionCount}</span>
              <span className="progress-pill">Question {currentIndex + 1} / {questions.length || session.questionCount}</span>
              <span>Hints: OFF</span>
              <span>Explanations: OFF</span>
            </div>

            <div className="exam-question-card question-transition" key={currentQuestion?._id || currentIndex}>
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
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="exam-action-row">
              <button className="outline-btn" onClick={handlePrevious} disabled={currentIndex === 0}>
                Previous
              </button>
              <button className="outline-btn" onClick={() => saveAnswer(currentIndex)}>
                Save Answer
              </button>
              <button
                className="outline-btn"
                onClick={handleNext}
                disabled={currentIndex === questions.length - 1 || (session.strictNavigation && !Number.isInteger(getAnsweredValueByIndex(currentIndex)))}
              >
                Next
              </button>
              <button className="outline-btn" onClick={goToFirstUnanswered}>
                Jump to First Unanswered
              </button>
              <button className="outline-btn" onClick={toggleMarkForReview}>
                {currentQuestion && markedForReview[currentQuestion._id] ? 'Unmark Review' : 'Mark for Review'}
              </button>
              <button className="solid-btn" onClick={submitSimulation} disabled={isSubmitting}>
                Submit Test
              </button>
            </div>
          </section>

          <section className="panel">
            <h3>Question Palette</h3>
            <div className="palette-grid">
              {questions.map((question, index) => {
                const answered = Boolean(answeredByIndex[index]);
                const marked = Boolean(markedForReview[question._id]);
                return (
                <button
                  key={question._id || index}
                  className={`palette-btn ${index === currentIndex ? 'current' : ''} ${answered ? 'answered' : 'unanswered'} ${marked ? 'review' : ''}`}
                  onClick={() => goToQuestion(index)}
                >
                  <span className="palette-number">{index + 1}</span>
                  <span className="palette-state">{answered ? 'Answered' : 'Not Answered'}</span>
                  {marked && <span className="palette-review-flag">Review</span>}
                </button>
                );
              })}
            </div>
          </section>
        </>
      )}

      {result && (
        <section className="panel">
          <h3>Post-Test Result</h3>
          <div className="exam-score-grid">
            <div className="score-box">
              <span>Total Score</span>
              <strong>{result.scoreSummary.totalScore} / {result.scoreSummary.maxScore}</strong>
            </div>
            <div className="score-box">
              <span>Percentile Estimate</span>
              <strong>{result.scoreSummary.percentileEstimate}%</strong>
            </div>
            <div className="score-box">
              <span>Estimated Rank Range</span>
              <strong>
                {result.scoreSummary.rankRange.low} - {result.scoreSummary.rankRange.high}
              </strong>
            </div>
          </div>

          <div className="exam-interpretation-box">
            <h4>Score Interpretation</h4>
            <p>{result.scoreInterpretation?.message}</p>
            <p>{result.scoreInterpretation?.rankMessage}</p>
            <p>{result.scoreInterpretation?.strengthWeaknessMessage}</p>
            <p>{result.scoreInterpretation?.whyThisRank}</p>
            <p>{result.scoreInterpretation?.howScoreCompares}</p>
            <p>
              Confidence: {result.scoreInterpretation?.confidenceLevel || 'medium'}
              {' '}({result.scoreInterpretation?.confidenceReason})
            </p>
          </div>

          <div className="exam-interpretation-box">
            <h4>Blueprint Credibility</h4>
            {(result.blueprintDiagnostics?.warnings || []).length > 0 && (
              <p>
                Limited question availability detected. Generated a slightly adjusted mock test.
              </p>
            )}
            <p>
              PYQ share: {result.blueprintDiagnostics?.pyqSharePct ?? 0}%
              {' '}({result.blueprintDiagnostics?.pyqCount ?? 0} questions)
            </p>
            <p>
              Requested vs actual questions: {result.blueprintDiagnostics?.expectedTotal ?? result.scoreSummary?.maxScore / 4}
              {' '}requested, {result.blueprintDiagnostics?.actualTotal ?? result.scoreSummary?.maxScore / 4} generated.
            </p>
            <p>
              Question mix: PYQ {result.blueprintDiagnostics?.pyqSharePct ?? 0}%,
              {' '}Conceptual {result.blueprintDiagnostics?.yearTagMix?.Conceptual || 0} / {result.scoreSummary?.maxScore ? Math.round((result.blueprintDiagnostics?.yearTagMix?.Conceptual || 0) * 100 / (result.scoreSummary.maxScore / 4)) : 0}%
            </p>
            <p>
              Subject share: {Object.entries(result.blueprintDiagnostics?.subjectSharePct || {})
                .map(([subject, share]) => `${subject} ${share}%`)
                .join(' | ')}
            </p>
            <p>
              Simulated rank based on {result.scoreSummary?.totalCandidates || 0} candidates.
            </p>
          </div>

          <div className="exam-result-split">
            <div>
              <h4>Subject Analysis</h4>
              {(result.postTestAnalysis.accuracyPerSubject || []).map((row) => (
                <p key={row.subject}>
                  {row.subject}: accuracy {row.accuracy}% ({row.attempted}/{row.total})
                </p>
              ))}
            </div>

            <div>
              <h4>Time Spent</h4>
              {(result.postTestAnalysis.timeSpentPerSubject || []).map((row) => (
                <p key={row.subject}>
                  {row.subject}: {Math.round(row.timeSpentSec)}s total, {Math.round(row.avgTimePerAttemptSec)}s avg/attempt
                </p>
              ))}
            </div>
          </div>

          <div className="exam-result-split">
            <div>
              <h4>Top Mistakes</h4>
              {(result.postTestAnalysis.topMistakes || []).length === 0 && <p>No major repeated mistake pattern found.</p>}
              {(result.postTestAnalysis.topMistakes || []).map((item) => (
                <p key={`${item.subject}-${item.concept}`}>
                  {item.subject} - {item.concept}: {item.count} wrong
                </p>
              ))}
            </div>

            <div>
              <h4>Improvement Projection</h4>
              <p>{result.postTestAnalysis.improvementProjection?.message}</p>
              <h4>Adaptive Follow-Up</h4>
              {(result.adaptiveFollowUp.nextPracticePlan || []).map((item) => (
                <p key={`${item.type}-${item.label}`}>
                  {item.label}: {item.reason}
                </p>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default ExamSimulationPage;
