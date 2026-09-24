// Before/after accuracy for a completed learning path. Wording reports what happened
// ("after completing"); it never claims the content caused the change.
const ImprovementBanner = ({ title, effectiveness }) => {
  if (!effectiveness) return null;

  if (!effectiveness.available) {
    return effectiveness.message ? (
      <section className="panel lr-improve" aria-live="polite">
        <h3>Learning progress</h3>
        <p>{effectiveness.message}</p>
      </section>
    ) : null;
  }

  const { before, after, delta, hasBaseline } = effectiveness;
  const points = delta?.accuracyPoints;
  return (
    <section className="panel lr-improve" aria-live="polite">
      <h3>Learning progress{title ? `: ${title}` : ''}</h3>
      {hasBaseline && (
        <div className="lr-improve-numbers">
          <div><small>Before</small><strong>{Math.round(before.accuracy)}%</strong></div>
          <span aria-hidden="true">→</span>
          <div><small>After</small><strong>{Math.round(after.accuracy)}%</strong></div>
          <div className={`lr-improve-delta ${points >= 0 ? 'up' : 'down'}`}>
            {points > 0 ? '+' : ''}{points} pts
          </div>
        </div>
      )}
      <p>{effectiveness.message}</p>
    </section>
  );
};

export default ImprovementBanner;