import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const focusToday = analytics?.focusToday || [];
  const improvementInsight = analytics?.improvementInsight?.text || '';
  const nextAction = analytics?.nextAction || null;
  const habit = analytics?.habit || { dailyGoal: 10, todayCompleted: 0, currentStreak: 0, remainingToday: 10 };
  const urgency = analytics?.urgency || { alerts: [] };
  const readiness = analytics?.readiness || { status: 'yellow', value: 50 };
  const examReadiness = analytics?.examReadiness || { score: 0, breakdown: {} };
  const benchmark = analytics?.benchmark || null;
  const notifications = analytics?.notifications || [];
  const transformation = analytics?.transformation || { cards: [], mostImproved: null };
  const emptyStateGuidance = analytics?.emptyStateGuidance || { noWeakTopics: false, noMistakes: false };
  const xp = analytics?.xp || { totalXp: 0, weeklyXp: 0, level: 1 };
  const frequentFailedTopics = analytics?.mistakeBank?.frequentFailedTopics || [];
  const repeatedMistakes = analytics?.mistakeBank?.repeatedMistakes || [];

  const nextActionQuery = useMemo(() => {
    if (!nextAction?.query) return '';
    const params = new URLSearchParams();
    Object.entries(nextAction.query).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [nextAction]);

  const startNextAction = () => {
    const baseRoute = nextAction?.route || '/practice';
    const fullPath = nextActionQuery ? `${baseRoute}?${nextActionQuery}` : baseRoute;
    navigate(fullPath);
  };

  const startFocusSession = () => {
    navigate('/practice?mode=focus');
  };

  return (
    <div className="page-grid">
      <section className="panel hero-panel">
        <h2>Personalized Dashboard</h2>
        <p>Track your preparation velocity and focus where it matters most.</p>
        <div className="habit-inline">
          <span className="progress-tag">Daily Goal: {habit.todayCompleted}/{habit.dailyGoal}</span>
          <span className="progress-tag">Streak: {habit.currentStreak} day{habit.currentStreak === 1 ? '' : 's'}</span>
          <span className="progress-tag">Remaining Today: {habit.remainingToday}</span>
          <span className="progress-tag">Level {xp.level} • {xp.totalXp} XP</span>
        </div>
      </section>

      <section className="panel urgency-panel">
        <div className="urgency-head">
          <h3>Urgency & Readiness</h3>
          <span className={`status-dot status-${readiness.status}`}>
            {readiness.status.toUpperCase()}
          </span>
        </div>
        <div className="urgency-alerts">
          {(urgency.alerts || []).map((alert) => (
            <article key={alert.code} className={`urgency-item urgency-${alert.level}`}>
              <p>{alert.text}</p>
            </article>
          ))}
          {!urgency.alerts?.length && <p>No critical alerts right now.</p>}
        </div>
        <div className="readiness-grid">
          <article className="priority-item">
            <h4>Exam Readiness Score</h4>
            <strong className="readiness-score">{Number(examReadiness.score || 0).toFixed(1)} / 100</strong>
            <small>Accuracy {Number(examReadiness?.breakdown?.accuracy || 0).toFixed(1)}%</small>
            <small>Consistency {Number(examReadiness?.breakdown?.consistency || 0).toFixed(1)}%</small>
            <small>Coverage {Number(examReadiness?.breakdown?.coverage || 0).toFixed(1)}%</small>
          </article>
          <article className="priority-item">
            <h4>Benchmark (Estimated)</h4>
            <p>{benchmark?.message || 'Benchmark will appear after more attempts.'}</p>
            {benchmark?.top10Advice && <small>{benchmark.top10Advice}</small>}
          </article>
        </div>
      </section>

      <section className="panel">
        <h3>Notification Center</h3>
        <div className="notification-list">
          {notifications.map((note) => (
            <article key={note.type} className={`notification-item notification-${note.tone}`}>
              <h4>{note.title}</h4>
              <p>{note.text}</p>
            </article>
          ))}
          {!notifications.length && <p>No reminders right now.</p>}
        </div>
      </section>

      <section className="panel next-step-panel">
        <h3>{nextAction?.title || 'Your Next Step'}</h3>
        <p>{nextAction?.label || 'Start Recommended Practice Set'}</p>
        {!!nextAction?.dueMistakeCount && <p>{nextAction.dueMistakeCount} due mistake reviews pending.</p>}
        <div className="feedback-actions">
          <button className="solid-btn" onClick={startNextAction}>Start Now</button>
          <button className="outline-btn" onClick={startFocusSession}>Start Focus Session</button>
        </div>
      </section>

      <section className="panel action-grid">
        <article className="action-card">
          <h3>Focus Today</h3>
          {focusToday.length ? (
            <ul className="action-list">
              {focusToday.map((entry) => (
                <li key={`${entry.subject}-${entry.topic}-${entry.subtopic || 'General'}`}>
                  {entry.subject} - {entry.topic}
                  {entry.subtopic && entry.subtopic !== 'General' ? ` (${entry.subtopic})` : ''}
                  {' '} (Focus {Number(entry.focusScore || 0).toFixed(1)})
                </li>
              ))}
            </ul>
          ) : (
            <p>{emptyStateGuidance.noWeakTopics ? 'No weak topics. Advance to harder level.' : 'No weak-topic focus generated yet.'}</p>
          )}
        </article>
        <article className="action-card">
          <h3>Improvement Insight</h3>
          <p>{isLoading ? 'Computing improvement insight...' : (improvementInsight || 'Attempt more questions to unlock insight.')}</p>
        </article>
        <article className="action-card">
          <h3>Next Action</h3>
          <p>{nextAction?.reason || 'start-session'}</p>
          <button className="solid-btn" onClick={startNextAction}>
            Start Now
          </button>
        </article>
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
            <p>{emptyStateGuidance.noWeakTopics ? 'No weak topics. You can advance to a harder adaptive level now.' : 'No weak topics yet. Keep practicing to generate insights.'}</p>
          )}
        </div>
      </section>

      <section className="panel">
        <h3>Before vs Now</h3>
        <div className="transformation-grid">
          {(transformation.cards || []).map((card) => (
            <article key={`${card.subject}-${card.topic}`} className="transformation-card">
              <h4>{card.subject} - {card.topic}</h4>
              <p>{card.beforeAccuracy}% → {card.nowAccuracy}%</p>
              <small>{card.delta >= 0 ? `+${card.delta}` : card.delta}% change</small>
            </article>
          ))}
          {!transformation.cards?.length && <p>Complete more sessions to unlock transformation cards.</p>}
        </div>
        {!!transformation.mostImproved && (
          <p className="most-improved-line">
            Most improved: {transformation.mostImproved.topic} ({transformation.mostImproved.beforeAccuracy}% → {transformation.mostImproved.nowAccuracy}%).
          </p>
        )}
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
                <article key={`${entry.subject}-${entry.topic}-${entry.subtopic || 'General'}`} className="priority-item">
                  <div className="priority-head">
                    <h4>
                      {entry.subject} - {entry.topic}
                      {entry.subtopic && entry.subtopic !== 'General' ? ` (${entry.subtopic})` : ''}
                    </h4>
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
        <h3>Mistake Bank Signals</h3>
        <div className="mistake-grid">
          <article className="priority-item">
            <h4>Frequently Failed Topics</h4>
            {(frequentFailedTopics || []).slice(0, 4).map((entry) => (
              <p key={`${entry.subject}-${entry.topic}-${entry.subtopic || 'General'}`}>
                {entry.subject} - {entry.topic}
                {entry.subtopic && entry.subtopic !== 'General' ? ` (${entry.subtopic})` : ''}: {entry.failures} mistakes
              </p>
            ))}
            {!frequentFailedTopics.length && <p>No frequent failures yet.</p>}
          </article>
          <article className="priority-item">
            <h4>Repeated Mistakes</h4>
            {(repeatedMistakes || []).slice(0, 4).map((entry) => (
              <p key={entry.questionId}>
                {entry.subject} - {entry.topic}: {entry.failures} repeats
              </p>
            ))}
            {!repeatedMistakes.length && (
              <p>{emptyStateGuidance.noMistakes ? 'Strong consistency. No repeated mistakes detected.' : 'No repeated mistakes detected.'}</p>
            )}
          </article>
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
