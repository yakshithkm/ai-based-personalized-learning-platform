import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../api/client';
import EmptyState from '../components/EmptyState';
import { subjectColor } from '../utils/subjectVisuals';

const chartTooltipStyle = {
  backgroundColor: '#111827',
  border: '1px solid rgba(96, 165, 250, 0.4)',
  borderRadius: '12px',
  boxShadow: '0 14px 30px rgba(15, 23, 42, 0.6)',
  color: '#dbeafe',
};

const StreakIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2c2.5 3 4 5.7 4 8.2A4 4 0 0112 14a4 4 0 01-4-3.8C8 7.7 9.5 5 12 2zm0 20a7 7 0 01-7-7c0-1.9.9-3.4 2-4.7.1 1.6 1.1 2.7 2.3 2.7.9 0 1.4-.6 1.4-1.4 0-.6-.3-1-.6-1.5.9.2 1.9 1.4 1.9 3 0 .8-.3 1.4-.6 2 .9-.1 1.6-1 1.6-2.3 0-.9-.4-1.6-.8-2.3C15.3 10 17 12 17 15a5 5 0 01-5 7z" />
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 3h14v2H5V3zm0 4h14v14H5V7zm3 3v2h8v-2H8zm0 4v2h6v-2H8z" />
  </svg>
);

const TargetIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2l8 4v6c0 5.25-3.4 9.74-8 11-4.6-1.26-8-5.75-8-11V6l8-4zm-1 12l6-6-1.4-1.4L11 11.2 8.8 9 7.4 10.4 11 14z" />
  </svg>
);

const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2zm7 12l.9 2.6L22.5 17.5l-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14zM5 14l.9 2.6L8.5 17.5l-2.6.9L5 21l-.9-2.6L1.5 17.5l2.6-.9L5 14z" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 1a10 10 0 100 20 10 10 0 000-20zm1 10.4V6h-2v6.2l4.6 2.8 1-1.7-3.6-2.1z" />
  </svg>
);

const BulbIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 21h6v-1H9v1zm3-19a7 7 0 00-4 12.7c.6.5 1 1.2 1 2.3h6c0-1.1.4-1.8 1-2.3A7 7 0 0012 2z" />
  </svg>
);

const severityLabel = (accuracy) => {
  if (accuracy < 40) return { label: 'Critical', tone: 'critical' };
  if (accuracy < 60) return { label: 'Weak', tone: 'weak' };
  return { label: 'Needs Practice', tone: 'moderate' };
};

