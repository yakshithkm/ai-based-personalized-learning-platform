import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/admin/ConfirmDialog';
import DeckCard from '../components/flashcards/DeckCard';
import RenameDeckModal from '../components/flashcards/RenameDeckModal';
import { useToast } from '../context/ToastContext';
import { deleteDeck, getSummary, listDecks, updateDeck } from '../api/flashcards';
import { flashcardError, useDebouncedValue } from '../utils/flashcards';

const SORTS = ['recent', 'studied', 'title'];

const FlashcardsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [renaming, setRenaming] = useState(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const requestId = useRef(0);

  // A changed filter always goes back to page 1.
  useEffect(() => { setPage(1); }, [debouncedSearch, topic, sort]);

  useEffect(() => {
    const id = (requestId.current += 1);
    setLoading(true);
    setError('');
    listDecks({ search: debouncedSearch || undefined, topic: topic || undefined, sort, page })
      .then((result) => {
        if (id !== requestId.current) return;
        // The page may no longer exist after a delete - step back instead of showing nothing.
        if (result.decks.length === 0 && result.total > 0 && page > 1) {
          setPage(result.totalPages);
          return;
        }
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        setError(flashcardError(t, err, 'flashcards.errors.loadFailed'));
        setLoading(false);
      });
  }, [debouncedSearch, topic, sort, page, reloadKey, t]);

  const refreshSummary = useCallback(() => {
    getSummary().then(setSummary).catch(() => setSummary(null));
  }, []);
  useEffect(() => { refreshSummary(); }, [refreshSummary, reloadKey]);

  const retry = () => setReloadKey((key) => key + 1);
  const clearFilters = () => { setSearch(''); setTopic(''); setSort('recent'); };

  const saveRename = async (title) => {
    setRenameBusy(true);
    setRenameError('');
    try {
      const result = await updateDeck(renaming.id, { title });
      setData((prev) => prev && { ...prev, decks: prev.decks.map((d) => (d.id === renaming.id ? { ...d, title: result.deck.title } : d)) });
      setRenaming(null);
      showToast(t('flashcards.toast.renamed'));
    } catch (err) {
      setRenameError(flashcardError(t, err, 'flashcards.errors.saveFailed'));
    } finally {
      setRenameBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteDeck(deleting.id);
      showToast(t('flashcards.toast.deleted'));
      setDeleting(null);
      retry();
    } catch (err) {
      showToast(flashcardError(t, err, 'flashcards.errors.deleteFailed'), { type: 'error' });
    } finally {
      setDeleteBusy(false);
    }
  };

  const filtersActive = Boolean(debouncedSearch || topic);
  const decks = data?.decks || [];
  const hasAnyDeck = (summary?.decks || 0) > 0 || decks.length > 0 || filtersActive;

  return (
    <div className="page-grid">
      <section className="panel fc-page-head">
        <div>
          <h2>{t('navigation.flashcards')}</h2>
          <p>{t('flashcards.intro')}</p>
        </div>
        <Link className="solid-btn" to="/flashcards/create">{t('flashcards.createDeck')}</Link>
      </section>

      {summary && summary.decks > 0 && (
        <section className="panel fc-stats" aria-label={t('flashcards.stats.label')}>
          <div><strong>{summary.decks}</strong><span>{t('flashcards.stats.decks')}</span></div>
          <div><strong>{summary.totalCards}</strong><span>{t('flashcards.stats.cards')}</span></div>
          <div><strong>{summary.dueCards}</strong><span>{t('flashcards.stats.due')}</span></div>
          <div><strong>{summary.difficultCards}</strong><span>{t('flashcards.stats.difficult')}</span></div>
        </section>
      )}

      {hasAnyDeck && (
        <section className="panel fc-filters" aria-label={t('flashcards.filters.label')}>
          <label className="fc-field fc-field-grow">
            <span>{t('flashcards.filters.search')}</span>
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('flashcards.filters.searchPlaceholder')} maxLength={80} />
          </label>
          <label className="fc-field">
            <span>{t('flashcards.filters.topic')}</span>
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">{t('flashcards.filters.allTopics')}</option>
              {(data?.topics || []).map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="fc-field">
            <span>{t('flashcards.filters.sort')}</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map((key) => <option key={key} value={key}>{t(`flashcards.filters.sort_${key}`)}</option>)}
            </select>
          </label>
        </section>
      )}

      {loading && !data && !error && (
        <section className="fc-grid" aria-busy="true" aria-label={t('flashcards.loading')}>
          {[0, 1, 2].map((i) => (
            <div className="panel" key={i}>
              <div className="skeleton-chip" style={{ width: '60%', marginBottom: '0.7rem' }} />
              <div className="skeleton-block" style={{ minHeight: '110px' }} />
            </div>
          ))}
        </section>
      )}

      {error && (
        <section className="panel error-state-card" role="alert">
          <h3>{t('flashcards.errors.couldntLoad')}</h3>
          <p>{error}</p>
          <button type="button" className="solid-btn" onClick={retry}>{t('common.tryAgain')}</button>
        </section>
      )}

      {!error && data && decks.length === 0 && (
        filtersActive ? (
          <EmptyState
            icon="practice"
            title={t('flashcards.noResults.title')}
            description={t('flashcards.noResults.text')}
            actionLabel={t('flashcards.filters.clear')}
            onAction={clearFilters}
          />
        ) : (
          <EmptyState
            icon="practice"
            title={t('flashcards.empty.title')}
            description={t('flashcards.empty.text')}
            actionLabel={t('flashcards.createDeck')}
            onAction={() => navigate('/flashcards/create')}
          />
        )
      )}

      {!error && decks.length > 0 && (
        <>
          <section className="fc-grid" aria-busy={loading} aria-label={t('flashcards.deck.listLabel')}>
            {decks.map((deck) => (
              <DeckCard key={deck.id} deck={deck} onRename={(d) => { setRenameError(''); setRenaming(d); }} onDelete={setDeleting} />
            ))}
          </section>
          {data.totalPages > 1 && (
            <nav className="fc-pagination" aria-label={t('flashcards.pagination.label')}>
              <button type="button" className="outline-btn" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>{t('flashcards.pagination.previous')}</button>
              <span>{t('flashcards.pagination.pageOf', { page: data.page, total: data.totalPages })}</span>
              <button type="button" className="outline-btn" disabled={page >= data.totalPages || loading} onClick={() => setPage((p) => p + 1)}>{t('flashcards.pagination.next')}</button>
            </nav>
          )}
        </>
      )}

      <RenameDeckModal open={Boolean(renaming)} deck={renaming} busy={renameBusy} error={renameError} onSave={saveRename} onCancel={() => setRenaming(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        centered
        title={t('flashcards.delete.title')}
        message={deleting ? t('flashcards.delete.message', { title: deleting.title, count: deleting.stats.totalCards }) : ''}
        confirmLabel={t('flashcards.delete.confirm')}
        cancelLabel={t('flashcards.cancel')}
        busyLabel={t('flashcards.deleting')}
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => !deleteBusy && setDeleting(null)}
      />
    </div>
  );
};

export default FlashcardsPage;
