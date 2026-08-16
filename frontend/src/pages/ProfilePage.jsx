import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import EmptyState from '../components/EmptyState';
import { useToast } from '../context/ToastContext';
import { useCountUp } from '../hooks/useScrollReveal';

// Subject accent colors reused across the ring, legend, and skill chips so a
// subject reads as the same color everywhere on the page.
const SUBJECT_COLORS = {
  Physics: '#60a5fa',
  Chemistry: '#34d399',
  Mathematics: '#f59e0b',
  Biology: '#f472b6',
};

const FALLBACK_COLOR = '#94a3b8';

const subjectColor = (subject) => SUBJECT_COLORS[subject] || FALLBACK_COLOR;

const formatRelativeTime = (dateInput) => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.max(Math.floor(diffMs / 1000), 0);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth} month${diffMonth === 1 ? '' : 's'} ago`;
};

const formatJoinDate = (dateInput) => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

// Builds the stroke-dasharray/offset pair for one arc segment of the ring,
// given how far around the circle (0-1) the segment should start and span.
const buildArc = (circumference, startFraction, spanFraction) => {
  const dash = Math.max(circumference * spanFraction, 0);
  const gap = Math.max(circumference - dash, 0);
  const offset = circumference * (1 - startFraction);
  return { strokeDasharray: `${dash} ${gap}`, strokeDashoffset: offset };
};

// Where a segment's leading edge sits on the circle (0 fraction = 12
// o'clock, moving clockwise) - used to place the small bright marker dot
// LeetCode draws at the start of each ring segment.
const pointOnRing = (cx, cy, radius, startFraction) => {
  const angle = -Math.PI / 2 + startFraction * 2 * Math.PI;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
};

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="profile-ring-check-icon">
    <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
  </svg>
);

const BadgeIcon = ({ tone }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {tone === 'streak' && (
      <path d="M12 2c2.5 3 4 5.7 4 8.2A4 4 0 0112 14a4 4 0 01-4-3.8C8 7.7 9.5 5 12 2zm0 20a7 7 0 01-7-7c0-1.9.9-3.4 2-4.7.1 1.6 1.1 2.7 2.3 2.7.9 0 1.4-.6 1.4-1.4 0-.6-.3-1-.6-1.5.9.2 1.9 1.4 1.9 3 0 .8-.3 1.4-.6 2 .9-.1 1.6-1 1.6-2.3 0-.9-.4-1.6-.8-2.3C15.3 10 17 12 17 15a5 5 0 01-5 7z" />
    )}
    {tone === 'volume' && (
      <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2zm0 4h5v2H8v-2z" />
    )}
    {tone === 'accuracy' && (
      <path d="M12 2l8 4v6c0 5.25-3.4 9.74-8 11-4.6-1.26-8-5.75-8-11V6l8-4zm-1 12l6-6-1.4-1.4L11 11.2 8.8 9 7.4 10.4 11 14z" />
    )}
    {tone === 'consistency' && (
      <path d="M5 3h14v2H5V3zm0 4h14v14H5V7zm3 3v2h8v-2H8zm0 4v2h6v-2H8z" />
    )}
    {tone === 'level' && (
      <path d="M12 1l9 4v6c0 5.5-3.8 10.7-9 12-5.2-1.3-9-6.5-9-12V5l9-4zm-1 12l6-6-1.4-1.4L11 10.2 8.8 8 7.4 9.4 11 13z" />
    )}
  </svg>
);

const ProfilePage = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [profile, setProfile] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');
  const [isRingHovered, setIsRingHovered] = useState(false);

  const load = async () => {
    setError('');
    try {
      const [profileRes, analyticsRes] = await Promise.all([
        api.get('/auth/profile'),
        api.get('/analytics/me'),
      ]);
      setProfile(profileRes.data?.user || null);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load profile');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const performance = analytics?.performance || {};
  const habit = analytics?.habit || {};
  const xp = analytics?.xp || { totalXp: 0, weeklyXp: 0, level: 1 };
  const benchmark = analytics?.benchmark || {};
  const recentAttempts = analytics?.recentAttempts || [];
  const topicMastery = analytics?.topicMastery || [];
  const bySubject = analytics?.attemptsBySubject || [];
  const solvedSummary = analytics?.solvedSummary || { uniqueSolved: 0, totalQuestions: 0, attempting: 0 };

  const totalAttempts = performance.totalAttempts || 0;
  const totalCorrect = performance.totalCorrect || 0;
  const overallAccuracy = Number(performance.overallAccuracy || 0);

  const solvedCountUp = useCountUp(solvedSummary.uniqueSolved, { duration: 1100, isActive: !!analytics });

  // Ring segments: each subject's share of *correct* attempts, in a fixed
  // subject order so the ring composition is stable between renders.
  const ringSegments = useMemo(() => {
    const radius = 74;
    const circumference = 2 * Math.PI * radius;
    const subjectsWithCorrect = bySubject
      .map((row) => ({
        subject: row.subject,
        correct: Math.round((Number(row.accuracy || 0) / 100) * Number(row.attempts || 0)),
        attempts: Number(row.attempts || 0),
        accuracy: Number(row.accuracy || 0),
      }))
      .filter((row) => row.attempts > 0);

    const totalCorrectForRing = subjectsWithCorrect.reduce((sum, row) => sum + row.correct, 0) || 1;
    const cx = 90;
    const cy = 90;

    let cursor = 0;
    const segments = subjectsWithCorrect.map((row) => {
      const span = row.correct / totalCorrectForRing;
      const arc = buildArc(circumference, cursor, span);
      const marker = pointOnRing(cx, cy, radius, cursor);
      cursor += span;
      return { ...row, ...arc, marker, color: subjectColor(row.subject) };
    });

    return { segments, radius, circumference, cx, cy };
  }, [bySubject]);

  // Groups the ~365-day heatmap into per-calendar-month blocks (matching
  // LeetCode's submission calendar), where each month's cell count equals
  // the days it actually covers - a leading run of blank cells so day 1
  // lands on its true weekday, then the real days, padded out to a full
  // week at the end. Days are parsed as UTC to match how the backend
  // generated the "YYYY-MM-DD" keys, so weekday placement doesn't drift
  // with the viewer's local timezone. The resulting `cells` array is
  // already in the row-then-column order CSS Grid's `grid-auto-flow:
  // column` expects, so no extra transposition is needed at render time.
  const heatmapCalendar = useMemo(() => {
    const days = habit.heatmap || [];
    if (!days.length) return { months: [], submissionsInYear: 0 };

    const monthOrder = [];
    const monthMap = new Map();
    days.forEach((entry) => {
      const monthKey = entry.day.slice(0, 7);
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, []);
        monthOrder.push(monthKey);
      }
      monthMap.get(monthKey).push(entry);
    });

    const months = monthOrder.map((monthKey) => {
      const entries = monthMap.get(monthKey);
      const firstWeekday = new Date(`${entries[0].day}T00:00:00Z`).getUTCDay();
      const cells = [...Array(firstWeekday).fill(null), ...entries];
      while (cells.length % 7 !== 0) cells.push(null);

      const label = new Date(`${entries[0].day}T00:00:00Z`).toLocaleDateString(undefined, {
        month: 'short',
        timeZone: 'UTC',
      });

      return { key: monthKey, cells, weeks: cells.length / 7, label };
    });

    const submissionsInYear = days.reduce((sum, entry) => sum + (entry.count || 0), 0);

    return { months, submissionsInYear };
  }, [habit.heatmap]);

  const heatmapLevel = (count) => {
    if (!count) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 9) return 3;
    return 4;
  };

  const formatHeatmapDate = (dayKey) =>
    new Date(`${dayKey}T00:00:00Z`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });

  const skillTiers = useMemo(() => {
    const tiers = { Advanced: [], Intermediate: [], Developing: [] };
    topicMastery
      .filter((entry) => Number(entry.attempts || 0) > 0)
      .forEach((entry) => {
        const mastery = Number(entry.masteryScore || 0);
        const tier = mastery >= 75 ? 'Advanced' : mastery >= 40 ? 'Intermediate' : 'Developing';
        tiers[tier].push(entry);
      });
    Object.keys(tiers).forEach((tier) => {
      tiers[tier].sort((a, b) => Number(b.masteryScore || 0) - Number(a.masteryScore || 0));
    });
    return tiers;
  }, [topicMastery]);

  const badges = useMemo(() => {
    const list = [];

    if ((habit.longestStreak || 0) >= 30) {
      list.push({ tone: 'streak', label: '30 Day Streak', detail: 'Practiced 30 days in a row at your peak.' });
    } else if ((habit.longestStreak || 0) >= 7) {
      list.push({ tone: 'streak', label: '7 Day Streak', detail: 'Practiced 7 days in a row at your peak.' });
    } else if ((habit.currentStreak || 0) >= 3) {
      list.push({ tone: 'streak', label: '3 Day Streak', detail: 'You are 3 days into a fresh streak.' });
    }

    if (totalCorrect >= 250) {
      list.push({ tone: 'volume', label: '250 Solved', detail: 'Answered 250+ questions correctly.' });
    } else if (totalCorrect >= 100) {
      list.push({ tone: 'volume', label: '100 Solved', detail: 'Answered 100+ questions correctly.' });
    } else if (totalCorrect >= 25) {
      list.push({ tone: 'volume', label: '25 Solved', detail: 'Answered 25+ questions correctly.' });
    }

    if (overallAccuracy >= 80 && totalAttempts >= 20) {
      list.push({ tone: 'accuracy', label: 'Sharpshooter', detail: '80%+ accuracy across 20+ attempts.' });
    }

    const practicedDaysThisWeek = (habit.streakDays || []).filter((day) => day.practiced).length;
    if (practicedDaysThisWeek >= 6) {
      list.push({ tone: 'consistency', label: 'Consistency Pro', detail: 'Practiced on 6+ days this week.' });
    }

    if ((xp.level || 1) >= 5) {
      list.push({ tone: 'level', label: `Level ${xp.level}`, detail: `${xp.totalXp} total XP earned.` });
    }

    return list;
  }, [habit, totalCorrect, overallAccuracy, totalAttempts, xp]);

  const loading = !profile && !analytics && !error;

  if (loading) {
    return (
      <div className="page-grid">
        <section className="panel" aria-busy="true" aria-label="Loading profile">
          <div className="skeleton-chip" style={{ width: '160px', marginBottom: '0.7rem' }} />
          <div className="skeleton-chip" style={{ width: '320px' }} />
        </section>
        <div className="dashboard-skeleton-row">
          <div className="skeleton-block" />
          <div className="skeleton-block" />
          <div className="skeleton-block" />
        </div>
        <section className="panel">
          <div className="skeleton-block" style={{ minHeight: '220px' }} />
        </section>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="page-grid">
        <section className="panel error-state-card">
          <h3>Couldn't load your profile</h3>
          <p>{error}</p>
          <button type="button" className="solid-btn" onClick={load}>
            Try again
          </button>
        </section>
      </div>
    );
  }

  if (analytics && totalAttempts === 0) {
    return (
      <div className="page-grid">
        <section className="panel profile-header-panel">
          <div className="profile-identity">
            <span className="profile-avatar-lg">{(profile?.name || 'U').charAt(0).toUpperCase()}</span>
            <div>
              <h2>{profile?.name}</h2>
              <p className="user-email">{profile?.email}</p>
              <span className="chip nav-badge">{profile?.targetExam} Aspirant</span>
            </div>
          </div>
        </section>
        <EmptyState
          icon="analytics"
          title="No activity yet"
          description="Solve a few practice questions or run an exam simulation and your profile stats, badges, and activity will show up here."
          actionLabel="Start Practicing"
          onAction={() => navigate('/practice')}
        />
      </div>
    );
  }

  return (
    <div className="page-grid profile-page">
      <section className="panel profile-header-panel">
        <div className="profile-identity">
          <span className="profile-avatar-lg">{(profile?.name || 'U').charAt(0).toUpperCase()}</span>
          <div>
            <h2>{profile?.name}</h2>
            <p className="user-email">{profile?.email}</p>
            <div className="chip-wrap">
              <span className="chip nav-badge">{profile?.targetExam} Aspirant</span>
              {profile?.isAdmin && <span className="chip">Admin</span>}
              {formatJoinDate(profile?.createdAt) && (
                <span className="chip">Member since {formatJoinDate(profile.createdAt)}</span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="outline-btn"
          onClick={() => toast?.showToast('Profile editing is coming soon', { type: 'info' })}
        >
          Edit Profile
        </button>
      </section>

      {error && <section className="panel error-text">{error}</section>}

      <section className="panel profile-ring-panel">
        <div className="profile-ring-column">
          <div className="profile-ring-wrap" onMouseEnter={() => setIsRingHovered(true)} onMouseLeave={() => setIsRingHovered(false)}>
            <svg viewBox="0 0 180 180" className="profile-ring-svg" role="img" aria-label="Correct answers by subject">
              <circle cx={ringSegments.cx} cy={ringSegments.cy} r={ringSegments.radius} className="profile-ring-track" />
              {ringSegments.segments.map((segment) => (
                <circle
                  key={segment.subject}
                  cx={ringSegments.cx}
                  cy={ringSegments.cy}
                  r={ringSegments.radius}
                  stroke={segment.color}
                  strokeWidth="9"
                  fill="none"
                  strokeLinecap="round"
                  transform={`rotate(-90 ${ringSegments.cx} ${ringSegments.cy})`}
                  style={{
                    strokeDasharray: segment.strokeDasharray,
                    strokeDashoffset: segment.strokeDashoffset,
                    transition: 'stroke-dasharray 0.6s ease',
                  }}
                />
              ))}
              {ringSegments.segments.map((segment) => (
                <circle
                  key={`${segment.subject}-marker`}
                  cx={segment.marker.x}
                  cy={segment.marker.y}
                  r="3.5"
                  className="profile-ring-marker"
                  style={{ fill: segment.color }}
                />
              ))}
            </svg>
            <div className="profile-ring-center">
              {isRingHovered ? (
                <>
                  <strong>{overallAccuracy.toFixed(2)}%</strong>
                  <p className="profile-ring-accept-label">Acceptance</p>
                  <span className="profile-ring-submissions">
                    {totalAttempts} submission{totalAttempts === 1 ? '' : 's'}
                  </span>
                </>
              ) : (
                <>
                  <div className="profile-ring-count-row">
                    <strong>{solvedCountUp}</strong>
                    <span>/{solvedSummary.totalQuestions}</span>
                  </div>
                  <p className="profile-ring-solved-label">
                    <CheckIcon /> Solved
                  </p>
                </>
              )}
            </div>
          </div>
          <p className="profile-ring-attempting">{solvedSummary.attempting || 0} Attempting</p>
        </div>

        <div className="profile-ring-legend">
          {bySubject.length ? (
            bySubject.map((row) => (
              <article key={row.subject} className="profile-subject-box" style={{ borderColor: `${subjectColor(row.subject)}55` }}>
                <span className="profile-subject-dot" style={{ background: subjectColor(row.subject) }} />
                <div>
                  <strong>{row.subject}</strong>
                  <p>{Math.round((Number(row.accuracy || 0) / 100) * Number(row.attempts || 0))}/{row.attempts}</p>
                </div>
                <span className="profile-subject-acc">{Number(row.accuracy || 0).toFixed(0)}%</span>
              </article>
            ))
          ) : (
            <p>No subject data yet.</p>
          )}

          <article className="profile-subject-box profile-rank-box">
            <div>
              <strong>Standing</strong>
              <p>{benchmark.estimated ? `Ahead of ${benchmark.percentile}% of students` : 'Building your profile'}</p>
            </div>
          </article>
        </div>
      </section>

      <section className="panel profile-heatmap-panel">
        <div className="profile-heatmap-head">
          <p>
            <strong>{heatmapCalendar.submissionsInYear}</strong> submissions in the past one year
          </p>
          <div className="profile-heatmap-summary">
            <span>Total active days: <strong>{habit.totalActiveDays || 0}</strong></span>
            <span>Max streak: <strong>{habit.longestStreak || 0}</strong></span>
          </div>
        </div>

        {heatmapCalendar.months.length ? (
          <div className="profile-heatmap-grid">
            {heatmapCalendar.months.map((month) => (
              <div key={month.key} className="profile-heatmap-month" style={{ flexGrow: month.weeks }}>
                <div
                  className="profile-heatmap-month-grid"
                  style={{ gridTemplateColumns: `repeat(${month.weeks}, 1fr)` }}
                >
                  {month.cells.map((entry, index) =>
                    entry ? (
                      <span
                        key={entry.day}
                        className={`profile-heatmap-cell level-${heatmapLevel(entry.count)}`}
                        title={`${entry.count} attempt${entry.count === 1 ? '' : 's'} on ${formatHeatmapDate(entry.day)}`}
                      />
                    ) : (
                      <span key={`${month.key}-empty-${index}`} className="profile-heatmap-cell is-empty" />
                    )
                  )}
                </div>
                <span className="profile-heatmap-month-label">{month.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <p>No activity recorded yet.</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head-row">
          <h3>Badges</h3>
          <span className="chip">{badges.length}</span>
        </div>
        {badges.length ? (
          <div className="profile-badges-grid">
            {badges.map((badge) => (
              <article key={badge.label} className="profile-badge-card" title={badge.detail}>
                <span className="profile-badge-icon">
                  <BadgeIcon tone={badge.tone} />
                </span>
                <strong>{badge.label}</strong>
              </article>
            ))}
          </div>
        ) : (
          <p>Keep practicing — your first badge unlocks after a 3-day streak or 25 correct answers.</p>
        )}
      </section>

      <section className="panel stats-grid profile-stats-grid">
        <div className="metric-card metric-neutral">
          <h4>Level</h4>
          <strong>{xp.level}</strong>
          <p>{xp.totalXp} total XP · {xp.weeklyXp} this week</p>
        </div>
        <div className="metric-card metric-neutral">
          <h4>Current Streak</h4>
          <strong>{habit.currentStreak || 0} days</strong>
          <p>Longest streak: {habit.longestStreak || 0} days</p>
        </div>
        <div className="metric-card metric-neutral">
          <h4>Overall Accuracy</h4>
          <strong>{overallAccuracy.toFixed(1)}%</strong>
          <p>Across {totalAttempts} attempts</p>
        </div>
      </section>

      <section className="panel">
        <h3>Skills</h3>
        <p className="chart-caption">Topic mastery built from your practice and mock-test history.</p>
        <div className="profile-skills-list">
          {['Advanced', 'Intermediate', 'Developing'].map((tier) =>
            skillTiers[tier].length ? (
              <div key={tier} className="profile-skill-tier">
                <span className={`profile-skill-tier-label profile-skill-${tier.toLowerCase()}`}>{tier}</span>
                <div className="chip-wrap">
                  {skillTiers[tier].slice(0, 12).map((entry) => (
                    <span key={`${entry.subject}-${entry.topic}-${entry.subtopic || 'General'}`} className="chip">
                      {entry.topic} <small>x{entry.attempts}</small>
                    </span>
                  ))}
                </div>
              </div>
            ) : null
          )}
          {!skillTiers.Advanced.length && !skillTiers.Intermediate.length && !skillTiers.Developing.length && (
            <p>No topic mastery data yet.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <h3>Recent Activity</h3>
        <p className="chart-caption">Your latest attempts across practice and exam simulation.</p>
        <div className="profile-activity-list">
          {recentAttempts.length ? (
            recentAttempts.map((entry) => (
              <article key={entry._id || `${entry.topic}-${entry.createdAt}`} className="profile-activity-row">
                <span className={`profile-activity-dot ${entry.isCorrect ? 'is-correct' : 'is-incorrect'}`} />
                <div className="profile-activity-main">
                  <strong>{entry.topic}</strong>
                  <span>{entry.subject}{entry.difficulty ? ` · ${entry.difficulty}` : ''}</span>
                </div>
                <span className="profile-activity-time">{formatRelativeTime(entry.createdAt)}</span>
              </article>
            ))
          ) : (
            <p>No attempts yet.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default ProfilePage;