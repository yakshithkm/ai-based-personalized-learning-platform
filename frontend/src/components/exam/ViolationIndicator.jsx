// "Violations: n / max" with a progressively stronger (but static, non-animated) treatment:
// 0 normal, 1-2 warning, 3-4 strong warning, max critical. Only focus violations count here.
const getLevel = (count, max) => {
  if (count >= max) return 'critical';
  if (count >= 3) return 'alert';
  if (count >= 1) return 'warn';
  return 'ok';
};

const ViolationIndicator = ({ count, max }) => (
  <div
    className={`exam-violation-indicator level-${getLevel(count, max)}`}
    role="status"
    aria-live="polite"
    aria-label={`Focus violations: ${count} of ${max}`}
  >
    <span>Violations</span>
    <strong>
      {count} / {max}
    </strong>
  </div>
);

export default ViolationIndicator;