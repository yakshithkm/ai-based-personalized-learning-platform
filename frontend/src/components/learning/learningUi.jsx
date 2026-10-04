// Small presentational pieces shared by the learning recommendation UI.
import { useTranslation } from 'react-i18next';
import { difficultyLabel, subjectLabel } from '../../i18n/labels';

export const REASON_LABELS = {
  'weak-topic': 'Weak topic',
  'weak-concept': 'Weak concept',
  'mistake-recovery': 'Fix mistakes',
  'spaced-review': 'Due for review',
  prerequisite: 'Foundation first',
  'new-topic': 'New topic',
  'mastery-progression': 'Level up',
  'exam-preparation': 'Exam focus',
  revision: 'Revision',
  'advanced-challenge': 'Challenge',
  'stagnation-break': 'Fresh approach',
  fallback: 'Balanced pick',
  'cold-start': 'Getting started',
};

export const TYPE_LABELS = {
  video: 'Video',
  article: 'Article',
  notes: 'Notes',
  concept: 'Concept',
  example: 'Worked example',
  quiz: 'Quiz',
  practice: 'Practice',
  revision: 'Revision',
  'formula-sheet': 'Formula sheet',
};

export const STAGE_LABELS = {
  introduction: 'Concept',
  explanation: 'Explanation',
  'worked-example': 'Worked example',
  practice: 'Practice',
  revision: 'Revision',
  advanced: 'Advanced',
};

// Small SVG icons (no emoji anywhere in the app) matching the existing
// lucide-style, viewBox="0 0 24 24" icon convention used elsewhere (see Layout.jsx).
export const ThumbsUpIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 22H4a1 1 0 01-1-1v-9a1 1 0 011-1h3m0 11V11m0 11l4.4 1.47a2 2 0 00.6.09h6.94a2 2 0 001.97-1.64l1.2-6.5A2 2 0 0018.14 12H14l.83-4.15A2 2 0 0013.02 5.5L7 11.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ThumbsDownIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M17 2h3a1 1 0 011 1v9a1 1 0 01-1 1h-3m0-11v11m0-11l-4.4-1.47a2 2 0 00-.6-.09H5.06a2 2 0 00-1.97 1.64l-1.2 6.5A2 2 0 003.86 12H8l-.83 4.15A2 2 0 0010.98 18.5L17 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const BookIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 5a2 2 0 012-2h6v18H6a2 2 0 01-2-2V5zM20 5a2 2 0 00-2-2h-6v18h6a2 2 0 002-2V5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

export const PencilIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const RepeatIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const DifficultyBadge = ({ difficulty }) => {
  const { t } = useTranslation();
  return difficulty ? (
    <span className={`lr-badge lr-diff-${String(difficulty).toLowerCase()}`}>{difficultyLabel(t, difficulty)}</span>
  ) : null;
};

export const PriorityBadge = ({ priority }) => {
  const { t } = useTranslation();
  return priority ? (
    <span className={`lr-badge lr-priority-${priority}`}>
      {t('learn.priorityBadge', { level: t(`learn.priorityLevel.${String(priority).toLowerCase()}`, { defaultValue: priority }) })}
    </span>
  ) : null;
};

export const ReasonBadge = ({ reason }) => {
  const { t } = useTranslation();
  return reason ? (
    <span className="lr-badge lr-reason">{t(`learn.reasons.${reason}`, { defaultValue: REASON_LABELS[reason] || reason })}</span>
  ) : null;
};

export const TypeBadge = ({ type }) => {
  const { t } = useTranslation();
  return <span className="lr-badge lr-type">{t(`learn.types.${type}`, { defaultValue: TYPE_LABELS[type] || type })}</span>;
};

// Stage label for a learning-path step (introduction, worked-example, ...).
export const stageLabel = (t, stage) => t(`learn.stages.${stage}`, { defaultValue: STAGE_LABELS[stage] || stage });

// Content titles come from the content database (educational content, not UI) and stay as
// authored. Only the "Practice:" prefix of practice-only recommendations is localized.
export const itemTitle = (item, t) =>
  item.content
    ? item.content.title
    : t
      ? t('learn.practiceTitle', { topic: item.target.concept || item.target.topic })
      : `Practice: ${item.target.concept || item.target.topic}`;

export const itemMeta = (item, t) => {
  const parts = [t ? subjectLabel(t, item.target.subject) : item.target.subject, item.target.topic];
  if (item.target.concept && item.target.concept !== item.target.topic) parts.push(item.target.concept);
  return parts.filter(Boolean).join(' • ');
};

export const ProgressBar = ({ percent = 0, label }) => {
  const { t } = useTranslation();
  return (
    <div className="lr-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={label || t('learn.progress')}>
      <span style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
};

// Measurable numbers behind a recommendation, shown as compact chips.
export const SignalChips = ({ signals = {} }) => {
  const { t } = useTranslation();
  const chips = [];
  if (signals.attempts > 0 && signals.accuracy !== undefined && signals.accuracy !== null) {
    chips.push(t('learn.signals.accuracy', { value: Math.round(signals.accuracy) }), t('learn.signals.attempts', { count: signals.attempts }));
  }
  if (signals.openMistakes > 0) chips.push(t('learn.signals.openMistakes', { count: signals.openMistakes }));
  if (signals.dueMistakes > 0) chips.push(t('learn.signals.due', { count: signals.dueMistakes }));
  if (!chips.length) return null;
  return (
    <ul className="lr-chips" aria-label={t('learn.signals.aria')}>
      {chips.map((chip) => (
        <li key={chip}>{chip}</li>
      ))}
    </ul>
  );
};