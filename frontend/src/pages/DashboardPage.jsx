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
import LearnNextTeaser from '../components/learning/LearnNextTeaser';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { trackProductEvent } from '../utils/productEvents';
import { achievementText, computeAchievements, formatRelativeTime } from '../utils/achievements';
import { translateServerError } from '../i18n/serverErrors';
import { useLocaleFormat } from '../i18n/format';
import { subjectLabel } from '../i18n/labels';
import { subjectColor, subjectIconPath } from '../utils/subjectVisuals';
import UsageMeters from '../components/tier/UsageMeters';

const chartTooltipStyle = {
  backgroundColor: '#111827',
  border: '1px solid rgba(96, 165, 250, 0.4)',
  borderRadius: '12px',
  boxShadow: '0 14px 30px rgba(15, 23, 42, 0.6)',
  color: '#dbeafe',
};

const SubjectIcon = ({ subject }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={subjectIconPath(subject)} />
  </svg>
);

const StreakSparkIcon = () => (
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

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const priorityForAccuracy = (accuracy = 0) => {
  if (accuracy < 50) return 'High';
  if (accuracy < 70) return 'Medium';
  return 'Low';
};

const priorityClass = (priority) => {
  if (priority === 'High') return 'priority-high';
  if (priority === 'Medium') return 'priority-medium';
  return 'priority-low';
};

const formatMinutesLabel = (totalMinutes, t) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours <= 0) return t('time.minutesShort', { count: minutes });
  return t('time.hoursMinutesShort', { hours, minutes });
};

