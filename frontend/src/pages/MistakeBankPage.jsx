import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import EmptyState from '../components/EmptyState';
import { subjectColor } from '../utils/subjectVisuals';
import { formatRelativeTime } from '../utils/achievements';

const MistakeBankPage = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const { data } = await api.get('/analytics/me');
      setAnalytics(data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load mistake bank');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const mistakeBank = analytics?.mistakeBank || {};
  const recentMistakes = mistakeBank.recentMistakes || [];
  const repeatedMistakes = mistakeBank.repeatedMistakes || [];

  const goPractice = (subject, topic) => {
    navigate(`/practice?topic=${encodeURIComponent(`${subject} - ${topic}`)}`);
  };

  if (!analytics && !error) {
    return (
      <div className="page-grid">
        <section className="panel" aria-busy="true" aria-label="Loading mistake bank">
          <div className="skeleton-chip" style={{ width: '200px', marginBottom: '0.7rem' }} />
          <div className="skeleton-block" style={{ minHeight: '260px' }} />
        </section>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="page-grid">
        <section className="panel error-state-card">
          <h3>Couldn&apos;t load your mistake bank</h3>
          <p>{error}</p>
          <button type="button" className="solid-btn" onClick={load}>Try again</button>
        </section>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Mistake Bank</h2>
        <p>Every question you've gotten wrong, tracked for spaced-repetition review.</p>
      </section>

      {repeatedMistakes.length > 0 && (
        <section className="panel">
          <h3>Repeated Patterns</h3>
          <p className="dash-card-subtitle">Topics where the same mistake keeps coming back.</p>
          <div className="repeated-mistake-list">
            {repeatedMistakes.map((entry, index) => (
              <button
                type="button"
                key={`${entry.subject}-${entry.topic}-${index}`}
                className="repeated-mistake-row"
                onClick={() => goPractice(entry.subject, entry.topic)}
              >
                <span className="subject-dot" style={{ background: subjectColor(entry.subject) }} />
                <span className="repeated-mistake-info">
                  <strong>{entry.topic}</strong>
                  <small>{entry.subject}</small>
                </span>
                <span className="severity-badge severity-critical">{entry.failures}x missed</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <h3>Recent Mistakes</h3>
        {recentMistakes.length ? (
          <div className="mistake-list">
            {recentMistakes.map((mistake) => (
              <article key={mistake._id || `${mistake.subject}-${mistake.topic}-${mistake.createdAt}`} className="mistake-row">
                <span className="subject-dot" style={{ background: subjectColor(mistake.subject) }} />
                <div className="mistake-info">
                  <strong>{mistake.topic}</strong>
                  <small>
                    {mistake.subject}
                    {mistake.subtopic && mistake.subtopic !== 'General' ? ` • ${mistake.subtopic}` : ''}
                    {mistake.mistakeType ? ` • ${mistake.mistakeType.replace(/-/g, ' ')}` : ''}
                  </small>
                </div>
                <span className={`severity-badge ${mistake.resolved ? 'severity-moderate' : 'severity-weak'}`}>
                  {mistake.resolved ? 'Resolved' : 'Pending Review'}
                </span>
                <span className="mistake-time">{formatRelativeTime(mistake.createdAt)}</span>
                <button type="button" className="outline-btn dash-small-btn" onClick={() => goPractice(mistake.subject, mistake.topic)}>
                  Retry
                </button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="practice"
            title="No mistakes logged"
            description="Strong consistency so far — every mistake you make in practice or exam simulation will show up here for review."
            actionLabel="Go to Practice"
            onAction={() => navigate('/practice')}
          />
        )}
      </section>

      {error && <section className="panel error-text">{error}</section>}
    </div>
  );
};

export default MistakeBankPage;