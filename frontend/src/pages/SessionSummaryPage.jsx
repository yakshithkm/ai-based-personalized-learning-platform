import { useLocation, useNavigate } from 'react-router-dom';

const SessionSummaryPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const summary = location.state?.summary;

  if (!summary) {
    return (
      <div className="page-grid">
        <section className="panel">
          <h2>Session Summary</h2>
          <p>No session summary available. Start a practice session first.</p>
          <button className="solid-btn" onClick={() => navigate('/practice?mode=focus')}>
            Start Focus Session
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel hero-panel">
        <h2>Session Summary</h2>
        <p>Review your performance and continue with smart next steps.</p>
        {!!summary.earnedXp && <p className="xp-pop summary-xp">Session reward: +{summary.earnedXp} XP</p>}
      </section>

      <section className="panel stats-grid">
        <article className="metric-card metric-neutral">
          <h4>Accuracy</h4>
          <strong>{summary.accuracy}%</strong>
          <p>{summary.correct}/{summary.total} correct</p>
        </article>
        <article className="metric-card metric-neutral">
          <h4>Weak Areas</h4>
          <strong>{summary.weakAreas?.length || 0}</strong>
          <p>Topics needing revision</p>
        </article>
        <article className="metric-card metric-neutral">
          <h4>Next Mix</h4>
          <strong>{summary.nextRecommendedSession ? 'Adaptive' : 'Recommended'}</strong>
          <p>Prepared for your next session</p>
        </article>
      </section>

      <section className="panel">
        <h3>Weak Areas</h3>
        {(summary.weakAreas || []).length ? (
          <div className="chip-wrap">
            {summary.weakAreas.map((area) => (
              <span className="chip alert" key={area}>{area}</span>
            ))}
          </div>
        ) : (
          <p>No weak areas detected in this session.</p>
        )}
      </section>

      <section className="panel">
        <h3>Improvement Suggestion</h3>
        <p>{summary.improvementSuggestion}</p>
      </section>

      <section className="panel next-step-panel">
        <h3>Continue Smart Practice</h3>
        <div className="feedback-actions">
          <button className="solid-btn" onClick={() => navigate('/practice?mode=recommended')}>
            Continue Smart Practice
          </button>
          <button className="outline-btn" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </section>
    </div>
  );
};

export default SessionSummaryPage;
