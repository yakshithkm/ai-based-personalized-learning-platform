import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../components/admin/ConfirmDialog';
import RenameDeckModal from '../components/flashcards/RenameDeckModal';
import { useToast } from '../context/ToastContext';
import {
  addCard, deleteCard, deleteDeck, getDeck, getHistory, reorderCards, updateCard, updateDeck,
} from '../api/flashcards';
import { formatRelativeTime } from '../utils/achievements';
import { daysUntil, flashcardError, formatDate, FLASHCARD_LIMITS } from '../utils/flashcards';

const CARD_CAP = 100;

const statusOf = (progress) => {
  if (!progress || progress.isNew) return 'new';
  return progress.lastOutcome === 'known' ? 'known' : 'review';
};

const FlashcardDeckPage = () => {
  const { t, i18n } = useTranslation();
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [state, setState] = useState({ loading: true, error: '', notFound: false, deck: null, cards: [], activeSession: null });
  const [history, setHistory] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [editing, setEditing] = useState(null); // { id, front, back }
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');
  const [newCard, setNewCard] = useState({ front: '', back: '' });
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState('');
  const [deletingDeck, setDeletingDeck] = useState(false);
  const [deletingCard, setDeletingCard] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: prev.deck === null, error: '', notFound: false }));
    Promise.all([getDeck(deckId), getHistory(deckId).catch(() => ({ sessions: [] }))])
      .then(([detail, hist]) => {
        if (cancelled) return;
        setState({ loading: false, error: '', notFound: false, deck: detail.deck, cards: detail.cards, activeSession: detail.activeSession });
        setHistory(hist.sessions || []);
      })
      .catch((err) => {
        if (cancelled) return;
        const notFound = err?.response?.status === 404 || err?.response?.status === 400;
        setState((prev) => ({ ...prev, loading: false, notFound, error: notFound ? '' : flashcardError(t, err, 'flashcards.errors.loadFailed') }));
      });
    return () => { cancelled = true; };
  }, [deckId, reloadKey, t]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const { deck, cards, activeSession } = state;

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editing || editBusy) return;
    if (!editing.front.trim() || !editing.back.trim()) { setEditError(t('flashcards.create.cardInvalid')); return; }
    setEditBusy(true);
    setEditError('');
    try {
      const result = await updateCard(deckId, editing.id, { front: editing.front, back: editing.back });
      setState((prev) => ({ ...prev, cards: prev.cards.map((c) => (c.id === editing.id ? result.card : c)) }));
      setEditing(null);
      showToast(t('flashcards.toast.cardSaved'));
    } catch (err) {
      setEditError(flashcardError(t, err, 'flashcards.errors.saveFailed'));
    } finally {
      setEditBusy(false);
    }
  };

  const submitNewCard = async (event) => {
    event.preventDefault();
    if (addBusy) return;
    if (!newCard.front.trim() || !newCard.back.trim()) { setAddError(t('flashcards.create.cardInvalid')); return; }
    setAddBusy(true);
    setAddError('');
    try {
      await addCard(deckId, newCard);
      setNewCard({ front: '', back: '' });
      showToast(t('flashcards.toast.cardAdded'));
      reload();
    } catch (err) {
      setAddError(flashcardError(t, err, 'flashcards.errors.saveFailed'));
    } finally {
      setAddBusy(false);
    }
  };

  const confirmDeleteCard = async () => {
    if (!deletingCard || busy) return;
    setBusy(true);
    try {
      await deleteCard(deckId, deletingCard.id);
      setDeletingCard(null);
      showToast(t('flashcards.toast.cardDeleted'));
      reload();
    } catch (err) {
      showToast(flashcardError(t, err, 'flashcards.errors.deleteFailed'), { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteDeck = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteDeck(deckId);
      showToast(t('flashcards.toast.deleted'));
      navigate('/flashcards', { replace: true });
    } catch (err) {
      showToast(flashcardError(t, err, 'flashcards.errors.deleteFailed'), { type: 'error' });
      setBusy(false);
    }
  };

  const saveRename = async (title) => {
    setRenameBusy(true);
    setRenameError('');
    try {
      const result = await updateDeck(deckId, { title });
      setState((prev) => ({ ...prev, deck: { ...prev.deck, title: result.deck.title } }));
      setRenaming(false);
      showToast(t('flashcards.toast.renamed'));
    } catch (err) {
      setRenameError(flashcardError(t, err, 'flashcards.errors.saveFailed'));
    } finally {
      setRenameBusy(false);
    }
  };

  const move = async (index, delta) => {
    const target = index + delta;
    if (busy || target < 0 || target >= cards.length) return;
    const next = [...cards];
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    setState((prev) => ({ ...prev, cards: next }));
    try {
      await reorderCards(deckId, next.map((c) => c.id));
    } catch (err) {
      setState((prev) => ({ ...prev, cards }));
      showToast(flashcardError(t, err, 'flashcards.errors.saveFailed'), { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (state.loading) {
    return (
      <div className="page-grid">
        <section className="panel" aria-busy="true" aria-label={t('flashcards.loading')}>
          <div className="skeleton-chip" style={{ width: '220px', marginBottom: '0.8rem' }} />
          <div className="skeleton-block" style={{ minHeight: '260px' }} />
        </section>
      </div>
    );
  }

  if (state.notFound) {
    return (
      <div className="page-grid">
        <section className="panel error-state-card">
          <h3>{t('flashcards.deckPage.notFoundTitle')}</h3>
          <p>{t('flashcards.deckPage.notFoundText')}</p>
          <Link className="solid-btn" to="/flashcards">{t('flashcards.backToDecks')}</Link>
        </section>
      </div>
    );
  }

  if (state.error && !deck) {
    return (
      <div className="page-grid">
        <section className="panel error-state-card" role="alert">
          <h3>{t('flashcards.errors.couldntLoad')}</h3>
          <p>{state.error}</p>
          <button type="button" className="solid-btn" onClick={reload}>{t('common.tryAgain')}</button>
        </section>
      </div>
    );
  }

  const s = deck.stats;
  const hasCards = cards.length > 0;
  const studyLink = (mode) => `/flashcards/${deckId}/study?mode=${mode}`;

  return (
    <div className="page-grid">
      <section className="panel fc-deck-header">
        <Link className="lr-back" to="/flashcards">← {t('flashcards.backToDecks')}</Link>
        <div className="fc-deck-header-row">
          <div>
            <h2>{deck.title}</h2>
            <p className="fc-deck-meta">
              {[deck.topic, deck.difficulty && t(`flashcards.difficulty.${deck.difficulty}`), deck.cardStyle && t(`flashcards.style.${deck.cardStyle}`)].filter(Boolean).join(' • ')}
            </p>
            <p className="fc-deck-meta">
              {t('flashcards.deck.created', { date: formatDate(i18n.language, deck.createdAt) })}
              {' • '}
              {deck.lastStudiedAt ? t('flashcards.deck.studied', { when: formatRelativeTime(deck.lastStudiedAt, t) }) : t('flashcards.deck.neverStudied')}
            </p>
          </div>
          <div className="fc-deck-header-actions">
            <button type="button" className="outline-btn" onClick={() => { setRenameError(''); setRenaming(true); }}>{t('flashcards.actions.rename')}</button>
            <button type="button" className="outline-btn fc-danger-outline" onClick={() => setDeletingDeck(true)}>{t('flashcards.actions.delete')}</button>
          </div>
        </div>

        <div className="fc-stats fc-stats-inline" aria-label={t('flashcards.deckPage.progress')}>
          <div><strong>{s.totalCards}</strong><span>{t('flashcards.deckPage.statTotal')}</span></div>
          <div><strong>{s.knownCards}</strong><span>{t('flashcards.deckPage.statKnown')}</span></div>
          <div><strong>{s.needReviewCards}</strong><span>{t('flashcards.deckPage.statReview')}</span></div>
          <div><strong>{s.newCards}</strong><span>{t('flashcards.deckPage.statNew')}</span></div>
          <div><strong>{s.dueCards}</strong><span>{t('flashcards.deckPage.statDue')}</span></div>
        </div>

        <div className="fc-study-actions">
          {activeSession && (
            <Link className="solid-btn" to={studyLink(activeSession.mode)}>
              {t('flashcards.deckPage.resume', { answered: activeSession.answered, total: activeSession.total })}
            </Link>
          )}
          <Link className={activeSession ? 'outline-btn' : 'solid-btn'} to={studyLink('all')} aria-disabled={!hasCards} onClick={(e) => !hasCards && e.preventDefault()}>
            {t('flashcards.deckPage.studyAll')}
          </Link>
          <Link className="outline-btn" to={studyLink('due')} aria-disabled={!hasCards || s.dueCards === 0} onClick={(e) => (!hasCards || s.dueCards === 0) && e.preventDefault()}>
            {t('flashcards.deckPage.studyDue', { count: s.dueCards })}
          </Link>
          <Link className="outline-btn" to={studyLink('difficult')} aria-disabled={s.difficultCards === 0} onClick={(e) => s.difficultCards === 0 && e.preventDefault()}>
            {t('flashcards.deckPage.studyDifficult', { count: s.difficultCards })}
          </Link>
        </div>
        <p className="fc-notice">{t('flashcards.deckPage.srsNote')}</p>
      </section>

      <section className="panel">
        <h3>{t('flashcards.deckPage.cardsHeading', { count: cards.length })}</h3>
        {!hasCards && <p className="fc-notice">{t('flashcards.deckPage.noCards')}</p>}
        <ol className="fc-card-list">
          {cards.map((card, index) => {
            const status = statusOf(card.progress);
            const isEditing = editing?.id === card.id;
            return (
              <li key={card.id} className="fc-card-row">
                {isEditing ? (
                  <form className="fc-edit-form" onSubmit={saveEdit}>
                    <label className="fc-field">
                      <span>{t('flashcards.create.front')}</span>
                      <textarea rows={2} maxLength={FLASHCARD_LIMITS.FRONT} value={editing.front} onChange={(e) => setEditing({ ...editing, front: e.target.value })} />
                    </label>
                    <label className="fc-field">
                      <span>{t('flashcards.create.back')}</span>
                      <textarea rows={3} maxLength={FLASHCARD_LIMITS.BACK} value={editing.back} onChange={(e) => setEditing({ ...editing, back: e.target.value })} />
                    </label>
                    {editError && <p className="error-text" role="alert">{editError}</p>}
                    <div className="fc-form-actions">
                      <button type="submit" className="solid-btn" disabled={editBusy}>{editBusy ? t('flashcards.saving') : t('flashcards.save')}</button>
                      <button type="button" className="outline-btn" onClick={() => { setEditing(null); setEditError(''); }} disabled={editBusy}>{t('flashcards.cancel')}</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="fc-card-body">
                      <p className="fc-card-front"><span className="fc-card-index">{index + 1}.</span> {card.front}</p>
                      <p className="fc-card-back">{card.back}</p>
                      <p className="fc-card-meta">
                        <span className={`fc-status fc-status-${status}`}>{t(`flashcards.deckPage.status_${status}`)}</span>
                        {status !== 'new' && card.progress.isDue && <span className="fc-due-badge">{t('flashcards.deckPage.dueNow')}</span>}
                        {status === 'known' && !card.progress.isDue && (
                          <span>{t('flashcards.deckPage.dueIn', { count: daysUntil(card.progress.nextReviewAt) })}</span>
                        )}
                        {card.progress.reviewCount > 0 && <span>{t('flashcards.deckPage.reviewedTimes', { count: card.progress.reviewCount })}</span>}
                      </p>
                    </div>
                    <div className="fc-card-actions">
                      <button type="button" className="outline-btn dash-small-btn" onClick={() => move(index, -1)} disabled={busy || index === 0} aria-label={t('flashcards.deckPage.moveUp')}>↑</button>
                      <button type="button" className="outline-btn dash-small-btn" onClick={() => move(index, 1)} disabled={busy || index === cards.length - 1} aria-label={t('flashcards.deckPage.moveDown')}>↓</button>
                      <button type="button" className="outline-btn dash-small-btn" onClick={() => { setEditError(''); setEditing({ id: card.id, front: card.front, back: card.back }); }}>{t('flashcards.actions.edit')}</button>
                      <button type="button" className="outline-btn dash-small-btn fc-danger-outline" onClick={() => setDeletingCard(card)}>{t('flashcards.actions.delete')}</button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ol>

        {cards.length < CARD_CAP ? (
          <form className="fc-add-form" onSubmit={submitNewCard}>
            <h4>{t('flashcards.deckPage.addHeading')}</h4>
            <div className="fc-editor-fields">
              <label className="fc-field">
                <span>{t('flashcards.create.front')}</span>
                <textarea rows={2} maxLength={FLASHCARD_LIMITS.FRONT} value={newCard.front} onChange={(e) => setNewCard({ ...newCard, front: e.target.value })} />
              </label>
              <label className="fc-field">
                <span>{t('flashcards.create.back')}</span>
                <textarea rows={2} maxLength={FLASHCARD_LIMITS.BACK} value={newCard.back} onChange={(e) => setNewCard({ ...newCard, back: e.target.value })} />
              </label>
            </div>
            {addError && <p className="error-text" role="alert">{addError}</p>}
            <button type="submit" className="outline-btn" disabled={addBusy}>{addBusy ? t('flashcards.saving') : t('flashcards.create.addCard')}</button>
          </form>
        ) : (
          <p className="fc-notice">{t('flashcards.deckPage.cardLimit', { count: CARD_CAP })}</p>
        )}
      </section>

      <section className="panel">
        <h3>{t('flashcards.deckPage.historyHeading')}</h3>
        {history.length === 0 ? (
          <p className="fc-notice">{t('flashcards.deckPage.historyEmpty')}</p>
        ) : (
          <ul className="fc-history">
            {history.map((row) => (
              <li key={row.id}>
                <strong>{formatDate(i18n.language, row.completedAt || row.startedAt)}</strong>
                <span>{t(`flashcards.mode.${row.mode}`)}</span>
                <span>{t('flashcards.deckPage.historyRow', { reviewed: row.reviewed, known: row.known, needReview: row.needReview })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RenameDeckModal open={renaming} deck={deck} busy={renameBusy} error={renameError} onSave={saveRename} onCancel={() => setRenaming(false)} />
      <ConfirmDialog
        open={deletingDeck}
        centered
        title={t('flashcards.delete.title')}
        message={t('flashcards.delete.message', { title: deck.title, count: s.totalCards })}
        confirmLabel={t('flashcards.delete.confirm')}
        cancelLabel={t('flashcards.cancel')}
        busyLabel={t('flashcards.deleting')}
        busy={busy}
        onConfirm={confirmDeleteDeck}
        onCancel={() => !busy && setDeletingDeck(false)}
      />
      <ConfirmDialog
        open={Boolean(deletingCard)}
        centered
        title={t('flashcards.deckPage.deleteCardTitle')}
        message={t('flashcards.deckPage.deleteCardMessage')}
        confirmLabel={t('flashcards.delete.confirm')}
        cancelLabel={t('flashcards.cancel')}
        busyLabel={t('flashcards.deleting')}
        busy={busy}
        onConfirm={confirmDeleteCard}
        onCancel={() => !busy && setDeletingCard(null)}
      />
    </div>
  );
};

export default FlashcardDeckPage;
