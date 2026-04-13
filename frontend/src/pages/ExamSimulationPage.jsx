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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
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
  const currentQuestion = questions[currentQuestionIndex] || null;

  useEffect(() => {
    setCurrentQuestionIndex(0);
  }, [questions]);

  useEffect(() => {
    if (!session || !session.strictNavigation) return;
    setCurrentQuestionIndex(Number(session.currentQuestionIndex || 0));
  }, [session]);

  useEffect(() => {
    if (!session || !session.strictNavigation || !currentQuestion) return;
    console.log('Current Index:', currentQuestionIndex);
  }, [currentQuestionIndex, session, currentQuestion]);

  useEffect(() => {
    if (!session) return;
    const preselected = responsesMap.has(currentQuestionIndex) ? responsesMap.get(currentQuestionIndex) : null;
    setSelectedAnswer(Number.isInteger(preselected) ? preselected : null);
  }, [currentQuestionIndex, responsesMap, session]);

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
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setTimeLeftSec(Number(data.timeLeftSec || data.timeLimitSec || 0));
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to start exam simulation.');
    }
  };

  const saveAnswer = async (targetIndex = currentQuestionIndex) => {
    if (!session || session.status !== 'active') return;
    if (!Number.isInteger(selectedAnswer)) {
      setError('Select an option before saving your answer.');
      return;
    }

    try {
      setError('');
      const { data } = await api.patch(`/exams/sessions/${session.sessionId}/answer`, {
        questionIndex: targetIndex,
        selectedAnswerIndex: selectedAnswer,
        timeTakenSec: 0,
      });
      setSession(data);

      const nextServerIndex = Number(data.currentQuestionIndex || targetIndex);
      setCurrentQuestionIndex(nextServerIndex);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save answer.');
    }
  };

  const goToQuestion = (index) => {
    if (!session || session.status !== 'active') return;
    if (index < 0 || index >= questions.length) return;
    if (session.strictNavigation && index > currentQuestionIndex + 1) return;
    setCurrentQuestionIndex(index);
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
    return responsesMap.has(currentQuestionIndex);
  };

  const handleNext = () => {
    if (!session || !questions.length) return;
    if (!canGoNext()) return;
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!session || !questions.length) return;
    if (session.strictNavigation) return;
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

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
              <span>Question {currentQuestionIndex + 1} / {session.questionCount}</span>
              <span>Hints: OFF</span>
              <span>Explanations: OFF</span>
            </div>

            <div className="exam-question-card">
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
                    onClick={() => setSelectedAnswer(idx)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="exam-action-row">
              <button className="outline-btn" onClick={handlePrevious} disabled={session.strictNavigation || currentQuestionIndex === 0}>
                Previous
              </button>
              <button className="outline-btn" onClick={() => saveAnswer(currentQuestionIndex)}>
                Save Answer
              </button>
              <button
                className="outline-btn"
                onClick={handleNext}
                disabled={currentQuestionIndex === questions.length - 1 || !canGoNext()}
              >
                Next
              </button>
              <button className="solid-btn" onClick={submitSimulation} disabled={isSubmitting}>
                Submit Test
              </button>
            </div>
          </section>

          <section className="panel">
            <h3>Question Palette</h3>
            <div className="palette-grid">
              {(session.palette || []).map((entry) => (
                <button
                  key={entry.index}
                  className={`palette-btn ${entry.index === currentQuestionIndex ? 'current' : ''} ${entry.status}`}
                  onClick={() => goToQuestion(entry.index)}
                >
                  {entry.index + 1}
                </button>
              ))}
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
