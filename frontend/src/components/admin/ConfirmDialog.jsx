import { createPortal } from 'react-dom';

// Simple, accessible confirmation modal used before every destructive admin
// action (delete question/topic, etc.) per the "confirmation dialogs before
// destructive actions" requirement.
const ConfirmDialog = ({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = true,
  busy = false,
  busyLabel = 'Working...',
  centered = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  // `centered` (opt-in) renders into document.body, so the dialog escapes the page's stacking
  // context and sits above the header/sidebar, and centres it in the viewport. Admin screens keep
  // the original top-aligned, in-place behaviour.
  const dialog = (
    <div className={`admin-modal-backdrop${centered ? ' fc-modal-backdrop' : ''}`} role="presentation" onClick={onCancel}>
      <div
        className="admin-modal admin-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title">{title}</h3>
        {message && <p>{message}</p>}
        <div className="admin-modal-actions">
          <button type="button" className="outline-btn" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'admin-danger-btn' : 'solid-btn'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return centered ? createPortal(dialog, document.body) : dialog;
};

export default ConfirmDialog;