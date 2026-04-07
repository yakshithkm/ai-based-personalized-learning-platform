import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../api/client';

const chartTooltipStyle = {
  backgroundColor: '#111827',
  border: '1px solid rgba(96, 165, 250, 0.4)',
  borderRadius: '12px',
  boxShadow: '0 14px 30px rgba(15, 23, 42, 0.6)',
  color: '#dbeafe',
};

const AnalyticsPage = () => {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/analytics/me');
        setPayload(data);
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load analytics');
      }
    };

    load();
  }, []);

  const bySubject = payload?.attemptsBySubject || [];
  const weakTopicPriority = payload?.weakTopicPriority || [];
  const focusSuggestion = payload?.suggestedFocusTopic || '';
  const accuracyTrend = payload?.accuracyTrend || 'stable';
  const timeAccuracyCorrelation = Number(payload?.timeAccuracyCorrelation || 0);

  const trend = (payload?.recentAttempts || []).map((entry, index) => ({
    idx: index + 1,
    accuracy: entry.isCorrect ? 100 : 0,
    timeTakenSec: entry.timeTakenSec,
  }));

  const maxFocusScore = weakTopicPriority.length
    ? Math.max(...weakTopicPriority.map((entry) => entry.focusScore || 0), 1)
    : 1;

  const trendLabel =
    accuracyTrend === 'improving'
      ? 'Improving'
      : accuracyTrend === 'declining'
        ? 'Declining'
        : 'Stable';

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Analytics</h2>
        <p>Visualize accuracy and speed trends across your attempt history.</p>
      </section>

      <section className="panel stats-grid analytics-summary-grid">
        <div className="metric-card metric-neutral">
          <h4>Accuracy Trend</h4>
          <strong>{trendLabel}</strong>
          <p>Computed from your latest weighted attempts.</p>
        </div>
        <div className="metric-card metric-neutral">
          <h4>Time vs Accuracy Correlation</h4>
          <strong>{timeAccuracyCorrelation.toFixed(3)}</strong>
          <p>Negative means faster solving aligns with better accuracy.</p>
        </div>
        <div className="metric-card metric-neutral">
          <h4>Focus Recommendation</h4>
          <strong className="focus-line">{focusSuggestion || 'Keep practicing'}</strong>
          <p>Next best topic selected by adaptive engine.</p>
        </div>
      </section>

      {error && <section className="panel error-text">{error}</section>}

      <section className="panel chart-panel">
        <h3>Subject-wise Accuracy (%)</h3>
        <p className="chart-caption">Accuracy distribution by subject based on attempts.</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={bySubject}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
            <XAxis dataKey="subject" stroke="#94a3b8" tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
            <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'rgba(96, 165, 250, 0.08)' }} />
            <Legend wrapperStyle={{ color: '#cbd5e1' }} />
            <Bar dataKey="accuracy" fill="#60a5fa" radius={[10, 10, 0, 0]} isAnimationActive animationDuration={700} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="panel chart-panel">
        <h3>Recent Accuracy Trend</h3>
        <p className="chart-caption">Point-wise correctness trend across recent attempts.</p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
            <XAxis dataKey="idx" stroke="#94a3b8" tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
            <Tooltip contentStyle={chartTooltipStyle} cursor={{ stroke: 'rgba(96, 165, 250, 0.2)' }} />
            <Legend wrapperStyle={{ color: '#cbd5e1' }} />
            <Line
              type="monotone"
              dataKey="accuracy"
              stroke="#22c55e"
              strokeWidth={3}
              dot={{ r: 4, fill: '#22c55e' }}
              activeDot={{ r: 6, fill: '#86efac' }}
              isAnimationActive
              animationDuration={700}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="panel chart-panel">
        <h3>Recent Time Taken (sec)</h3>
        <p className="chart-caption">Question solving speed trend over latest attempts.</p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
            <XAxis dataKey="idx" stroke="#94a3b8" tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
            <Tooltip contentStyle={chartTooltipStyle} cursor={{ stroke: 'rgba(96, 165, 250, 0.2)' }} />
            <Legend wrapperStyle={{ color: '#cbd5e1' }} />
            <Line
              type="monotone"
              dataKey="timeTakenSec"
              stroke="#60a5fa"
              strokeWidth={3}
              dot={{ r: 4, fill: '#60a5fa' }}
              activeDot={{ r: 6, fill: '#93c5fd' }}
              isAnimationActive
              animationDuration={700}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="panel">
        <h3>Topic Focus Heatmap</h3>
        <p className="chart-caption">Higher focus score means the topic needs earlier revision.</p>
        <div className="heatmap-grid">
          {weakTopicPriority.length ? (
            weakTopicPriority.slice(0, 10).map((entry) => {
              const focusScore = Number(entry.focusScore || 0);
              const accuracyValue = Number(entry.accuracy || 0);
              const width = Math.max(8, (focusScore / maxFocusScore) * 100);
              return (
                <article key={`${entry.subject}-${entry.topic}`} className="heatmap-row">
                  <div className="heatmap-labels">
                    <h4>{entry.subject} - {entry.topic}</h4>
                    <small>Focus {focusScore.toFixed(1)} | Acc {accuracyValue.toFixed(1)}%</small>
                  </div>
                  <div className="heatmap-track">
                    <span className="heatmap-fill" style={{ width: `${width}%` }} />
                  </div>
                </article>
              );
            })
          ) : (
            <p>No heatmap data yet. Solve more questions to unlock topic intensity insights.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default AnalyticsPage;
