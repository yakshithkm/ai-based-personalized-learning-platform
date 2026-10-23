import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FLASHCARD_LIMITS } from '../../utils/flashcards';

// Reuses the app's modal chrome (admin-modal*) so dialogs look the same everywhere.
const RenameDeckModal = ({ open, deck, busy = false, error = '', onSave, onCancel }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTitle(deck?.title || '');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, deck]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && !busy && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  const trimmed = title.trim();

  const submit = (event) => {
    event.preventDefault();
    if (!trimmed || busy) return;
    onSave(trimmed);
  };

  // Portaled to <body> so it is centred in the viewport and above the sticky header and sidebar
  // (an in-page fixed element is trapped under them by the page's stacking context).
  return createPortal(
    <div className="admin-modal-backdrop fc-modal-backdrop" role="presentation" onClick={busy ? undefined : onCancel}>
      <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="fc-rename-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="fc-rename-title">{t('flashcards.rename.title')}</h3>
        <form onSubmit={submit}>
          <label className="fc-field">
            <span>{t('flashcards.rename.label')}</span>
            <input ref={inputRef} value={title} maxLength={FLASHCARD_LIMITS.TITLE} onChange={(e) => setTitle(e.target.value)} />
          </label>
          {error && <p className="error-text" role="alert">{error}</p>}
          <div className="admin-modal-actions">
            <button type="button" className="outline-btn" onClick={onCancel} disabled={busy}>{t('flashcards.cancel')}</button>
            <button type="submit" className="solid-btn" disabled={busy || !trimmed}>{busy ? t('flashcards.saving') : t('flashcards.save')}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default RenameDeckModal;
