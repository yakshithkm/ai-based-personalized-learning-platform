// Shared "nothing here yet" panel — icon + title + description, optional
// action button. Used wherever a page has genuinely no data instead of a
// blank panel or a bare line of text.

const icons = {
  practice: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h16v14H4V4zm2 2v10h12V6H6zm3 3h6v2H9V9zm0 4h6v2H9v-2z" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 20V10h3v10H5zm5.5 0V4h3v16h-3zM16 20v-7h3v7h-3z" />
    </svg>
  ),
  exam: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 2h8a1 1 0 0 1 1 1v1h1a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h1V3a1 1 0 0 1 1-1zm0 3H7v15h10V5h-1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V5zm1-1v1h6V4H9zm-.5 6h7v1.5h-7V10zm0 3h7v1.5h-7V13zm0 3h4.5v1.5H8.5V16z" />
    </svg>
  ),
};

const EmptyState = ({ icon = 'practice', title, description, actionLabel, onAction }) => (
  <section className="panel empty-state-card">
    <span className="empty-state-icon" aria-hidden="true">
      {icons[icon] || icons.practice}
    </span>
    <h3>{title}</h3>
    {description && <p>{description}</p>}
    {actionLabel && onAction && (
      <button type="button" className="solid-btn" onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </section>
);

export default EmptyState;