import { useTranslation } from 'react-i18next';
import { FLASHCARD_LIMITS } from '../../utils/flashcards';

// Editable front/back pair used while reviewing generated cards before saving.
const CardEditorRow = ({ index, card, busy = false, canRegenerate = true, error = '', onChange, onRemove, onRegenerate }) => {
  const { t } = useTranslation();
  const frontMissing = card.touched && !card.front.trim();
  const backMissing = card.touched && !card.back.trim();

  return (
    <li className="fc-editor-row">
      <div className="fc-editor-head">
        <strong>{t('flashcards.create.cardN', { n: index + 1 })}</strong>
        <div className="fc-editor-actions">
          {canRegenerate && (
            <button type="button" className="outline-btn dash-small-btn" onClick={onRegenerate} disabled={busy}>
              {busy ? t('flashcards.create.regenerating') : t('flashcards.create.regenerate')}
            </button>
          )}
          <button type="button" className="outline-btn dash-small-btn fc-danger-outline" onClick={onRemove} disabled={busy} aria-label={t('flashcards.create.removeCardN', { n: index + 1 })}>
            {t('flashcards.create.remove')}
          </button>
        </div>
      </div>
      <div className="fc-editor-fields">
        <label className="fc-field">
          <span>{t('flashcards.create.front')}</span>
          <textarea
            rows={2}
            value={card.front}
            maxLength={FLASHCARD_LIMITS.FRONT}
            aria-invalid={frontMissing}
            disabled={busy}
            onChange={(e) => onChange({ front: e.target.value, touched: true })}
          />
        </label>
        <label className="fc-field">
          <span>{t('flashcards.create.back')}</span>
          <textarea
            rows={3}
            value={card.back}
            maxLength={FLASHCARD_LIMITS.BACK}
            aria-invalid={backMissing}
            disabled={busy}
            onChange={(e) => onChange({ back: e.target.value, touched: true })}
          />
        </label>
      </div>
      {(frontMissing || backMissing) && <p className="error-text" role="alert">{t('flashcards.create.cardInvalid')}</p>}
      {error && <p className="error-text" role="alert">{error}</p>}
    </li>
  );
};

export default CardEditorRow;