const formatDayLabel = (dayKey) => {
  if (!dayKey) return '';
  return new Date(`${dayKey}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

const formatMinutesLabel = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
};

const AnalyticsPage = () => {
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [chartRange, setChartRange] = useState('7d');

  const load = async () => {
    setError('');
    try {
      const { data } = await api.get('/analytics/me');
      setPayload(data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load analytics');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const performance = payload?.performance || {};
  const habit = payload?.habit || { dailyGoal: 10, todayCompleted: 0, currentStreak: 0, longestStreak: 0, heatmap: [] };
  const solvedSummary = payload?.solvedSummary || { uniqueSolved: 0, totalQuestions: 0 };
  const examReadiness = payload?.examReadiness || { score: 0, breakdown: {} };
  const bySubject = payload?.attemptsBySubject || [];
  const weakTopicPriority = payload?.weakTopicPriority || [];
  const weeklyImprovement = payload?.weeklyImprovement || [];
  const topicMastery = payload?.topicMastery || [];
  const focusSuggestion = payload?.suggestedFocusTopic || '';
  const accuracyTrend = payload?.accuracyTrend || 'stable';
  const timeAccuracyCorrelation = Number(payload?.timeAccuracyCorrelation || 0);

  const totalMinutesStudied = ((performance.averageTimeTakenSec || 0) * (performance.totalAttempts || 0)) / 60;

  const chartData = useMemo(() => {
    if (chartRange === '30d') {
      return (habit.heatmap || []).slice(-30).map((entry) => ({
        day: formatDayLabel(entry.day),
        questionsSolved: entry.count || 0,
        accuracy: null,
      }));
    }
    return weeklyImprovement.map((entry) => ({
      day: entry.day,
      questionsSolved: entry.attempts || 0,
      accuracy: entry.accuracy || 0,
    }));
  }, [chartRange, habit.heatmap, weeklyImprovement]);

  const maxFocusScore = weakTopicPriority.length
    ? Math.max(...weakTopicPriority.map((entry) => entry.focusScore || 0), 1)
    : 1;

  const strongestSubject = useMemo(() => {
    if (!bySubject.length) return null;
    return [...bySubject].sort((a, b) => Number(b.accuracy || 0) - Number(a.accuracy || 0))[0];
  }, [bySubject]);

  const weakestSubject = useMemo(() => {
    if (!bySubject.length) return null;
    return [...bySubject].sort((a, b) => Number(a.accuracy || 0) - Number(b.accuracy || 0))[0];
  }, [bySubject]);

  const insights = useMemo(() => {
    const list = [];
    if (strongestSubject) {
      list.push({
        tone: 'good',
        text: `Your strongest subject is ${strongestSubject.subject} at ${Number(strongestSubject.accuracy || 0).toFixed(0)}% accuracy. Keep the momentum going.`,
      });
    }
    if (weakestSubject && (!strongestSubject || weakestSubject.subject !== strongestSubject.subject)) {
      list.push({
        tone: Number(weakestSubject.accuracy || 0) < 50 ? 'bad' : 'mid',
        text: `${weakestSubject.subject} needs the most attention right now, sitting at ${Number(weakestSubject.accuracy || 0).toFixed(0)}% accuracy.`,
      });
    }
    if (accuracyTrend === 'improving') {
      list.push({ tone: 'good', text: 'Your accuracy is trending upward across recent attempts. Whatever you are doing is working.' });
    } else if (accuracyTrend === 'declining') {
      list.push({ tone: 'bad', text: 'Your accuracy has been trending downward recently — consider slowing down and reviewing mistakes before moving on.' });
    }
    if (focusSuggestion) {
      list.push({ tone: 'mid', text: `Next best topic to focus on: ${focusSuggestion}.` });
    }
    if (timeAccuracyCorrelation < -0.2) {
      list.push({ tone: 'good', text: 'Solving faster tends to align with better accuracy for you — trust your first instinct more.' });
    } else if (timeAccuracyCorrelation > 0.2) {
      list.push({ tone: 'mid', text: 'Rushing tends to hurt your accuracy — slowing down on tricky questions may help.' });
    }
    if (!list.length) {
      list.push({ tone: 'mid', text: 'Complete a few more practice sessions to unlock personalized insights.' });
    }
    return list.slice(0, 4);
  }, [strongestSubject, weakestSubject, accuracyTrend, focusSuggestion, timeAccuracyCorrelation]);

  const goToTopic = (subject, topic) => {
    navigate(`/practice?topic=${encodeURIComponent(`${subject} - ${topic}`)}`);
  };

  const isLoading = !payload && !error;
  const hasAttempts = Boolean(payload) && (bySubject.length > 0 || (payload?.recentAttempts || []).length > 0);

  if (isLoading) {
    return (
      <div className="dash-grid">
        <div className="dash-skel-row">
          <div className="skeleton-chip" style={{ width: '220px' }} />
        </div>
        <div className="dash-metric-row">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-block dash-metric-skel" />
          ))}
        </div>
        <div className="dash-main-grid">
          <div className="skeleton-block" style={{ minHeight: '320px' }} />
          <div className="skeleton-block" style={{ minHeight: '320px' }} />
        </div>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="dash-grid">
        <section className="dash-card error-state-card">
          <h3>Couldn&apos;t load your analytics</h3>
          <p>{error}</p>
          <button type="button" className="solid-btn" onClick={load}>
            Try again
          </button>
        </section>
      </div>
    );
  }

  if (!hasAttempts) {
    return (
      <div className="dash-grid">
        <section className="dash-greeting">
          <h1>Analytics</h1>
          <p>Understand your performance and improve where it matters.</p>
        </section>
        <EmptyState
          icon="analytics"
          title="Complete a few practice sessions to unlock personalized analytics"
          description="Solve a few practice questions or run an exam simulation and your accuracy, timing, and weak-topic trends will show up here."
          actionLabel="Go to Practice"
          onAction={() => navigate('/practice')}
        />
      </div>
    );
  }

  return (
    <div className="dash-grid">
      <section className="dash-greeting">
        <h1>Analytics</h1>
        <p>Understand your performance and improve where it matters.</p>
      </section>

      <section className="dash-metric-row">
        <article className="dash-card metric-card-v2">
          <div className="metric-card-head">
            <span className="metric-icon metric-icon-purple"><TargetIcon /></span>
            <span className="metric-title">Accuracy</span>
          </div>
          <p className="metric-value">{Number(performance.overallAccuracy || 0).toFixed(1)}%</p>
          <p className={`metric-caption metric-trend-${accuracyTrend}`}>
            {accuracyTrend === 'improving' ? '↑ Improving' : accuracyTrend === 'declining' ? '↓ Declining' : '→ Stable'}
          </p>
        </article>

        <article className="dash-card metric-card-v2">
          <div className="metric-card-head">
            <span className="metric-icon metric-icon-blue"><BookIcon /></span>
            <span className="metric-title">Questions Solved</span>
          </div>
          <p className="metric-value">{solvedSummary.uniqueSolved.toLocaleString()}</p>
          <p className="metric-caption">{performance.totalAttempts || 0} total attempts</p>
        </article>

        <article className="dash-card metric-card-v2">
          <div className="metric-card-head">
            <span className="metric-icon metric-icon-orange"><StreakIcon /></span>
            <span className="metric-title">Current Streak</span>
          </div>
          <p className="metric-value">{habit.currentStreak || 0} <small>days</small></p>
          <p className="metric-caption">Longest streak: {habit.longestStreak || 0} days</p>
        </article>

        <article className="dash-card metric-card-v2 metric-card-readiness">
          <div className="metric-card-head">
            <span className="metric-icon metric-icon-teal"><SparkleIcon /></span>
            <span className="metric-title">Exam Readiness</span>
          </div>
          <div className="readiness-ring-row">
            <span
              className="metric-ring"
              style={{ '--ring-value': Number(examReadiness.score || 0) }}
              role="img"
              aria-label={`Exam readiness score ${Number(examReadiness.score || 0).toFixed(0)} out of 100`}
            >
              <span className="metric-ring-inner">
                {Number(examReadiness.score || 0).toFixed(0)}
                <small>/100</small>
              </span>
            </span>
          </div>
        </article>

        <article className="dash-card metric-card-v2">
          <div className="metric-card-head">
            <span className="metric-icon metric-icon-amber"><ClockIcon /></span>
            <span className="metric-title">Avg Time / Question</span>
          </div>
          <p className="metric-value">{Math.round(performance.averageTimeTakenSec || 0)}<small>s</small></p>
          <p className="metric-caption">{formatMinutesLabel(totalMinutesStudied)} studied overall</p>
        </article>
      </section>

      <section className="dash-card chart-panel">
        <div className="dash-card-head">
          <div>
            <h3>Performance Trend</h3>
            <p className="dash-card-subtitle">Accuracy and questions solved over time.</p>
          </div>
          <select
            className="range-select"
            value={chartRange}
            onChange={(event) => setChartRange(event.target.value)}
            aria-label="Select time range"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
            <XAxis dataKey="day" stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis yAxisId="left" stroke="#60a5fa" tickLine={false} axisLine={false} fontSize={12} domain={[0, 100]} />
            <YAxis yAxisId="right" orientation="right" stroke="#a78bfa" tickLine={false} axisLine={false} fontSize={12} />
            <Tooltip contentStyle={chartTooltipStyle} />
            {chartRange === '7d' && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="accuracy"
                name="Accuracy (%)"
                stroke="#60a5fa"
                strokeWidth={3}
                dot={{ r: 4, fill: '#60a5fa' }}
                activeDot={{ r: 6 }}
                isAnimationActive
                animationDuration={700}
              />
            )}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="questionsSolved"
              name="Questions Solved"
              stroke="#a78bfa"
              strokeWidth={3}
              dot={{ r: 4, fill: '#a78bfa' }}
              activeDot={{ r: 6 }}
              isAnimationActive
              animationDuration={700}
            />
          </LineChart>
        </ResponsiveContainer>
        {chartRange === '30d' && (
          <p className="dash-chart-note">Accuracy trend is available for the 7-day view — showing questions solved per day over 30 days.</p>
        )}
      </section>

      {error && <section className="dash-card error-text">{error}</section>}

      <section className="dash-main-grid">
        <article className="dash-card">
          <div className="dash-card-head">
            <h3>Subject Performance</h3>
          </div>
          <div className="subject-accuracy-body">
            <div className="overall-ring-wrap">
              <svg viewBox="0 0 120 120" className="overall-ring">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="12" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 52}
                  strokeDashoffset={2 * Math.PI * 52 * (1 - Number(performance.overallAccuracy || 0) / 100)}
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <span className="overall-ring-label">
                {Number(performance.overallAccuracy || 0).toFixed(1)}%
                <small>Overall</small>
              </span>
            </div>
            <div className="subject-list">
              {bySubject.length ? (
                bySubject.map((row) => (
                  <div className="subject-row" key={row.subject}>
                    <span className="subject-dot" style={{ background: subjectColor(row.subject) }} />
                    <span className="subject-name">{row.subject}</span>
                    <span className="subject-bar-track">
                      <span
                        className="subject-bar-fill"
                        style={{ width: `${Math.min(100, Number(row.accuracy || 0))}%`, background: subjectColor(row.subject) }}
                      />
                    </span>
                    <span className="subject-pct">{Number(row.accuracy || 0).toFixed(0)}%</span>
                    {Number.isFinite(row.attempts) && <span className="subject-attempts">{row.attempts} attempts</span>}
                  </div>
                ))
              ) : (
                <p className="dash-empty-line">No subject data yet.</p>
              )}
            </div>
          </div>
        </article>

        <article className="dash-card">
          <div className="dash-card-head">
            <h3>Weak Topics</h3>
            <button type="button" className="link-btn" onClick={() => navigate('/weak-topics')}>View All</button>
          </div>
          {weakTopicPriority.length ? (
            <div className="weak-topics-table">
              {weakTopicPriority.slice(0, 5).map((entry) => {
                const severity = severityLabel(Number(entry.accuracy || 0));
                return (
                  <div className="weak-topics-row-v2" key={`${entry.subject}-${entry.topic}`}>
                    <div className="weak-topics-info">
                      <strong>{entry.topic}</strong>
                      <small>{entry.subject}</small>
                    </div>
                    <div className="weak-topics-metric">
                      <span className="subject-bar-track weak-bar-track">
                        <span className="subject-bar-fill weak-bar-fill" style={{ width: `${Math.min(100, Number(entry.accuracy || 0))}%` }} />
                      </span>
                      <span>{Number(entry.accuracy || 0).toFixed(0)}%</span>
                    </div>
                    <span className={`severity-badge severity-${severity.tone}`}>{severity.label}</span>
                    <button type="button" className="outline-btn dash-small-btn" onClick={() => goToTopic(entry.subject, entry.topic)}>
                      Practice
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="dash-empty-line">No weak topics detected. Great work — keep raising the difficulty.</p>
          )}
        </article>
      </section>

      <section className="dash-card">
        <div className="dash-card-head">
          <h3><BulbIcon /> Performance Insight</h3>
          <p className="dash-card-subtitle">Generated from your real attempt history — no filler stats.</p>
        </div>
        <div className="insight-list">
          {insights.map((insight, idx) => (
            <div className={`insight-row insight-${insight.tone}`} key={idx}>
              <span className="insight-dot" />
              <p>{insight.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="dash-card">
        <div className="dash-card-head">
          <h3>Topic Mastery</h3>
          <p className="dash-card-subtitle">Mastery combines accuracy and consistent practice volume.</p>
        </div>
        <div className="heatmap-grid">
          {topicMastery.length ? (
            topicMastery.slice(0, 10).map((entry) => {
              const mastery = Number(entry.masteryScore || 0);
              return (
                <article key={`${entry.subject}-${entry.topic}-${entry.subtopic || 'General'}`} className="heatmap-row">
                  <div className="heatmap-labels">
                    <h4>{entry.subject} - {entry.topic}{entry.subtopic && entry.subtopic !== 'General' ? ` (${entry.subtopic})` : ''}</h4>
                    <small>Mastery {mastery.toFixed(1)} | Acc {Number(entry.accuracy || 0).toFixed(1)}%</small>
                  </div>
                  <div className="heatmap-track">
                    <span className="heatmap-fill" style={{ width: `${Math.max(8, mastery)}%` }} />
                  </div>
                </article>
              );
            })
          ) : (
            <p className="dash-empty-line">No mastery data yet. Solve more questions to build your mastery profile.</p>
          )}
        </div>
      </section>

      <section className="dash-card">
        <div className="dash-card-head">
          <h3>Topic Focus Heatmap</h3>
          <p className="dash-card-subtitle">Higher focus score means the topic needs earlier revision.</p>
        </div>
        <div className="heatmap-grid">
          {weakTopicPriority.length ? (
            weakTopicPriority.slice(0, 10).map((entry) => {
              const focusScore = Number(entry.focusScore || 0);
              const accuracyValue = Number(entry.accuracy || 0);
              const width = Math.max(8, (focusScore / maxFocusScore) * 100);
              return (
                <article key={`focus-${entry.subject}-${entry.topic}`} className="heatmap-row">
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
            <p className="dash-empty-line">No heatmap data yet. Solve more questions to unlock topic intensity insights.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default AnalyticsPage;