import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { stageLabel } from './learningUi';
import { difficultyLabel } from '../../i18n/labels';

const StatusMark = ({ status }) => {
  const { t } = useTranslation();
  if (status === 'completed') return <span className="lr-step-mark lr-step-done" aria-label={t('learn.status.completed')}>✓</span>;
  if (status === 'in-progress') return <span className="lr-step-mark lr-step-active" aria-label={t('learn.status.inProgress')}>◐</span>;
  if (status === 'next') return <span className="lr-step-mark lr-step-next" aria-label={t('learn.status.next')}>●</span>;
  return <span className="lr-step-mark" aria-label={t('learn.status.upcoming')}>○</span>;
};

const LearningPath = ({ steps = [], practiceRecommendationId }) => {
  const { t, i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || 'en').startsWith('en');
  if (!steps.length) return null;
  return (
    <ol className="lr-path" aria-label={t('learn.pathAria')}>
      {steps.map((step) => {
        const isPractice = step.kind === 'practice';
        // The server's practice label (e.g. "5 Easy Questions") is English-only: shown verbatim in
        // English, rebuilt from its parts in other languages.
        const label = isPractice
          ? (isEnglish && step.label ? step.label : t('learn.practiceStepLabel', { count: step.count, difficulty: difficultyLabel(t, step.difficulty) }))
          : step.title;
        const sub = isPractice ? t('learn.minutes', { count: step.minutes }) : `${stageLabel(t, step.stage)} · ${t('learn.minutes', { count: step.minutes })}`;
        const to = isPractice
          ? practiceRecommendationId
            ? `/practice?mode=content-practice&rec=${practiceRecommendationId}&count=${step.count}`
            : null
          : step.recommendationId
            ? `/learn/${step.recommendationId}`
            : null;
        const body = (
          <>
            <StatusMark status={step.status} />
            <span className="lr-step-text">
              <strong>{label}</strong>
              <small>{sub}</small>
            </span>
          </>
        );
        return (
          <li key={step.order} className={`lr-step lr-step-${step.status}`}>
            {to && step.status !== 'completed' ? <Link to={to}>{body}</Link> : <div>{body}</div>}
          </li>
        );
      })}
    </ol>
  );
};

export default LearningPath;