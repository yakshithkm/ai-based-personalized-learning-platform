import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import api from '../api/client';
import EmptyState from '../components/EmptyState';
import InviteFriendsModal from '../components/InviteFriendsModal';
import LanguageSelector from '../components/LanguageSelector';
import { translateServerError } from '../i18n/serverErrors';
import { mistakeTypeLabel, subjectLabel, difficultyLabel } from '../i18n/labels';
import { useLocaleFormat } from '../i18n/format';
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

const formatRelativeTime = (dateInput, t) => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.max(Math.floor(diffMs / 1000), 0);

  if (diffSec < 60) return t('time.justNow');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t('time.minutesAgoLong', { count: diffMin });
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return t('time.hoursAgoLong', { count: diffHour });
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return t('time.daysAgoLong', { count: diffDay });
  const diffMonth = Math.floor(diffDay / 30);
  return t('time.monthsAgoLong', { count: diffMonth });
};

const formatJoinDate = (dateInput, formatDate) => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';
  return formatDate(date, { month: 'long', year: 'numeric' });
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
  const { t } = useTranslation();
  const { formatDate, formatNumber, formatPercent } = useLocaleFormat();
  const navigate = useNavigate();
  const toast = useToast();

  const [profile, setProfile] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');
  const [isRingHovered, setIsRingHovered] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

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
      setError(translateServerError(t, err?.response?.data?.message, 'profile.loadFailed'));
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
  const heatmapScrollRef = useRef(null);

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

      const label = formatDate(new Date(`${entries[0].day}T00:00:00Z`), { month: 'short', timeZone: 'UTC' });

      return { key: monthKey, cells, weeks: cells.length / 7, label };
    });

    const submissionsInYear = days.reduce((sum, entry) => sum + (entry.count || 0), 0);

    return { months, submissionsInYear };
  }, [habit.heatmap, formatDate]);

  // Default the heatmap's horizontal scroll position to the most recent
  // months (right end) rather than the oldest (left end) — on a phone,
  // where the calendar genuinely scrolls, the current streak is what
  // matters most and shouldn't require a manual swipe to reach. Desktop
  // never overflows its container, so this is a no-op there.
  useEffect(() => {
    const el = heatmapScrollRef.current;
    if (el) {
      el.scrollLeft = el.scrollWidth;
    }
  }, [heatmapCalendar]);

  const heatmapLevel = (count) => {
    if (!count) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 9) return 3;
    return 4;
  };

  const formatHeatmapDate = (dayKey) =>
    formatDate(new Date(`${dayKey}T00:00:00Z`), {
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
      list.push({ tone: 'streak', label: t('achievementDefs.streak30.label'), detail: t('achievementDefs.streak30.description') });
    } else if ((habit.longestStreak || 0) >= 7) {
      list.push({ tone: 'streak', label: t('achievementDefs.streak7.label'), detail: t('achievementDefs.streak7.description') });
    } else if ((habit.currentStreak || 0) >= 3) {
      list.push({ tone: 'streak', label: t('profile.badges.streak3Label'), detail: t('profile.badges.streak3Detail') });
    }

    if (totalCorrect >= 250) {
      list.push({ tone: 'volume', label: t('achievementDefs.solved250.label'), detail: t('achievementDefs.solved250.description') });
    } else if (totalCorrect >= 100) {
      list.push({ tone: 'volume', label: t('achievementDefs.solved100.label'), detail: t('achievementDefs.solved100.description') });
    } else if (totalCorrect >= 25) {
      list.push({ tone: 'volume', label: t('achievementDefs.solved25.label'), detail: t('achievementDefs.solved25.description') });
    }

    if (overallAccuracy >= 80 && totalAttempts >= 20) {
      list.push({ tone: 'accuracy', label: t('achievementDefs.sharpshooter.label'), detail: t('achievementDefs.sharpshooter.description') });
    }

    const practicedDaysThisWeek = (habit.streakDays || []).filter((day) => day.practiced).length;
    if (practicedDaysThisWeek >= 6) {
      list.push({ tone: 'consistency', label: t('achievementDefs.consistencyPro.label'), detail: t('achievementDefs.consistencyPro.description') });
    }

    if ((xp.level || 1) >= 5) {
      list.push({ tone: 'level', label: t('achievementDefs.level.label', { level: xp.level }), detail: t('achievementDefs.level.description', { xp: xp.totalXp }) });
    }

    return list;
  }, [habit, totalCorrect, overallAccuracy, totalAttempts, xp, t]);

  const loading = !profile && !analytics && !error;

  if (loading) {
    return (
      <div className="page-grid">
        <section className="panel" aria-busy="true" aria-label={t('profile.loading')}>
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
          <h3>{t('profile.couldntLoad')}</h3>
          <p>{error}</p>
          <button type="button" className="solid-btn" onClick={load}>
            {t('common.tryAgain')}
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
              <span className="chip nav-badge">{t('layout.aspirant', { exam: profile?.targetExam })}</span>
            </div>
          </div>
          <button type="button" className="outline-btn" onClick={() => setIsInviteModalOpen(true)}>
            {t('common.inviteFriends')}
          </button>
        </section>
        <EmptyState
          icon="analytics"
          title={t('profile.noActivityTitle')}
          description={t('profile.noActivityText')}
          actionLabel={t('profile.startPracticing')}
          onAction={() => navigate('/practice')}
        />
        <InviteFriendsModal open={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} />
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
              <span className="chip nav-badge">{t('layout.aspirant', { exam: profile?.targetExam })}</span>
              {profile?.isAdmin && <span className="chip">{t('profile.admin')}</span>}
              {formatJoinDate(profile?.createdAt, formatDate) && (
                <span className="chip">{t('profile.memberSince', { date: formatJoinDate(profile.createdAt, formatDate) })}</span>
              )}
            </div>
          </div>
        </div>
        <div className="profile-header-actions">
          <button
            type="button"
            className="outline-btn"
            onClick={() => toast?.showToast(t('profile.editComingSoon'), { type: 'info' })}
          >
            {t('profile.editProfile')}
          </button>
          <button type="button" className="outline-btn" onClick={() => setIsInviteModalOpen(true)}>
            {t('common.inviteFriends')}
          </button>
        </div>
      </section>

      <section className="panel profile-language-panel" aria-labelledby="profile-language-heading">
        <h3 id="profile-language-heading">{t('language.settingsTitle')}</h3>
        <p className="chart-caption">{t('language.settingsHint')}</p>
        <LanguageSelector variant="field" align="left" />
      </section>

      <InviteFriendsModal open={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} />

      {error && <section className="panel error-text">{error}</section>}

      <section className="panel profile-ring-panel">
        <div className="profile-ring-column">
          <div className="profile-ring-wrap" onMouseEnter={() => setIsRingHovered(true)} onMouseLeave={() => setIsRingHovered(false)}>
            <svg viewBox="0 0 180 180" className="profile-ring-svg" role="img" aria-label={t('profile.ringAria')}>
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
                  <strong>{formatPercent(overallAccuracy.toFixed(2))}</strong>
                  <p className="profile-ring-accept-label">{t('profile.acceptance')}</p>
                  <span className="profile-ring-submissions">
                    {t('profile.submissions', { count: totalAttempts })}
                  </span>
                </>
              ) : (
                <>
                  <div className="profile-ring-count-row">
                    <strong>{solvedCountUp}</strong>
                    <span>/{solvedSummary.totalQuestions}</span>
                  </div>
                  <p className="profile-ring-solved-label">
                    <CheckIcon /> {t('profile.solved')}
                  </p>
                </>
              )}
            </div>
          </div>
          <p className="profile-ring-attempting">{t('profile.attempting', { count: solvedSummary.attempting || 0 })}</p>
        </div>

        <div className="profile-ring-legend">
          {bySubject.length ? (
            bySubject.map((row) => (
              <article key={row.subject} className="profile-subject-box" style={{ borderColor: `${subjectColor(row.subject)}55` }}>
                <span className="profile-subject-dot" style={{ background: subjectColor(row.subject) }} />
                <div>
                  <strong>{subjectLabel(t, row.subject)}</strong>
                  <p>{Math.round((Number(row.accuracy || 0) / 100) * Number(row.attempts || 0))}/{row.attempts}</p>
                </div>
                <span className="profile-subject-acc">{formatPercent(Number(row.accuracy || 0).toFixed(0))}</span>
              </article>
            ))
          ) : (
            <p>{t('dashboard.noSubjectData')}</p>
          )}

          <article className="profile-subject-box profile-rank-box">
            <div>
              <strong>{t('profile.standing')}</strong>
              <p>{benchmark.estimated ? t('profile.aheadOf', { percent: benchmark.percentile }) : t('profile.buildingProfile')}</p>
            </div>
          </article>
        </div>
      </section>

      <section className="panel profile-heatmap-panel">
        <div className="profile-heatmap-head">
          <p>
            <Trans i18nKey="profile.submissionsInYear" values={{ count: heatmapCalendar.submissionsInYear }} components={{ strong: <strong /> }} />
          </p>
          <div className="profile-heatmap-summary">
            <span>{t('profile.totalActiveDays')}: <strong>{habit.totalActiveDays || 0}</strong></span>
            <span>{t('profile.maxStreak')}: <strong>{habit.longestStreak || 0}</strong></span>
          </div>
        </div>

        {heatmapCalendar.months.length ? (
          <div className="responsive-scroll profile-heatmap-scroll" ref={heatmapScrollRef}>
          <div className="profile-heatmap-grid">
            {heatmapCalendar.months.map((month) => (
              <div key={month.key} className="profile-heatmap-month" style={{ '--month-weeks': month.weeks }}>
                <div className="profile-heatmap-month-grid">
                  {month.cells.map((entry, index) =>
                    entry ? (
                      <span
                        key={entry.day}
                        className={`profile-heatmap-cell level-${heatmapLevel(entry.count)}`}
                        title={t('profile.heatmapCell', { count: entry.count, date: formatHeatmapDate(entry.day) })}
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
          </div>
        ) : (
          <p>{t('profile.noActivityRecorded')}</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head-row">
          <h3>{t('profile.badgesTitle')}</h3>
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
          <p>{t('profile.firstBadgeHint')}</p>
        )}
      </section>

      <section className="panel stats-grid profile-stats-grid">
        <div className="metric-card metric-neutral">
          <h4>{t('profile.level')}</h4>
          <strong>{xp.level}</strong>
          <p>{t('profile.xpSummary', { total: xp.totalXp, weekly: xp.weeklyXp })}</p>
        </div>
        <div className="metric-card metric-neutral">
          <h4>{t('profile.currentStreak')}</h4>
          <strong>{t('dashboard.daysCount', { count: habit.currentStreak || 0 })}</strong>
          <p>{t('dashboard.longestStreak', { count: habit.longestStreak || 0 })}</p>
        </div>
        <div className="metric-card metric-neutral">
          <h4>{t('profile.overallAccuracy')}</h4>
          <strong>{formatPercent(overallAccuracy.toFixed(1))}</strong>
          <p>{t('profile.acrossAttempts', { count: totalAttempts })}</p>
        </div>
      </section>

      <section className="panel">
        <h3>{t('profile.skills')}</h3>
        <p className="chart-caption">{t('profile.skillsHint')}</p>
        <div className="profile-skills-list">
          {['Advanced', 'Intermediate', 'Developing'].map((tier) =>
            skillTiers[tier].length ? (
              <div key={tier} className="profile-skill-tier">
                <span className={`profile-skill-tier-label profile-skill-${tier.toLowerCase()}`}>{t(`profile.tiers.${tier.toLowerCase()}`)}</span>
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
            <p>{t('profile.noMastery')}</p>
          )}
        </div>
      </section>

      <section className="panel">
        <h3>{t('profile.recentActivity')}</h3>
        <p className="chart-caption">{t('profile.recentActivityHint')}</p>
        <div className="profile-activity-list">
          {recentAttempts.length ? (
            recentAttempts.map((entry) => (
              <article key={entry._id || `${entry.topic}-${entry.createdAt}`} className="profile-activity-row">
                <span className={`profile-activity-dot ${entry.isCorrect ? 'is-correct' : 'is-incorrect'}`} />
                <div className="profile-activity-main">
                  <strong>{entry.topic}</strong>
                  <span>{subjectLabel(t, entry.subject)}{entry.difficulty ? ` · ${difficultyLabel(t, entry.difficulty)}` : ''}</span>
                </div>
                <span className="profile-activity-time">{formatRelativeTime(entry.createdAt, t)}</span>
              </article>
            ))
          ) : (
            <p>{t('profile.noAttempts')}</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default ProfilePage;