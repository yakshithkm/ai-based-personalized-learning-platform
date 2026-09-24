import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
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
const LearnNextCard = ({ item, eyebrow = 'Learn Next' }) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!item) return null;

  const inProgress = item.progress?.status === 'in-progress';
  const isContent = Boolean(item.content);
  const ctaLabel = !isContent ? 'Start Practice' : inProgress ? 'Continue Learning' : 'Start Learning';

  // Practice-only recommendations (no study material yet) are opened via /start so the click
  // and start are recorded, then the practice set loads.
  const startPractice = async () => {
    setBusy(true);
    setError('');
    try {
      await startRecommendation(item.id);
      navigate(item.practice.route);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not start this practice set. Please try again.');
      setBusy(false);
    }
  };

  return (
    <section className="panel lr-hero" aria-labelledby="lr-hero-title">
      <div className="lr-hero-top">
        <p className="eyebrow-label lr-eyebrow">{eyebrow}</p>
        <div className="lr-badge-row">
          <PriorityBadge priority={item.priority} />
          <ReasonBadge reason={item.recommendationReason} />
        </div>
      </div>

      <h2 id="lr-hero-title" className="lr-hero-title">{itemTitle(item)}</h2>
      <p className="lr-meta">{itemMeta(item)}</p>
      <div className="lr-badge-row">
        {isContent && <TypeBadge type={item.content.contentType} />}
        {isContent && <span className="lr-badge lr-time">{item.content.estimatedMinutes} min</span>}
        {isContent && <DifficultyBadge difficulty={item.content.difficulty} />}
        {!isContent && item.practice?.difficulty && <DifficultyBadge difficulty={item.practice.difficulty} />}
        {!isContent && item.practice?.count && <span className="lr-badge lr-time">{item.practice.count} questions</span>}
      </div>

      <div className="lr-why">
        <h3>Why this is recommended</h3>
        <p>{item.reason}</p>
        <SignalChips signals={item.signals} />
      </div>

      {inProgress && (
        <div className="lr-resume">
          <ProgressBar percent={item.progress.progressPercent} label="Your progress in this resource" />
          <small>{item.progress.progressPercent}% complete</small>
        </div>
      )}

      {item.path?.length > 0 && (
        <div className="lr-path-wrap">
          <h3>Recommended path</h3>
          <LearningPath steps={item.path} practiceRecommendationId={item.id} />
        </div>
      )}

      <div className="lr-cta-row">
        {isContent ? (
          <Link className="solid-btn lr-cta" to={`/learn/${item.id}`}>{ctaLabel}</Link>
        ) : (
          <button type="button" className="solid-btn lr-cta" onClick={startPractice} disabled={busy}>
            {busy ? 'Opening...' : ctaLabel}
          </button>
        )}
      </div>
      {error && <p className="error-text" role="alert">{error}</p>}
    </section>
  );
};

export default LearnNextCard;