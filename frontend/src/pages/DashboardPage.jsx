import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { trackProductEvent } from '../utils/productEvents';

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

const highlightMentorText = (text = '') => {
  const fragments = String(text).split(/(liability|improving|mistake pattern|mastery|accuracy|correction)/i);
  return fragments.map((fragment, index) => {
    if (/^(liability|improving|mistake pattern|mastery|accuracy|correction)$/i.test(fragment)) {
      return (
        <span key={`${fragment}-${index}`} className="mentor-highlight">
          {fragment}
        </span>
      );
    }
    return <span key={`${fragment}-${index}`}>{fragment}</span>;
  });
};

const getReadinessLabel = (score = 0) => {
  if (score >= 75) return 'Exam Ready';
  if (score >= 45) return 'Improving';
  return 'Not Ready';
};

const formatNextAction = ({ nextAction, readinessScore }) => {
  const reason = nextAction?.reason || '';
  const topic = nextAction?.query?.topic || '';
  const subject = topic.includes(' - ') ? topic.split(' - ')[0] : topic;

  if (reason === 'due-mistakes') {
    return {
      label: 'Retry Mistake Questions',
      route: nextAction?.route || '/practice',
      text: 'Clear the mistakes that are still costing you marks.',
    };
  }

  if (reason === 'weak-topic' && subject) {
    return {
      label: `Fix ${subject} Weak Areas`,
      route: nextAction?.route || '/practice',
      text: 'Fix the weak pocket before it spreads into the next test.',
    };
  }

  if (reason === 'increase-difficulty' || readinessScore >= 75) {
    return {
      label: 'Take Full Mock Test',
      route: '/exam-simulation',
      text: 'You have enough stability to face full exam pressure now.',
    };
  }

  return {
    label: nextAction?.label || 'Start Focus Session',
    route: nextAction?.route || '/practice?mode=focus',
    text: 'Build consistency before adding more volume.',
  };
};

