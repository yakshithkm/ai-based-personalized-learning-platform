import { useEffect, useState } from 'react';
import api from '../api/client';

const DashboardPage = () => {
  const [analytics, setAnalytics] = useState(null);
  const [recommendationPayload, setRecommendationPayload] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [aRes, rRes] = await Promise.all([
          api.get('/analytics/me'),
          api.get('/recommendations/me'),
        ]);
        setAnalytics(aRes.data);
        setRecommendationPayload(rRes.data);
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load dashboard');
      }
    };

    load();
  }, []);

  const perf = analytics?.performance;
  const accuracy = perf?.overallAccuracy ?? 0;
  const accuracyTone = accuracy >= 75 ? 'good' : accuracy >= 50 ? 'mid' : 'bad';

  return (
    <div className="page-grid">
      <section className="panel hero-panel">
        <h2>Personalized Dashboard</h2>
        <p>Track your preparation velocity and focus where it matters most.</p>
      </section>

      {error && <section className="panel error-text">{error}</section>}

      <section className="panel stats-grid">
        <div className="metric-card metric-neutral">
          <h4>Total Attempts</h4>
          <strong>{perf?.totalAttempts ?? 0}</strong>
          <p>Practice sessions completed</p>
        </div>
        <div className={`metric-card metric-${accuracyTone}`}>
          <h4>Accuracy</h4>
          <strong>{accuracy.toFixed(1)}%</strong>
          <p>{accuracy >= 75 ? 'High performance' : 'Needs focused revision'}</p>
        </div>
        <div className="metric-card metric-neutral">
          <h4>Avg. Time</h4>
          <strong>{(perf?.averageTimeTakenSec ?? 0).toFixed(1)} sec</strong>
          <p>Average response speed</p>
        </div>
      </section>

      <section className="panel">
        <h3>Detected Weak Topics</h3>
        <div className="chip-wrap">
          {(recommendationPayload?.weakTopics || perf?.weakTopics || []).length ? (
            (recommendationPayload?.weakTopics || perf?.weakTopics || []).map((topic) => (
              <span key={topic} className="chip alert">
                {topic}
              </span>
            ))
          ) : (
            <p>No weak topics yet. Keep practicing to generate insights.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <h3>Recommended Questions</h3>
        <div className="question-list">
          {(recommendationPayload?.recommendations || []).slice(0, 6).map((question) => (
            <article key={question._id} className="question-item">
              <h4>{question.subject} - {question.topic}</h4>
              <p>{question.text}</p>
              <small>{question.difficulty}</small>
            </article>
          ))}
          {!recommendationPayload?.recommendations?.length && <p>No recommendations available.</p>}
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
