import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/client';

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
          <button className="outline-btn" onClick={() => navigate('/exam-simulation')}>
            Start New Simulation
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