const DashboardPage = () => {
  const navigate = useNavigate();
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
  const nextAction = analytics?.nextAction || null;
  const habit = analytics?.habit || { dailyGoal: 10, todayCompleted: 0, currentStreak: 0, remainingToday: 10 };
  const urgency = analytics?.urgency || { alerts: [] };
  const readiness = analytics?.readiness || { status: 'yellow', value: 50 };
  const examReadiness = analytics?.examReadiness || { score: 0, breakdown: {} };
  const benchmark = analytics?.benchmark || null;
  const xp = analytics?.xp || { totalXp: 0, weeklyXp: 0, level: 1 };
  const studentInsightLayer = analytics?.studentInsightLayer || {};
  const mentorJudgment = studentInsightLayer?.mentorJudgmentSystem || {};
  const weeklyReport = studentInsightLayer?.weeklyPerformanceReport || { summary: [] };
  const studyStrategy = studentInsightLayer?.studyStrategy || { subjectPriorityOrder: [], timeAllocation: [] };

  const mentorInsights = [
    mentorJudgment?.sampleInsights?.[0]?.text || weeklyReport.summary?.[0] || 'Keep correcting the same weak pattern until it stops repeating.',
    mentorJudgment?.sampleInsights?.[1]?.text || mentorJudgment?.decisionGuidance || 'You need correction, not more volume.',
  ];

  const strengths = (weeklyReport.subjectDeltas || [])
    .filter((row) => row.currentAccuracy >= 65 && row.delta >= 0)
    .map((row) => `${row.subject} is holding steady at ${row.currentAccuracy}%`)
    .slice(0, 2);

  const weaknesses = (mentorJudgment?.priorityWarnings || [])
    .map((warning) => warning.replace('is currently a liability in your exam performance.', 'is currently a liability.'))
    .slice(0, 2);

  const keyPattern = mentorJudgment?.repeatedPatternCritique?.[0]?.message
    || mentorJudgment?.effortVsResult?.find((row) => row.judgment === 'rushing' || row.judgment === 'inefficient')?.message
    || mentorJudgment?.decisionGuidance
    || 'No repeated failure pattern is dominating right now.';

  const readinessLabel = getReadinessLabel(Number(examReadiness.score || 0));
  const dominantAction = formatNextAction({ nextAction, readinessScore: Number(examReadiness.score || 0) });
  const readinessTone = readinessLabel === 'Exam Ready' ? 'good' : readinessLabel === 'Improving' ? 'mid' : 'bad';
  const mentorCardPrimary = mentorInsights[0];
  const mentorCardSecondary = mentorInsights[1];

  const nextActionQuery = useMemo(() => {
    if (!nextAction?.query) return '';
    const params = new URLSearchParams();
    Object.entries(nextAction.query).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [nextAction]);

  const startNextAction = () => {
    trackProductEvent('next_action_clicked', {
      cta: 'next_action',
      source: 'dashboard',
      reason: nextAction?.reason || 'unknown',
      topic: nextAction?.query?.topic || null,
    });
    const baseRoute = dominantAction.route;
    const fullPath = baseRoute === '/exam-simulation'
      ? baseRoute
      : nextActionQuery
        ? `${baseRoute}?${nextActionQuery}`
        : baseRoute;
    navigate(fullPath);
  };

  const startFocusSession = () => {
    trackProductEvent('next_action_clicked', {
      cta: 'focus_session',
      source: 'dashboard',
      reason: 'manual-focus-start',
    });
    navigate('/practice?mode=focus');
  };

  return (
    <div className="page-grid">
      <section className="panel hero-panel mentor-hero-panel">
        <p className="eyebrow-label">Mentor Mode</p>
        <h2>Your prep is being judged, not just measured.</h2>
        <p>One glance should tell you what to fix, what to keep, and what to do next.</p>
        <div className="habit-inline">
          <span className="progress-tag">Daily Goal: {habit.todayCompleted}/{habit.dailyGoal}</span>
          <span className="progress-tag">Streak: {habit.currentStreak} day{habit.currentStreak === 1 ? '' : 's'}</span>
          <span className="progress-tag">Remaining Today: {habit.remainingToday}</span>
          <span className="progress-tag">Level {xp.level} • {xp.totalXp} XP</span>
        </div>
      </section>

      <section className="panel mentor-card mentor-glow-panel">
        <div className="mentor-card-head">
          <div>
            <p className="eyebrow-label">Top Priority</p>
            <h3>Your Mentor Says</h3>
          </div>
          <span className={`status-pill status-${readinessTone}`}>{readinessLabel}</span>
        </div>
        <div className="mentor-say-stack">
          {mentorInsights.map((insight) => (
            <article key={insight} className="mentor-say-line">
              <p>{highlightMentorText(insight)}</p>
            </article>
          ))}
        </div>
        <div className="mentor-mini-notes">
          <p><strong>Decision:</strong> {mentorJudgment?.decisionGuidance || 'Focus on the weakest area.'}</p>
          <p><strong>Pattern:</strong> {keyPattern}</p>
        </div>
      </section>

      <section className="panel next-step-panel dominant-cta-panel">
        <p className="eyebrow-label">Dominant CTA</p>
        <h3>{nextAction?.title || 'Your Next Step'}</h3>
        <p className="cta-title">{dominantAction.label}</p>
        <p className="cta-subtext">{dominantAction.text}</p>
        <div className="feedback-actions dominant-actions">
          <button className="solid-btn primary-cta-btn" onClick={startNextAction}>{dominantAction.label}</button>
          <button className="outline-btn" onClick={startFocusSession}>Start Focus Session</button>
        </div>
      </section>

      <section className="panel insight-breakdown-panel">
        <div className="panel-head-row">
          <h3>Insight Breakdown</h3>
          <span className="subtle-label">Minimal and decision-focused</span>
        </div>
        <div className="insight-mini-grid">
          <article className="insight-mini-card">
            <h4>Strengths</h4>
            {strengths.length ? strengths.map((item) => <p key={item}>{item}</p>) : <p>No stable strength has formed yet.</p>}
          </article>
          <article className="insight-mini-card">
            <h4>Weaknesses</h4>
            {weaknesses.length ? weaknesses.map((item) => <p key={item}>{item}</p>) : <p>No critical weakness is currently dominant.</p>}
          </article>
          <article className="insight-mini-card">
            <h4>Key Pattern</h4>
            <p>{keyPattern}</p>
          </article>
        </div>
      </section>

      <section className="panel readiness-panel">
        <div className="readiness-head">
          <div>
            <p className="eyebrow-label">Exam Readiness</p>
            <h3>{readinessLabel}</h3>
          </div>
          <strong className="readiness-score">{Number(examReadiness.score || 0).toFixed(0)}</strong>
        </div>
        <div className="readiness-meter">
          <span className="readiness-meter-fill" style={{ width: `${Number(examReadiness.score || 0)}%` }} />
        </div>
        <div className="readiness-metrics">
          <span>Accuracy {Number(examReadiness?.breakdown?.accuracy || 0).toFixed(1)}%</span>
          <span>Consistency {Number(examReadiness?.breakdown?.consistency || 0).toFixed(1)}%</span>
          <span>Coverage {Number(examReadiness?.breakdown?.coverage || 0).toFixed(1)}%</span>
        </div>
        <p>{benchmark?.message || 'Benchmark will appear after more attempts.'}</p>
        {benchmark?.top10Advice && <small>{benchmark.top10Advice}</small>}
      </section>

      <section className="panel mentor-support-panel">
        <div className="support-grid">
          <article>
            <h4>Study Strategy</h4>
            <p>{studyStrategy?.guidanceText || 'Collect more attempts for a precise study split.'}</p>
          </article>
          <article>
            <h4>Consistency</h4>
            <p>{Number(studentInsightLayer?.consistencyScore?.score || 0).toFixed(0)} / 100</p>
          </article>
        </div>
      </section>

      {error && <section className="panel error-text">{error}</section>}
    </div>
  );
};

export default DashboardPage;
