import { Navigate, useLocation, useNavigate } from 'react-router-dom';

const ExamSimulationResultPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const result = location.state?.result;

  if (!result) {
    return <Navigate to="/exam-simulation" replace />;
  }

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
