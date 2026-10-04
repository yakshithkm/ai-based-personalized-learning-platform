import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { translateServerError } from '../../i18n/serverErrors';
import { startRecommendation } from '../../api/learning';
import LearningPath from './LearningPath';
import {
  DifficultyBadge,
  PriorityBadge,
  ProgressBar,
  ReasonBadge,
  SignalChips,
  TypeBadge,
  itemMeta,
  itemTitle,
} from './learningUi';

// The single most important recommendation: visually dominant, explains itself with the real
// numbers behind it, and shows the learning path it belongs to.
const LearnNextCard = ({ item, eyebrow }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!item) return null;

  const inProgress = item.progress?.status === 'in-progress';
  const isContent = Boolean(item.content);
  const ctaLabel = !isContent ? t('dashboard.startPractice') : inProgress ? t('learn.continueLearning') : t('learn.startLearning');

  // Practice-only recommendations (no study material yet) are opened via /start so the click
  // and start are recorded, then the practice set loads.
  const startPractice = async () => {
    setBusy(true);
    setError('');
    try {
      await startRecommendation(item.id);
      navigate(item.practice.route);
    } catch (err) {
      setError(translateServerError(t, err?.response?.data?.message, 'learn.startFailed'));
      setBusy(false);
    }
  };

  return (
    <section className="panel lr-hero" aria-labelledby="lr-hero-title">
      <div className="lr-hero-top">
        <p className="eyebrow-label lr-eyebrow">{eyebrow || t('learn.learnNext')}</p>
        <div className="lr-badge-row">
          <PriorityBadge priority={item.priority} />
          <ReasonBadge reason={item.recommendationReason} />
        </div>
      </div>

      <h2 id="lr-hero-title" className="lr-hero-title">{itemTitle(item, t)}</h2>
      <p className="lr-meta">{itemMeta(item, t)}</p>
      <div className="lr-badge-row">
        {isContent && <TypeBadge type={item.content.contentType} />}
        {isContent && <span className="lr-badge lr-time">{t('learn.minutes', { count: item.content.estimatedMinutes })}</span>}
        {isContent && <DifficultyBadge difficulty={item.content.difficulty} />}
        {!isContent && item.practice?.difficulty && <DifficultyBadge difficulty={item.practice.difficulty} />}
        {!isContent && item.practice?.count && <span className="lr-badge lr-time">{t('common.questionCount', { count: item.practice.count })}</span>}
      </div>

      <div className="lr-why">
        <h3>{t('learn.whyRecommended')}</h3>
        <p>{item.reason}</p>
        <SignalChips signals={item.signals} />
      </div>

      {inProgress && (
        <div className="lr-resume">
          <ProgressBar percent={item.progress.progressPercent} label={t('learn.yourProgress')} />
          <small>{t('practice.percentComplete', { percent: item.progress.progressPercent })}</small>
        </div>
      )}

      {item.path?.length > 0 && (
        <div className="lr-path-wrap">
          <h3>{t('learn.recommendedPath')}</h3>
          <LearningPath steps={item.path} practiceRecommendationId={item.id} />
        </div>
      )}

      <div className="lr-cta-row">
        {isContent ? (
          <Link className="solid-btn lr-cta" to={`/learn/${item.id}`}>{ctaLabel}</Link>
        ) : (
          <button type="button" className="solid-btn lr-cta" onClick={startPractice} disabled={busy}>
            {busy ? t('learn.opening') : ctaLabel}
          </button>
        )}
      </div>
      {error && <p className="error-text" role="alert">{error}</p>}
    </section>
  );
};

export default LearnNextCard;