import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { emitAttemptSubmitted } from '../utils/appEvents';

const formatDuration = (totalSeconds = 0) => {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

const ExamSimulationResultPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [result, setResult] = useState(location.state?.result || null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const sessionId = location.state?.sessionId || null;

  useEffect(() => {
    if (!sessionId) return;

    const fetchResultSummary = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/exams/sessions/${sessionId}`);
        if (data?.resultSummary) {
          setResult(data.resultSummary);
        } else {
          setFetchError('Result summary is not available yet for this session.');
        }
      } catch (error) {
        setFetchError(error?.response?.data?.message || 'Unable to fetch exam result details.');
      } finally {
        setLoading(false);
      }
    };

    fetchResultSummary();
  }, [sessionId]);

  // Notify the app shell once a result is showing (whether it arrived via
  // navigation state right after finishing the exam, or via the fetch
  // above) so the header streak pill refreshes immediately instead of
  // waiting for the next full page load.
  useEffect(() => {
    if (result) {
      emitAttemptSubmitted({ source: 'exam-simulation' });
    }
  }, [result]);

  if (!result && !sessionId) {
    return <Navigate to="/exam-simulation" replace />;
  }

  if (!result) {
    return (
      <div className="page-grid">
        <section className="panel">
          <h2>Exam Result</h2>
          <p>{loading ? 'Loading full analytics...' : fetchError || 'Result not available.'}</p>
          <div className="exam-action-row">
            <button className="outline-btn" onClick={() => navigate('/exam-simulation')}>
              Back to Simulation
            </button>
          </div>
        </section>
      </div>
    );
  }

  const weakTopics = (result.postTestAnalysis?.topMistakes || []).slice(0, 5);
  const mistakePatterns = (result.postTestAnalysis?.topMistakes || []).slice(0, 5);
  const nextActions = result.adaptiveFollowUp?.nextPracticePlan || [];
  const accuracyPerSubject = result.postTestAnalysis?.accuracyPerSubject || [];
  const timeSpentPerSubject = result.postTestAnalysis?.timeSpentPerSubject || [];
  const { correct = 0, wrong = 0, unattempted = 0 } = result.scoreSummary || {};
  const attemptedTotal = correct + wrong;
  const examAccuracy = attemptedTotal ? (correct / attemptedTotal) * 100 : 0;
  const totalTimeSpentSec = timeSpentPerSubject.reduce((sum, row) => sum + Number(row.timeSpentSec || 0), 0);

  const goPracticeWeakSubject = () => {
    const target = result.postTestAnalysis?.weakSubjects?.[0]?.subject;
    navigate(target ? `/practice?topic=${encodeURIComponent(`${target} - `)}` : '/practice');
  };

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Exam Result</h2>
        <p>Your simulation is complete. Review your performance summary below.</p>
      </section>

      <section className="panel">
        <h3>Post-Test Result</h3>
        <div className="exam-score-grid">
          <div className="score-box">
            <span>Total Score</span>
            <strong>{result.scoreSummary.totalScore} / {result.scoreSummary.maxScore}</strong>
          </div>
          <div className="score-box">
            <span>Accuracy</span>
            <strong>{examAccuracy.toFixed(1)}%</strong>
          </div>
          <div className="score-box">
            <span>Correct</span>
            <strong>{correct}</strong>
          </div>
          <div className="score-box">
            <span>Incorrect</span>
            <strong>{wrong}</strong>
          </div>
          <div className="score-box">
            <span>Unanswered</span>
            <strong>{unattempted}</strong>
          </div>
          {totalTimeSpentSec > 0 && (
            <div className="score-box">
              <span>Time Taken</span>
              <strong>{formatDuration(totalTimeSpentSec)}</strong>
            </div>
          )}
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

        {!!accuracyPerSubject.length && (
          <div className="exam-interpretation-box">
            <h4>Performance by Subject</h4>
            <div className="mistake-grid">
              {accuracyPerSubject.map((row) => (
                <div className="score-box" key={row.subject}>
                  <span>{row.subject}</span>
                  <strong>{Number(row.accuracy || 0).toFixed(0)}%</strong>
                  <small>{row.attempted}/{row.total} attempted</small>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="exam-interpretation-box">
          <h4>Score Interpretation</h4>
          <p>{result.scoreInterpretation?.message}</p>
          <p>{result.scoreInterpretation?.rankMessage}</p>
          <p>{result.scoreInterpretation?.strengthWeaknessMessage}</p>
          <p>{result.scoreInterpretation?.whyThisRank}</p>
          <p>{result.scoreInterpretation?.howScoreCompares}</p>
        </div>

        <div className="exam-result-split">
          <div className="exam-interpretation-box">
            <h4>Weak Topics</h4>
            {weakTopics.length === 0 && <p>No major weak topics detected.</p>}
            {weakTopics.map((item) => (
              <p key={`${item.subject}-${item.concept}`}>
                {item.subject}: {item.concept}
              </p>
            ))}
          </div>

          <div className="exam-interpretation-box">
            <h4>Mistake Patterns</h4>
            {mistakePatterns.length === 0 && <p>No repeated mistake pattern detected.</p>}
            {mistakePatterns.map((item) => (
              <p key={`${item.subject}-${item.concept}-pattern`}>
                {item.subject} - {item.concept}: {item.count} repeated
              </p>
            ))}
          </div>
        </div>

        <div className="exam-interpretation-box">
          <h4>Next Recommended Action</h4>
          {nextActions.length === 0 && <p>Continue with a balanced timed practice set.</p>}
          {nextActions.map((action, index) => (
            <p key={`${action.type}-${index}`}>
              {action.label}: {action.reason}
            </p>
          ))}
        </div>

        <div className="exam-action-row">
          {!!result.postTestAnalysis?.weakSubjects?.length && (
            <button className="outline-btn" onClick={goPracticeWeakSubject}>
              Practice Weak Topics
            </button>
          )}
          <button className="outline-btn" onClick={() => navigate('/exam-simulation')}>
            Take Another Exam
          </button>
          <button className="solid-btn" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </section>
    </div>
  );
};

export default ExamSimulationResultPage;