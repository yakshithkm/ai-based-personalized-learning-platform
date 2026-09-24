import { Link } from 'react-router-dom';
import { STAGE_LABELS } from './learningUi';

const StatusMark = ({ status }) => {
  if (status === 'completed') return <span className="lr-step-mark lr-step-done" aria-label="Completed">✓</span>;
  if (status === 'in-progress') return <span className="lr-step-mark lr-step-active" aria-label="In progress">◐</span>;
  if (status === 'next') return <span className="lr-step-mark lr-step-next" aria-label="Up next">●</span>;
  return <span className="lr-step-mark" aria-label="Upcoming">○</span>;
};

const LearningPath = ({ steps = [], practiceRecommendationId }) => {
  if (!steps.length) return null;
  return (
    <ol className="lr-path" aria-label="Recommended learning path">
      {steps.map((step) => {
        const isPractice = step.kind === 'practice';
        const label = isPractice ? step.label : step.title;
        const sub = isPractice ? `${step.minutes} min` : `${STAGE_LABELS[step.stage] || step.stage} · ${step.minutes} min`;
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