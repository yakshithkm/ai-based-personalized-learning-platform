import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import EmptyState from '../components/EmptyState';
import { computeAchievements, formatRelativeTime } from '../utils/achievements';

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

const LockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 1a4 4 0 014 4v3h1a1 1 0 011 1v9a1 1 0 01-1 1H7a1 1 0 01-1-1v-9a1 1 0 011-1h1V5a4 4 0 014-4zm0 2a2 2 0 00-2 2v3h4V5a2 2 0 00-2-2z" />
  </svg>
);

const achievementIcon = (tone) => {
  if (tone === 'volume') return <BookIcon />;
  if (tone === 'accuracy') return <TargetIcon />;
  if (tone === 'level') return <SparkleIcon />;
  return <StreakSparkIcon />;
};

// Milestones not yet reached — shown locked so students can see what's
// next. Thresholds mirror computeAchievements() exactly, so a locked card
// here always matches the real unlock condition.
const buildLockedMilestones = (analytics) => {
  if (!analytics) return [];
  const habit = analytics.habit || {};
  const performance = analytics.performance || {};
  const totalCorrect = performance.totalCorrect || 0;

  const locked = [];
  if ((habit.longestStreak || 0) < 7) {
    locked.push({ id: 'locked-streak-7', label: '7 Day Streak', description: 'Practice 7 days in a row.' });
  }
  if ((habit.longestStreak || 0) < 30) {
    locked.push({ id: 'locked-streak-30', label: '30 Day Streak', description: 'Practice 30 days in a row.' });
  }
  if (totalCorrect < 100) {
    locked.push({ id: 'locked-solved-100', label: '100 Solved', description: 'Answer 100 questions correctly.' });
  }
  if (totalCorrect < 1000) {
    locked.push({ id: 'locked-solved-1000', label: 'Practice Pro', description: 'Solve 1000 questions.' });
  }
  return locked;
};

const AchievementsPage = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const { data } = await api.get('/analytics/me');
      setAnalytics(data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load achievements');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const earned = useMemo(() => computeAchievements(analytics), [analytics]);
  const locked = useMemo(() => buildLockedMilestones(analytics), [analytics]);

  if (!analytics && !error) {
    return (
      <div className="page-grid">
        <section className="panel" aria-busy="true" aria-label="Loading achievements">
          <div className="skeleton-chip" style={{ width: '200px', marginBottom: '0.7rem' }} />
          <div className="skeleton-block" style={{ minHeight: '260px' }} />
        </section>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="page-grid">
        <section className="panel error-state-card">
          <h3>Couldn&apos;t load achievements</h3>
          <p>{error}</p>
          <button type="button" className="solid-btn" onClick={load}>Try again</button>
        </section>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Achievements</h2>
        <p>Milestones you've unlocked through real practice — {earned.length} earned so far.</p>
      </section>

      {earned.length ? (
        <section className="panel">
          <div className="achievement-grid">
            {earned.map((achievement) => (
              <article key={achievement.id} className="achievement-grid-card">
                <span className={`achievement-icon achievement-icon-${achievement.tone}`}>
                  {achievementIcon(achievement.tone)}
                </span>
                <strong>{achievement.label}</strong>
                <p>{achievement.description}</p>
                <small>{formatRelativeTime(achievement.earnedAt)}</small>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          icon="practice"
          title="No achievements yet"
          description="Your first achievement unlocks after a 3-day streak or 25 correct answers. Keep practicing!"
          actionLabel="Go to Practice"
          onAction={() => navigate('/practice')}
        />
      )}

      {locked.length > 0 && (
        <section className="panel">
          <h3>Up Next</h3>
          <div className="achievement-grid">
            {locked.map((item) => (
              <article key={item.id} className="achievement-grid-card locked">
                <span className="achievement-icon achievement-icon-locked"><LockIcon /></span>
                <strong>{item.label}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {error && <section className="panel error-text">{error}</section>}
    </div>
  );
};

export default AchievementsPage;