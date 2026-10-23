import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatRelativeTime } from '../../utils/achievements';
import { formatDate } from '../../utils/flashcards';

// One saved deck. Everything shown (counts, progress, dates) comes from stored data - progress
// only appears once at least one card has actually been reviewed.
const DeckCard = ({ deck, onRename, onDelete }) => {
  const { t, i18n } = useTranslation();
  const s = deck.stats;
  const hasCards = s.totalCards > 0;
  const percentKnown = s.totalCards ? Math.round((s.knownCards / s.totalCards) * 100) : 0;

  return (
    <article className="panel fc-deck-card" aria-label={deck.title}>
      <header className="fc-deck-head">
        <h3 className="fc-deck-title"><Link to={`/flashcards/${deck.id}`}>{deck.title}</Link></h3>
        <div className="fc-deck-tags">
          {deck.topic && <span className="chip">{deck.topic}</span>}
          {deck.difficulty && <span className="chip">{t(`flashcards.difficulty.${deck.difficulty}`)}</span>}
        </div>
      </header>

      <p className="fc-deck-meta">
        {t('flashcards.deck.cardCount', { count: s.totalCards })}
        {' • '}
        {t('flashcards.deck.created', { date: formatDate(i18n.language, deck.createdAt) })}
      </p>
      <p className="fc-deck-meta">
        {deck.lastStudiedAt
          ? t('flashcards.deck.studied', { when: formatRelativeTime(deck.lastStudiedAt, t) })
          : t('flashcards.deck.neverStudied')}
        {hasCards && s.dueCards > 0 && <span className="fc-due-badge">{t('flashcards.deck.dueCount', { count: s.dueCards })}</span>}
      </p>

      {s.reviewedCards > 0 && (
        <div className="fc-progress" role="img" aria-label={t('flashcards.deck.knownProgress', { known: s.knownCards, total: s.totalCards })}>
          <div className="fc-progress-bar"><span style={{ width: `${percentKnown}%` }} /></div>
          <small>{t('flashcards.deck.knownProgress', { known: s.knownCards, total: s.totalCards })}</small>
        </div>
      )}

      <div className="fc-deck-actions">
        {hasCards ? (
          <Link className="solid-btn" to={`/flashcards/${deck.id}/study`}>{t('flashcards.actions.study')}</Link>
        ) : (
          <button type="button" className="solid-btn" disabled title={t('flashcards.deck.noCardsHint')}>{t('flashcards.actions.study')}</button>
        )}
        <Link className="outline-btn" to={`/flashcards/${deck.id}`}>{t('flashcards.actions.edit')}</Link>
        <button type="button" className="outline-btn" onClick={() => onRename(deck)}>{t('flashcards.actions.rename')}</button>
        <button type="button" className="outline-btn fc-danger-outline" onClick={() => onDelete(deck)}>{t('flashcards.actions.delete')}</button>
      </div>
    </article>
  );
};

export default DeckCard;
