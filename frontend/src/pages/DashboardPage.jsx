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

  return (
    <div className="page-grid">
      <section className="panel hero-panel">
        <h2>Personalized Dashboard</h2>
        <p>Track your preparation velocity and focus where it matters most.</p>
      </section>

      {error && <section className="panel error-text">{error}</section>}

      <section className="panel stats-grid">
        <div>
          <h4>Total Attempts</h4>
          <strong>{perf?.totalAttempts ?? 0}</strong>
        </div>
        <div>
          <h4>Accuracy</h4>
          <strong>{(perf?.overallAccuracy ?? 0).toFixed(1)}%</strong>
        </div>
        <div>
          <h4>Avg. Time</h4>
          <strong>{(perf?.averageTimeTakenSec ?? 0).toFixed(1)} sec</strong>
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
