import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { startRecommendation } from '../../api/learning';
import { DifficultyBadge, PriorityBadge, ProgressBar, ReasonBadge, TypeBadge, itemMeta, itemTitle } from './learningUi';

// Compact card used inside the sections (weak areas, mistakes, continue, challenges, explore).
const RecommendationCard = ({ item, ctaLabel }) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const isContent = Boolean(item.content);
  const inProgress = item.progress?.status === 'in-progress';
  const label = ctaLabel || (!isContent ? 'Practice' : inProgress ? 'Continue' : 'Start');

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
      <h4>{itemTitle(item)}</h4>
      <p className="lr-meta">{itemMeta(item)}</p>
      <div className="lr-badge-row">
        {isContent && <TypeBadge type={item.content.contentType} />}
        {isContent && <span className="lr-badge lr-time">{item.content.estimatedMinutes} min</span>}
        {isContent && <DifficultyBadge difficulty={item.content.difficulty} />}
        {!isContent && item.practice?.difficulty && <DifficultyBadge difficulty={item.practice.difficulty} />}
        {!isContent && <span className="lr-badge lr-time">{item.practice.count} questions</span>}
      </div>
      <p className="lr-card-reason">{item.reason}</p>
      {inProgress && <ProgressBar percent={item.progress.progressPercent} label="Progress" />}
      {isContent ? (
        <Link className="outline-btn lr-card-cta" to={`/learn/${item.id}`}>{label}</Link>
      ) : (
        <button type="button" className="outline-btn lr-card-cta" onClick={openPractice} disabled={busy}>
          {busy ? 'Opening...' : label}
        </button>
      )}
    </article>
  );
};

export default RecommendationCard;