import { useEffect, useState } from 'react';
import api from '../api/client';

const AdminAnalyticsPage = () => {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/analytics/admin-summary', { params: { days: 14 } });
        setSummary(data);
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load admin analytics');
      }
    };

    load();
  }, []);

  return (
    <div className="page-grid">
      <section className="panel hero-panel">
        <h2>Admin Product Analytics</h2>
        <p>Behavior insights for retention and drop-off diagnostics.</p>
      </section>

      {error && <section className="panel error-text">{error}</section>}

      <section className="panel stats-grid">
        <article className="metric-card metric-neutral">
          <h4>DAU (Today)</h4>
          <strong>{summary?.retention?.dauToday ?? '--'}</strong>
          <p>Daily Active Users</p>
        </article>
        <article className="metric-card metric-neutral">
          <h4>Session Completion</h4>
          <strong>{summary ? `${summary.sessions.sessionCompletionRate}%` : '--'}</strong>
          <p>Completed / Started</p>
        </article>
        <article className="metric-card metric-neutral">
          <h4>Next-Day Retention</h4>
          <strong>{summary ? `${summary.retention.nextDayRetention}%` : '--'}</strong>
          <p>Returning users (D+1)</p>
        </article>
      </section>

      <section className="panel">
        <h3>Funnel</h3>
        <div className="funnel-grid">
          <article className="priority-item">
            <h4>Start Session</h4>
            <strong>{summary?.funnel?.started ?? 0}</strong>
          </article>
          <article className="priority-item">
            <h4>Answer Question</h4>
            <strong>{summary?.funnel?.answered ?? 0}</strong>
          </article>
          <article className="priority-item">
            <h4>Complete Session</h4>
            <strong>{summary?.funnel?.completed ?? 0}</strong>
          </article>
        </div>
      </section>

      <section className="panel">
        <h3>Retention Metrics</h3>
        <div className="priority-list">
          <article className="priority-item">
            <p>Average DAU (7-day): {summary?.retention?.dauAvg7 ?? 0}</p>
            <p>Average session length: {summary?.sessions?.averageSessionLengthSec ?? 0} sec</p>
            <p>Events tracked in window: {summary?.eventsTracked ?? 0}</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <h3>Drop-off Detection</h3>
        <div className="priority-list">
          <article className="priority-item">
            <p>After first question: {summary?.sessions?.dropOff?.afterFirstQuestion ?? 0}</p>
            <p>Mid-session: {summary?.sessions?.dropOff?.midSession ?? 0}</p>
            <p>After seeing feedback: {summary?.sessions?.dropOff?.afterFeedback ?? 0}</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <h3>Most Skipped Features</h3>
        <div className="priority-list">
          {(summary?.mostSkippedFeatures || []).map((item) => (
            <article key={item.feature} className="priority-item">
              <h4>{item.feature}</h4>
              <p>Clicks: {item.clicks}</p>
              <p>Skipped estimate: {item.skippedEstimate}</p>
            </article>
          ))}
          {!summary?.mostSkippedFeatures?.length && <p>No feature usage data yet.</p>}
        </div>
      </section>
    </div>
  );
};

export default AdminAnalyticsPage;