const formatDayLabel = (dayKey, formatDate) => {
  if (!dayKey) return '';
  return formatDate(new Date(`${dayKey}T00:00:00Z`), { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

const achievementIcon = (tone) => {
  if (tone === 'volume') return <BookIcon />;
  if (tone === 'accuracy') return <TargetIcon />;
  if (tone === 'level') return <SparkleIcon />;
  return <StreakSparkIcon />;
};

const DashboardPage = () => {
  const { t } = useTranslation();
  const { formatDate, formatNumber, formatPercent } = useLocaleFormat();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [analytics, setAnalytics] = useState(null);
  const [recommendationPayload, setRecommendationPayload] = useState(null);
  const [error, setError] = useState('');
  const [chartRange, setChartRange] = useState('7d');

  const load = async () => {
    setError('');
    try {
      const [aRes, rRes] = await Promise.all([
        api.get('/analytics/me'),
        api.get('/recommendations/me'),
      ]);
      setAnalytics(aRes.data);
      setRecommendationPayload(rRes.data);
    } catch (err) {
      setError(translateServerError(t, err?.response?.data?.message, 'dashboard.loadFailed'));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLoading = !analytics || !recommendationPayload;

  const performance = analytics?.performance || {};
  const habit = analytics?.habit || { dailyGoal: 10, todayCompleted: 0, currentStreak: 0, longestStreak: 0, heatmap: [] };
  const solvedSummary = analytics?.solvedSummary || { uniqueSolved: 0, totalQuestions: 0 };
  const examReadiness = analytics?.examReadiness || { score: 0, breakdown: {} };
  const weeklyTrend = analytics?.weeklyImprovement || [];
  const bySubject = analytics?.attemptsBySubject || [];
  const weakTopicPriority = analytics?.weakTopicPriority || [];
  const accuracyTrend = analytics?.accuracyTrend || 'stable';
  const nextAction = analytics?.nextAction || null;

  const hour = new Date().getHours();
  const greetingWord = hour < 12 ? t('dashboard.goodMorning') : hour < 17 ? t('dashboard.goodAfternoon') : t('dashboard.goodEvening');
  const firstName = (user?.name || '').split(' ')[0] || user?.name || t('dashboard.thereFallback');

  // Total time studied is derived from the average time-per-question the
  // backend already computes (averageTimeTakenSec) times total attempts —
  // a real calculation, not a stored/fabricated figure.
  const totalMinutesStudied = ((performance.averageTimeTakenSec || 0) * (performance.totalAttempts || 0)) / 60;

  const recommendedTopicCounts = useMemo(() => {
    const counts = new Map();
    (recommendationPayload?.recommendations || []).forEach((q) => {
      const key = `${q.subject} - ${q.topic}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [recommendationPayload]);

  const studyPlanItems = useMemo(() => {
    return weakTopicPriority.slice(0, 4).map((entry) => {
      const key = `${entry.subject} - ${entry.topic}`;
      const questionCount = recommendedTopicCounts.get(key) || Math.max(Math.round((100 - Number(entry.accuracy || 0)) / 7), 5);
      return {
        ...entry,
        key,
        priority: priorityForAccuracy(Number(entry.accuracy || 0)),
        questionCount,
      };
    });
  }, [weakTopicPriority, recommendedTopicCounts]);

  const chartData = useMemo(() => {
    if (chartRange === '30d') {
      return (habit.heatmap || []).slice(-30).map((entry) => ({
        day: formatDayLabel(entry.day, formatDate),
        questionsSolved: entry.count || 0,
        accuracy: null,
      }));
    }
    return weeklyTrend.map((entry) => ({
      day: entry.day,
      questionsSolved: entry.attempts || 0,
      accuracy: entry.accuracy || 0,
    }));
  }, [chartRange, habit.heatmap, weeklyTrend, formatDate]);

  const achievements = useMemo(() => computeAchievements(analytics), [analytics]);

  const dominantAction = useMemo(() => {
    const reason = nextAction?.reason || '';
    const topicFull = nextAction?.query?.topic || '';
    const topicName = topicFull.includes(' - ') ? topicFull.split(' - ')[1] : topicFull;

    if (reason === 'due-mistakes') {
      return {
        title: t('dashboard.action.mistakeReviewsTitle'),
        text: t('dashboard.action.mistakeReviewsText'),
      };
    }
    if (reason === 'weak-topic' && topicName) {
      return {
        title: topicName,
        text: t('dashboard.action.weakTopicText', { topic: topicName }),
      };
    }
    if (reason === 'increase-difficulty') {
      return {
        title: t('dashboard.action.difficultyTitle'),
        text: t('dashboard.action.difficultyText'),
      };
    }
    return {
      title: topicName || t('dashboard.action.focusTitle'),
      text: t('dashboard.action.focusText'),
    };
  }, [nextAction, t]);

  const nextActionQuery = useMemo(() => {
    if (!nextAction?.query) return '';
    const params = new URLSearchParams();
    Object.entries(nextAction.query).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [nextAction]);

  const startRecommendedPractice = () => {
    trackProductEvent('next_action_clicked', {
      cta: 'dashboard_recommendation_banner',
      source: 'dashboard',
      reason: nextAction?.reason || 'unknown',
      topic: nextAction?.query?.topic || null,
    });
    const baseRoute = nextAction?.route || '/practice';
    const fullPath = nextActionQuery ? `${baseRoute}?${nextActionQuery}` : baseRoute;
    navigate(fullPath);
  };

  const goToTopic = (subject, topic) => {
    navigate(`/practice?topic=${encodeURIComponent(`${subject} - ${topic}`)}`);
  };

  if (isLoading && !error) {
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

  if (error && isLoading) {
    return (
      <div className="dash-grid">
        <section className="dash-card error-state-card">
          <h3>{t('dashboard.couldntLoad')}</h3>
          <p>{error}</p>
          <button type="button" className="solid-btn" onClick={load}>
            {t('common.tryAgain')}
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="dash-grid">
      <section className="dash-greeting">
        <h1>{t('dashboard.greeting', { greeting: greetingWord, name: firstName })}</h1>
        <p>{t('dashboard.continueJourney')}</p>
      </section>

      <UsageMeters />

      <section className="dash-metric-row">
        <article className="dash-card metric-card-v2">
          <div className="metric-card-head">
            <span className="metric-icon metric-icon-orange"><StreakSparkIcon /></span>
            <span className="metric-title">{t('dashboard.studyStreak')}</span>
          </div>
          <p className="metric-value">{formatNumber(habit.currentStreak || 0)} <small>{t('dashboard.daysUnit', { count: habit.currentStreak || 0 })}</small></p>
          <p className="metric-caption">
            {habit.currentStreak > 0 ? t('dashboard.keepItUp') : t('dashboard.longestStreak', { count: habit.longestStreak || 0 })}
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
            <span className="metric-icon metric-icon-purple"><TargetIcon /></span>
            <span className="metric-title">{t('common.accuracy')}</span>
          </div>
          <p className="metric-value">{formatPercent(Number(performance.overallAccuracy || 0).toFixed(1))}</p>
          <p className={`metric-caption metric-trend-${accuracyTrend}`}>
            {accuracyTrend === 'improving' ? t('dashboard.trendImproving') : accuracyTrend === 'declining' ? t('dashboard.trendDeclining') : t('dashboard.trendStable')}
          </p>
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
          <p className="metric-caption">
            {Number(examReadiness.score || 0) >= 75 ? t('dashboard.readyExam') : Number(examReadiness.score || 0) >= 45 ? t('dashboard.goodProgress') : t('dashboard.keepBuilding')}
          </p>
        </article>

        <article className="dash-card metric-card-v2">
          <div className="metric-card-head">
            <span className="metric-icon metric-icon-amber"><ClockIcon /></span>
            <span className="metric-title">{t('dashboard.timeStudied')}</span>
          </div>
          <p className="metric-value">{formatMinutesLabel(totalMinutesStudied, t)}</p>
          <p className="metric-caption">{t('dashboard.avgPerQuestion', { seconds: Math.round(performance.averageTimeTakenSec || 0) })}</p>
        </article>
      </section>

      <section className="dash-main-grid">
        <article className="dash-card">
          <div className="dash-card-head">
            <div>
              <h3><SparkleIcon /> {t('dashboard.aiStudyPlan')}</h3>
              <p className="dash-card-subtitle">{t('dashboard.aiStudyPlanSubtitle')}</p>
            </div>
            <button type="button" className="outline-btn dash-small-btn" onClick={() => navigate('/study-plan')}>
              {t('dashboard.viewFullPlan')}
            </button>
          </div>

          {studyPlanItems.length ? (
            <div className="study-plan-list">
              {studyPlanItems.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  className="study-plan-row"
                  onClick={() => goToTopic(item.subject, item.topic)}
                >
                  <span className="study-plan-icon" style={{ color: subjectColor(item.subject), background: `${subjectColor(item.subject)}22` }}>
                    <SubjectIcon subject={item.subject} />
                  </span>
                  <span className="study-plan-info">
                    <strong>{item.topic}</strong>
                    <small>{subjectLabel(t, item.subject)} • {t('common.questionCount', { count: item.questionCount })}</small>
                  </span>
                  <span className={`priority-badge ${priorityClass(item.priority)}`}>{t(`priority.${item.priority.toLowerCase()}`)}</span>
                  <span className="study-plan-arrow"><ChevronRight /></span>
                </button>
              ))}
            </div>
          ) : (
            <p className="dash-empty-line">{t('dashboard.noWeakTopicsYet')}</p>
          )}
        </article>

        <article className="dash-card">
          <div className="dash-card-head">
            <h3>{t('dashboard.performanceOverview')}</h3>
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
          <ResponsiveContainer width="100%" height={260}>
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
        </article>
      </section>

      <section className="dash-second-row">
        <article className="dash-card">
          <div className="dash-card-head">
            <h3>{t('dashboard.subjectWiseAccuracy')}</h3>
            <button type="button" className="link-btn" onClick={() => navigate('/analytics')}>{t('common.viewDetails')}</button>
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
            <div className="weak-topic-list">
              {weakTopicPriority.slice(0, 4).map((entry) => (
                <button
                  type="button"
                  key={`${entry.subject}-${entry.topic}`}
                  className="weak-topic-row"
                  onClick={() => goToTopic(entry.subject, entry.topic)}
                >
                  <span className="weak-topic-name">{entry.topic}</span>
                  <span className="subject-bar-track weak-bar-track">
                    <span className="subject-bar-fill weak-bar-fill" style={{ width: `${Math.min(100, Number(entry.accuracy || 0))}%` }} />
                  </span>
                  <span className="weak-topic-pct">{formatPercent(Number(entry.accuracy || 0).toFixed(0))}</span>
                  <span className="study-plan-arrow"><ChevronRight /></span>
                </button>
              ))}
            </div>
          ) : (
            <p className="dash-empty-line">{t('dashboard.noWeakTopics')}</p>
          )}
        </article>

        <article className="dash-card">
          <div className="dash-card-head">
            <h3>{t('dashboard.recentAchievements')}</h3>
            <button type="button" className="link-btn" onClick={() => navigate('/achievements')}>{t('common.viewAll')}</button>
          </div>
          {achievements.length ? (
            <div className="achievement-list">
              {achievements.slice(0, 2).map((achievement) => (
                <div className="achievement-row" key={achievement.id}>
                  <span className={`achievement-icon achievement-icon-${achievement.tone}`}>
                    {achievementIcon(achievement.tone)}
                  </span>
                  <span className="achievement-info">
                    <strong>{achievementText(t, achievement).label}</strong>
                    <small>{achievementText(t, achievement).description}</small>
                  </span>
                  <span className="achievement-time">{formatRelativeTime(achievement.earnedAt, t)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="dash-empty-line">{t('dashboard.firstAchievementHint')}</p>
          )}
        </article>
      </section>

      <LearnNextTeaser />

      <section className="dash-recommend-banner">
        <div className="dash-recommend-text">
          <p className="dash-recommend-title">{t('dashboard.nextUp', { title: dominantAction.title })}</p>
          <p className="dash-recommend-sub">{dominantAction.text}</p>
        </div>
        <button type="button" className="solid-btn dash-recommend-cta" onClick={startRecommendedPractice}>
          {t('dashboard.startPractice')}
          <ChevronRight />
        </button>
      </section>

      {error && <section className="dash-card error-text">{error}</section>}
    </div>
  );
};

export default DashboardPage;