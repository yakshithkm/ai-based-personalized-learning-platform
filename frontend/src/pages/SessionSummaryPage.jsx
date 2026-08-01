import { useLocation, useNavigate } from 'react-router-dom';
import { trackProductEvent } from '../utils/productEvents';

const getReadinessLabel = (accuracy = 0) => {
  if (accuracy >= 75) return 'Exam Ready';
  if (accuracy >= 50) return 'Improving';
  return 'Not Ready';
};

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
      <section className="panel hero-panel mentor-hero-panel">
        <p className="eyebrow-label">Session End</p>
        <h2>Your Mentor Judged This Session</h2>
        <p>Now the question is not what you solved, but what your result says about your preparation.</p>
        {!!summary.earnedXp && <p className="xp-pop summary-xp">Session reward: +{summary.earnedXp} XP</p>}
      </section>

      <section className="panel mentor-card mentor-glow-panel">
        <p className="eyebrow-label">Mentor Feedback</p>
        <h3>Your Mentor Says</h3>
        <p className="mentor-summary-text">{summary.mentorFeedback}</p>
        <div className="mentor-mini-notes">
          <p><strong>Score:</strong> {summary.accuracy}% accuracy ({summary.correct}/{summary.total})</p>
          <p><strong>Interpretation:</strong> {summary.scoreInterpretation || getReadinessLabel(summary.accuracy)}</p>
          <p><strong>Key Pattern:</strong> {summary.keyPattern || 'No dominant failure pattern found.'}</p>
        </div>
      </section>

      <section className="panel insight-breakdown-panel">
        <div className="panel-head-row">
          <h3>Insight Breakdown</h3>
          <span className="subtle-label">Strengths, weaknesses, key pattern</span>
        </div>
        <div className="insight-mini-grid">
          <article className="insight-mini-card">
            <h4>Strengths</h4>
            {(summary.strengths || []).length ? summary.strengths.map((area) => <p key={area}>{area}</p>) : <p>No clear strength yet.</p>}
          </article>
          <article className="insight-mini-card">
            <h4>Weaknesses</h4>
            {(summary.weakAreas || []).length ? summary.weakAreas.map((area) => <p key={area}>{area}</p>) : <p>No weak areas detected in this session.</p>}
          </article>
          <article className="insight-mini-card">
            <h4>Key Pattern</h4>
            <p>{summary.keyPattern || 'No dominant pattern detected.'}</p>
          </article>
        </div>
      </section>

      <section className="panel readiness-panel">
        <div className="readiness-head">
          <div>
            <p className="eyebrow-label">Readiness</p>
            <h3>{getReadinessLabel(summary.accuracy)}</h3>
          </div>
          <strong className="readiness-score">{summary.accuracy}</strong>
        </div>
        <div className="readiness-meter">
          <span className="readiness-meter-fill" style={{ width: `${summary.accuracy}%` }} />
        </div>
        <p>{summary.improvementSuggestion}</p>
      </section>

      <section className="panel next-step-panel dominant-cta-panel">
        <p className="eyebrow-label">Next Action</p>
        <h3>{summary.nextAction?.label || 'Continue Smart Practice'}</h3>
        <p>{summary.nextAction?.label === 'Take Full Mock Test' ? 'You are ready for exam pressure. Use it.' : 'Stay focused on the correction that will raise your score fastest.'}</p>
        <div className="feedback-actions">
          <button
            className="solid-btn primary-cta-btn"
            onClick={() => {
              trackProductEvent('next_action_clicked', {
                cta: summary.nextAction?.label || 'continue_smart_practice',
                source: 'session_summary',
                sessionId: summary.sessionId || null,
              });
              navigate(summary.nextAction?.route || '/practice?mode=recommended');
            }}
          >
            {summary.nextAction?.label || 'Continue Smart Practice'}
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
