import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { translateServerError } from '../i18n/serverErrors';
import { subjectLabel } from '../i18n/labels';
import { useLocaleFormat } from '../i18n/format';
import FeatureLock from '../components/tier/FeatureLock';

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
  if (accuracy < 40) return { labelKey: 'weakTopics.severity.critical', tone: 'critical' };
  if (accuracy < 60) return { labelKey: 'weakTopics.severity.weak', tone: 'weak' };
  return { labelKey: 'weakTopics.severity.needsPractice', tone: 'moderate' };
};

const formatDayLabel = (dayKey, formatDate) => {
  if (!dayKey) return '';
  return formatDate(new Date(`${dayKey}T00:00:00Z`), { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

const formatMinutesLabel = (totalMinutes, t) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours <= 0) return t('time.minutesShort', { count: minutes });
  return t('time.hoursMinutesShort', { hours, minutes });
};

const AnalyticsPage = () => {
  const { t } = useTranslation();
  const { formatDate, formatNumber, formatPercent } = useLocaleFormat();
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
      setError(translateServerError(t, err?.response?.data?.message, 'analytics.loadFailed'));
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
  // The server removes advanced analytics from the payload for plans without them and says so here;
  // the UI just shows what that means instead of an empty chart.
  const advancedLocked = payload?.tierAccess?.advancedAnalytics === false;
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
        day: formatDayLabel(entry.day, formatDate),
        questionsSolved: entry.count || 0,
        accuracy: null,
      }));
    }
    return weeklyImprovement.map((entry) => ({
      day: entry.day,
      questionsSolved: entry.attempts || 0,
      accuracy: entry.accuracy || 0,
    }));
  }, [chartRange, habit.heatmap, weeklyImprovement, formatDate]);

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
        text: t('analytics.insight.strongest', { subject: subjectLabel(t, strongestSubject.subject), value: formatPercent(Number(strongestSubject.accuracy || 0).toFixed(0)) }),
      });
    }
    if (weakestSubject && (!strongestSubject || weakestSubject.subject !== strongestSubject.subject)) {
      list.push({
        tone: Number(weakestSubject.accuracy || 0) < 50 ? 'bad' : 'mid',
        text: t('analytics.insight.weakest', { subject: subjectLabel(t, weakestSubject.subject), value: formatPercent(Number(weakestSubject.accuracy || 0).toFixed(0)) }),
      });
    }
    if (accuracyTrend === 'improving') {
      list.push({ tone: 'good', text: t('analytics.insight.up') });
    } else if (accuracyTrend === 'declining') {
      list.push({ tone: 'bad', text: t('analytics.insight.down') });
    }
    if (focusSuggestion) {
      list.push({ tone: 'mid', text: t('analytics.insight.focus', { topic: focusSuggestion }) });
    }
    if (timeAccuracyCorrelation < -0.2) {
      list.push({ tone: 'good', text: t('analytics.insight.fast') });
    } else if (timeAccuracyCorrelation > 0.2) {
      list.push({ tone: 'mid', text: t('analytics.insight.slow') });
    }
    if (!list.length) {
      list.push({ tone: 'mid', text: t('analytics.insight.more') });
    }
    return list.slice(0, 4);
  }, [strongestSubject, weakestSubject, accuracyTrend, focusSuggestion, timeAccuracyCorrelation, t, formatPercent]);

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
          <h3>{t('analytics.couldntLoad')}</h3>
          <p>{error}</p>
          <button type="button" className="solid-btn" onClick={load}>
            {t('common.tryAgain')}
          </button>
        </section>
      </div>
    );
  }

  if (!hasAttempts) {
    return (
      <div className="dash-grid">
        <section className="dash-greeting">
          <h1>{t('navigation.analytics')}</h1>
          <p>{t('analytics.intro')}</p>
        </section>
        <EmptyState
          icon="analytics"
          title={t('analytics.emptyTitle')}
          description={t('analytics.emptyText')}
          actionLabel={t('common.goToPractice')}
          onAction={() => navigate('/practice')}
        />
      </div>
    );
  }

  return (
    <div className="dash-grid">
      <section className="dash-greeting">
        <h1>{t('navigation.analytics')}</h1>
        <p>{t('analytics.intro')}</p>
      </section>

      <section className="dash-metric-row">
        <article className="dash-card metric-card-v2">
          <div className="metric-card-head">
            <span className="metric-icon metric-icon-purple"><TargetIcon /></span>
            <span className="metric-title">{t('common.accuracy')}</span>
          </div>
          <p className="metric-value">{formatPercent(Number(performance.overallAccuracy || 0).toFixed(1))}</p>
          <p className={`metric-caption metric-trend-${accuracyTrend}`}>
            {accuracyTrend === 'improving' ? t('dashboard.trendImproving') : accuracyTrend === 'declining' ? t('dashboard.trendDeclining') : t('dashboard.trendStable')}
          </p>
        </article>

        <article className="dash-card metric-card-v2">
          <div className="metric-card-head">
            <span className="metric-icon metric-icon-blue"><BookIcon /></span>
            <span className="metric-title">{t('dashboard.questionsSolved')}</span>
          </div>
          <p className="metric-value">{formatNumber(solvedSummary.uniqueSolved)}</p>
          <p className="metric-caption">{t('dashboard.totalAttempts', { count: performance.totalAttempts || 0 })}</p>
        </article>

        <article className="dash-card metric-card-v2">
          <div className="metric-card-head">
            <span className="metric-icon metric-icon-orange"><StreakIcon /></span>
            <span className="metric-title">{t('profile.currentStreak')}</span>
          </div>
          <p className="metric-value">{formatNumber(habit.currentStreak || 0)} <small>{t('dashboard.daysUnit', { count: habit.currentStreak || 0 })}</small></p>
          <p className="metric-caption">{t('dashboard.longestStreak', { count: habit.longestStreak || 0 })}</p>
        </article>

        <article className="dash-card metric-card-v2 metric-card-readiness">
          <div className="metric-card-head">
            <span className="metric-icon metric-icon-teal"><SparkleIcon /></span>
            <span className="metric-title">{t('dashboard.examReadiness')}</span>
          </div>
          <div className="readiness-ring-row">
            <span
              className="metric-ring"
              style={{ '--ring-value': Number(examReadiness.score || 0) }}
              role="img"
              aria-label={t('dashboard.readinessAria', { score: Number(examReadiness.score || 0).toFixed(0) })}
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
            <span className="metric-title">{t('analytics.avgTime')}</span>
          </div>
          <p className="metric-value">{Math.round(performance.averageTimeTakenSec || 0)}<small>{t('time.secondsUnit')}</small></p>
          <p className="metric-caption">{t('analytics.studiedOverall', { time: formatMinutesLabel(totalMinutesStudied, t) })}</p>
        </article>
      </section>

      <section className="dash-card chart-panel">
        <div className="dash-card-head">
          <div>
            <h3>{t('analytics.performanceTrend')}</h3>
            <p className="dash-card-subtitle">{t('analytics.performanceTrendSub')}</p>
          </div>
          <select
            className="range-select"
            value={chartRange}
            onChange={(event) => setChartRange(event.target.value)}
            aria-label={t('dashboard.selectRange')}
          >
            <option value="7d">{t('dashboard.last7Days')}</option>
            <option value="30d">{t('dashboard.last30Days')}</option>
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
                name={t('dashboard.accuracyPercentSeries')}
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
              name={t('dashboard.questionsSolved')}
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
          <p className="dash-chart-note">{t('dashboard.chartNote30')}</p>
        )}
      </section>

      {error && <section className="dash-card error-text">{error}</section>}

      <section className="dash-main-grid">
        <article className="dash-card">
          <div className="dash-card-head">
            <h3>{t('analytics.subjectPerformance')}</h3>
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
                {formatPercent(Number(performance.overallAccuracy || 0).toFixed(1))}
                <small>{t('dashboard.overall')}</small>
              </span>
            </div>
            <div className="subject-list">
              {bySubject.length ? (
                bySubject.map((row) => (
                  <div className="subject-row" key={row.subject}>
                    <span className="subject-dot" style={{ background: subjectColor(row.subject) }} />
                    <span className="subject-name">{subjectLabel(t, row.subject)}</span>
                    <span className="subject-bar-track">
                      <span
                        className="subject-bar-fill"
                        style={{ width: `${Math.min(100, Number(row.accuracy || 0))}%`, background: subjectColor(row.subject) }}
                      />
                    </span>
                    <span className="subject-pct">{formatPercent(Number(row.accuracy || 0).toFixed(0))}</span>
                    {Number.isFinite(row.attempts) && <span className="subject-attempts">{t('analytics.attempts', { count: row.attempts })}</span>}
                  </div>
                ))
              ) : (
                <p className="dash-empty-line">{t('dashboard.noSubjectData')}</p>
              )}
            </div>
          </div>
        </article>

        <article className="dash-card">
          <div className="dash-card-head">
            <h3>{t('navigation.weakTopics')}</h3>
            <button type="button" className="link-btn" onClick={() => navigate('/weak-topics')}>{t('common.viewAll')}</button>
          </div>
          {weakTopicPriority.length ? (
            <div className="weak-topics-table">
              {weakTopicPriority.slice(0, 5).map((entry) => {
                const severity = severityLabel(Number(entry.accuracy || 0));
                return (
                  <div className="weak-topics-row-v2" key={`${entry.subject}-${entry.topic}`}>
                    <div className="weak-topics-info">
                      <strong>{entry.topic}</strong>
                      <small>{subjectLabel(t, entry.subject)}</small>
                    </div>
                    <div className="weak-topics-metric">
                      <span className="subject-bar-track weak-bar-track">
                        <span className="subject-bar-fill weak-bar-fill" style={{ width: `${Math.min(100, Number(entry.accuracy || 0))}%` }} />
                      </span>
                      <span>{formatPercent(Number(entry.accuracy || 0).toFixed(0))}</span>
                    </div>
                    <span className={`severity-badge severity-${severity.tone}`}>{t(severity.labelKey)}</span>
                    <button type="button" className="outline-btn dash-small-btn" onClick={() => goToTopic(entry.subject, entry.topic)}>
                      {t('navigation.practice')}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="dash-empty-line">{t('analytics.noWeak')}</p>
          )}
        </article>
      </section>

      <section className="dash-card">
        <div className="dash-card-head">
          <h3><BulbIcon /> {t('analytics.performanceInsight')}</h3>
          <p className="dash-card-subtitle">{t('analytics.performanceInsightSub')}</p>
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

      {advancedLocked ? (
        <>
          <FeatureLock title={t('analytics.topicMastery')} requiredTier="PRO" />
          <FeatureLock title={t('analytics.focusHeatmap')} requiredTier="PRO" />
        </>
      ) : (
        <>
      <section className="dash-card">
        <div className="dash-card-head">
          <h3>{t('analytics.topicMastery')}</h3>
          <p className="dash-card-subtitle">{t('analytics.topicMasterySub')}</p>
        </div>
        <div className="heatmap-grid">
          {topicMastery.length ? (
            topicMastery.slice(0, 10).map((entry) => {
              const mastery = Number(entry.masteryScore || 0);
              return (
                <article key={`${entry.subject}-${entry.topic}-${entry.subtopic || 'General'}`} className="heatmap-row">
                  <div className="heatmap-labels">
                    <h4>{subjectLabel(t, entry.subject)} - {entry.topic}{entry.subtopic && entry.subtopic !== 'General' ? ` (${entry.subtopic})` : ''}</h4>
                    <small>{t('analytics.masteryLine', { mastery: mastery.toFixed(1), acc: formatPercent(Number(entry.accuracy || 0).toFixed(1)) })}</small>
                  </div>
                  <div className="heatmap-track">
                    <span className="heatmap-fill" style={{ width: `${Math.max(8, mastery)}%` }} />
                  </div>
                </article>
              );
            })
          ) : (
            <p className="dash-empty-line">{t('analytics.noMastery')}</p>
          )}
        </div>
      </section>

      <section className="dash-card">
        <div className="dash-card-head">
          <h3>{t('analytics.focusHeatmap')}</h3>
          <p className="dash-card-subtitle">{t('analytics.focusHeatmapSub')}</p>
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
                    <h4>{subjectLabel(t, entry.subject)} - {entry.topic}</h4>
                    <small>{t('analytics.focusLine', { focus: focusScore.toFixed(1), acc: formatPercent(accuracyValue.toFixed(1)) })}</small>
                  </div>
                  <div className="heatmap-track">
                    <span className="heatmap-fill" style={{ width: `${width}%` }} />
                  </div>
                </article>
              );
            })
          ) : (
            <p className="dash-empty-line">{t('analytics.noHeatmap')}</p>
          )}
        </div>
      </section>
        </>
      )}
    </div>
  );
};

export default AnalyticsPage;