// Top-right warning pop-up for "no person in front of the camera". Uses the app's existing
// toast look (.toast-stack / .toast-item) so it feels native.
const PresenceToast = ({ toast, onDismiss }) => {
  if (!toast) return null;
  const isFinal = toast.kind === 'final';

  return (
    <div className="toast-stack exam-presence-stack" aria-live="assertive">
      <div className={`toast-item toast-warning ${isFinal ? 'final' : ''}`} role="alert">
        <span>
          <strong>{isFinal ? '⚠ Camera check' : '⚠ No person detected'}</strong>
          <br />
          {toast.message}
          {toast.detail && <small className="toast-detail">{toast.detail}</small>}
        </span>
        {!isFinal && (
          <button type="button" className="toast-dismiss" onClick={onDismiss} aria-label="Dismiss warning">
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default PresenceToast;