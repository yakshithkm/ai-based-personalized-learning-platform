import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { startRecommendation } from '../../api/learning';
import { DifficultyBadge, PriorityBadge, ProgressBar, ReasonBadge, TypeBadge, itemMeta, itemTitle } from './learningUi';

// Compact card used inside the sections (weak areas, mistakes, continue, challenges, explore).
const RecommendationCard = ({ item, ctaLabel }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const isContent = Boolean(item.content);
  const inProgress = item.progress?.status === 'in-progress';
  const label = ctaLabel || (!isContent ? t('navigation.practice') : inProgress ? t('learn.continue') : t('learn.start'));

  const openPractice = async () => {
    setBusy(true);
    try {
      await startRecommendation(item.id);
    } catch (err) {
      // opening practice should still work if the bookkeeping call fails
    }
    navigate(item.practice.route);
  };

  return (
    <article className="lr-card">
      <div className="lr-badge-row">
        <ReasonBadge reason={item.recommendationReason} />
        <PriorityBadge priority={item.priority} />
      </div>
      <h4>{itemTitle(item, t)}</h4>
      <p className="lr-meta">{itemMeta(item, t)}</p>
      <div className="lr-badge-row">
        {isContent && <TypeBadge type={item.content.contentType} />}
        {isContent && <span className="lr-badge lr-time">{t('learn.minutes', { count: item.content.estimatedMinutes })}</span>}
        {isContent && <DifficultyBadge difficulty={item.content.difficulty} />}
        {!isContent && item.practice?.difficulty && <DifficultyBadge difficulty={item.practice.difficulty} />}
        {!isContent && <span className="lr-badge lr-time">{t('common.questionCount', { count: item.practice.count })}</span>}
      </div>
      <p className="lr-card-reason">{item.reason}</p>
      {inProgress && <ProgressBar percent={item.progress.progressPercent} label={t('learn.progress')} />}
      {isContent ? (
        <Link className="outline-btn lr-card-cta" to={`/learn/${item.id}`}>{label}</Link>
      ) : (
        <button type="button" className="outline-btn lr-card-cta" onClick={openPractice} disabled={busy}>
          {busy ? t('learn.opening') : label}
        </button>
      )}
    </article>
  );
};

export default RecommendationCard;