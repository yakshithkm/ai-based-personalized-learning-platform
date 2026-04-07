import { useEffect, useState } from 'react';
import api from '../api/client';

const StatIcon = ({ kind }) => {
  if (kind === 'attempts') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3h14v2H5V3zm0 4h14v14H5V7zm3 3v2h8v-2H8zm0 4v2h6v-2H8z" />
      </svg>
    );
  }

  if (kind === 'accuracy') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2l8 4v6c0 5.25-3.4 9.74-8 11-4.6-1.26-8-5.75-8-11V6l8-4zm-1 12l6-6-1.4-1.4L11 11.2 8.8 9 7.4 10.4 11 14z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 1a10 10 0 100 20 10 10 0 000-20zm1 10.4V6h-2v6.2l4.6 2.8 1-1.7-3.6-2.1z" />
    </svg>
  );
};

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
  const isLoading = !analytics || !recommendationPayload;
  const weakTopicPriority = analytics?.weakTopicPriority || perf?.weakTopicPriority || [];
  const focusSuggestion = analytics?.suggestedFocusTopic || perf?.suggestedFocusTopic || '';
  const difficultyPlan = recommendationPayload?.difficultyPlan || {};

  return (
    <div className="page-grid">
      <section className="panel hero-panel">
        <h2>Personalized Dashboard</h2>
        <p>Track your preparation velocity and focus where it matters most.</p>
      </section>

      {error && <section className="panel error-text">{error}</section>}

      <section className="panel stats-grid">
        <div className="metric-card metric-neutral">
          <span className="metric-icon"><StatIcon kind="attempts" /></span>
          <h4>Total Attempts</h4>
          <strong>{isLoading ? '--' : perf?.totalAttempts ?? 0}</strong>
          <p>Practice sessions completed</p>
        </div>
        <div className={`metric-card metric-${accuracyTone}`}>
          <span className="metric-icon"><StatIcon kind="accuracy" /></span>
          <h4>Accuracy</h4>
          <strong>{isLoading ? '--' : `${accuracy.toFixed(1)}%`}</strong>
          <p>{accuracy >= 75 ? 'High performance' : 'Needs focused revision'}</p>
        </div>
        <div className="metric-card metric-neutral">
          <span className="metric-icon"><StatIcon kind="time" /></span>
          <h4>Avg. Time</h4>
          <strong>{isLoading ? '--' : `${(perf?.averageTimeTakenSec ?? 0).toFixed(1)} sec`}</strong>
          <p>Average response speed</p>
        </div>
      </section>

      <section className="panel">
        <h3>Detected Weak Topics</h3>
        <div className="chip-wrap">
          {isLoading ? (
            <>
              <span className="skeleton-chip" />
              <span className="skeleton-chip" />
              <span className="skeleton-chip" />
            </>
          ) : (recommendationPayload?.weakTopics || perf?.weakTopics || []).length ? (
            (recommendationPayload?.weakTopics || perf?.weakTopics || []).map((topic) => (
              <span key={topic} className="chip alert weak-badge">
                {topic}
              </span>
            ))
          ) : (
            <p>No weak topics yet. Keep practicing to generate insights.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <h3>Weak Topic Priority</h3>
        <p>{isLoading ? 'Calculating adaptive focus...' : focusSuggestion || 'Keep practicing to unlock adaptive focus suggestions.'}</p>
        <div className="priority-list">
          {isLoading ? (
            <>
              <div className="priority-item skeleton-block" />
              <div className="priority-item skeleton-block" />
            </>
          ) : weakTopicPriority.length ? (
            weakTopicPriority.slice(0, 5).map((entry) => {
              const focusScore = Number(entry.focusScore || 0);
              const accuracyValue = Number(entry.accuracy || 0);
              const avgTime = Number(entry.avgTimeTakenSec || 0);

              return (
                <article key={`${entry.subject}-${entry.topic}`} className="priority-item">
                  <div className="priority-head">
                    <h4>{entry.subject} - {entry.topic}</h4>
                    <span className="priority-score">Focus {focusScore.toFixed(1)}</span>
                  </div>
                  <div className="priority-metrics">
                    <small>Accuracy: {accuracyValue.toFixed(1)}%</small>
                    <small>Avg Time: {avgTime.toFixed(1)} sec</small>
                  </div>
                </article>
              );
            })
          ) : (
            <p>No priority topics yet. Attempt more questions for targeted guidance.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <h3>Recommended Questions</h3>
        {!!Object.keys(difficultyPlan).length && (
          <p className="recommendation-meta">
            Adaptive mix: Medium {difficultyPlan.Medium || 0}, Easy {difficultyPlan.Easy || 0}, Hard {difficultyPlan.Hard || 0}
          </p>
        )}
        <div className="question-list">
          {isLoading && (
            <>
              <div className="question-item skeleton-block" />
              <div className="question-item skeleton-block" />
            </>
          )}

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
