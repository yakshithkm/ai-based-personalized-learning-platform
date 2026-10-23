import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../components/admin/ConfirmDialog';
import FlipCard from '../components/flashcards/FlipCard';
import { completeSession, recordAnswer, shuffleSession, startSession } from '../api/flashcards';
import { emitGamificationEvent } from '../utils/appEvents';
import { flashcardError, isActivatableTarget, isTypingTarget } from '../utils/flashcards';

const MODES = ['all', 'due', 'difficult'];

const firstUnanswered = (cards, answers, from = 0) => {
  for (let i = from; i < cards.length; i += 1) if (!answers[cards[i].id]) return i;
  for (let i = 0; i < from; i += 1) if (!answers[cards[i].id]) return i;
  return -1;
};

const FlashcardStudyPage = () => {
  const { t } = useTranslation();
  const { deckId } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rawMode = params.get('mode');
  const mode = MODES.includes(rawMode) ? rawMode : 'all';
  const wantShuffle = params.get('shuffle') === '1';

  const [phase, setPhase] = useState('loading'); // loading | error | studying | summary
  const [loadError, setLoadError] = useState({ message: '', kind: 'generic' });
  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [summary, setSummary] = useState(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [resumedNotice, setResumedNotice] = useState(false);

  const mountedRef = useRef(true);
  const startedKeyRef = useRef('');
  const busyRef = useRef(false);

  const applySession = useCallback((next, { resumed = false } = {}) => {
    const first = firstUnanswered(next.cards, next.answers);
    setSession(next);
    setAnswers(next.answers || {});
    setIndex(first === -1 ? 0 : first);
    setFlipped(false);
    setRevealed(false);
    setActionError('');
    setSummary(null);
    setResumedNotice(resumed && Object.keys(next.answers || {}).length > 0);
    setPhase('studying');
  }, []);

  const begin = useCallback(async ({ restart = false, shuffle = wantShuffle, forMode = mode } = {}) => {
    setPhase('loading');
    try {
      const result = await startSession(deckId, { mode: forMode, shuffle, restart });
      if (!mountedRef.current) return;
      applySession(result.session, { resumed: result.resumed });
    } catch (err) {
      if (!mountedRef.current) return;
      const status = err?.response?.status;
      setLoadError({
        kind: status === 404 ? 'notFound' : status === 409 ? 'empty' : 'generic',
        message: flashcardError(t, err, 'flashcards.errors.loadFailed'),
      });
      setPhase('error');
    }
  }, [deckId, mode, wantShuffle, applySession, t]);

  // One start per (deck, mode, shuffle). Refs survive React StrictMode's dev double-effect, so a
  // refresh or remount resumes the same server session instead of creating a second one.
  useEffect(() => {
    mountedRef.current = true;
    const key = `${deckId}|${mode}|${wantShuffle}`;
    if (startedKeyRef.current !== key) {
      startedKeyRef.current = key;
      begin();
    }
    return () => { mountedRef.current = false; };
  }, [deckId, mode, wantShuffle, begin]);

  const cards = session?.cards || [];
  const card = cards[index];
  const answeredCount = cards.filter((c) => answers[c.id]).length;

  const go = useCallback((delta) => {
    setIndex((i) => Math.min(cards.length - 1, Math.max(0, i + delta)));
    setFlipped(false);
    setRevealed(false);
  }, [cards.length]);

  const flip = useCallback(() => {
    setFlipped((f) => !f);
    setRevealed(true);
  }, []);

  const finish = useCallback(async () => {
    if (!session || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setActionError('');
    try {
      const result = await completeSession(session.id);
      if (!mountedRef.current) return;
      emitGamificationEvent(result.gamification);
      setSummary(result.summary);
      setPhase('summary');
    } catch (err) {
      if (mountedRef.current) setActionError(flashcardError(t, err, 'flashcards.errors.finishFailed'));
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }, [session, t]);

  const rate = useCallback(async (outcome) => {
    if (!session || !card || busyRef.current || !revealed) return;
    busyRef.current = true;
    setBusy(true);
    setActionError('');
    try {
      await recordAnswer(session.id, card.id, outcome);
      if (!mountedRef.current) return;
      const nextAnswers = { ...answers, [card.id]: outcome };
      setAnswers(nextAnswers);
      const next = firstUnanswered(cards, nextAnswers, index + 1);
      busyRef.current = false;
      if (next === -1) {
        setBusy(false);
        await finish();
      } else {
        setIndex(next);
        setFlipped(false);
        setRevealed(false);
        setBusy(false);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      // The answer was NOT saved: stay on the card so the student can retry.
      setActionError(flashcardError(t, err, 'flashcards.errors.answerFailed'));
      busyRef.current = false;
      setBusy(false);
    }
  }, [session, card, revealed, answers, cards, index, finish, t]);

  const shuffle = async () => {
    if (!session || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await shuffleSession(session.id);
      if (mountedRef.current) applySession(result.session);
    } catch (err) {
      if (mountedRef.current) setActionError(flashcardError(t, err, 'flashcards.errors.generic'));
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const restart = async () => {
    setConfirmRestart(false);
    await begin({ restart: true });
  };

  // Keyboard: arrows move, Space/Enter flip. Never while typing, and never steal Space/Enter from
  // a focused button/link (the card itself is a button and flips natively).
  useEffect(() => {
    if (phase !== 'studying' || confirmRestart) return undefined;
    const onKey = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
      else if ((event.key === ' ' || event.key === 'Enter') && !isActivatableTarget(event.target)) { event.preventDefault(); flip(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase, confirmRestart, go, flip]);

  const backToDeck = () => navigate(`/flashcards/${deckId}`);

  if (phase === 'loading') {
    return (
      <div className="page-grid">
        <section className="panel" aria-busy="true" aria-label={t('flashcards.study.starting')}>
          <div className="skeleton-chip" style={{ width: '200px', marginBottom: '0.8rem' }} />
          <div className="skeleton-block" style={{ minHeight: '280px' }} />
        </section>
      </div>
    );
  }

  if (phase === 'error') {
    const text = loadError.kind === 'empty'
      ? t(mode === 'due' ? 'flashcards.study.noDue' : mode === 'difficult' ? 'flashcards.study.noDifficult' : 'flashcards.study.emptyDeck')
      : loadError.kind === 'notFound' ? t('flashcards.deckPage.notFoundText') : loadError.message;
    return (
      <div className="page-grid">
        <section className="panel error-state-card" role="alert">
          <h3>{loadError.kind === 'empty' ? t('flashcards.study.nothingToStudy') : t('flashcards.study.couldntStart')}</h3>
          <p>{text}</p>
          <div className="fc-form-actions">
            {loadError.kind === 'generic' && <button type="button" className="solid-btn" onClick={() => begin()}>{t('common.tryAgain')}</button>}
            <Link className={loadError.kind === 'generic' ? 'outline-btn' : 'solid-btn'} to={loadError.kind === 'notFound' ? '/flashcards' : `/flashcards/${deckId}`}>
              {loadError.kind === 'notFound' ? t('flashcards.backToDecks') : t('flashcards.study.backToDeck')}
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (phase === 'summary' && summary) {
    const none = summary.reviewed === 0;
    return (
      <div className="page-grid">
        <section className="panel fc-summary" aria-live="polite">
          <p className="eyebrow-label">{t('flashcards.summary.eyebrow')}</p>
          <h2>{none ? t('flashcards.summary.noneTitle') : t('flashcards.summary.title')}</h2>
          {none ? (
            <p>{t('flashcards.summary.noneText')}</p>
          ) : (
            <>
              <div className="fc-stats fc-stats-inline">
                <div><strong>{summary.reviewed}</strong><span>{t('flashcards.summary.reviewed')}</span></div>
                <div><strong>{summary.known}</strong><span>{t('flashcards.summary.known')}</span></div>
                <div><strong>{summary.needReview}</strong><span>{t('flashcards.summary.needReview')}</span></div>
                <div><strong>{summary.accuracy}%</strong><span>{t('flashcards.summary.accuracy')}</span></div>
              </div>
              {summary.unreviewed > 0 && <p className="fc-notice">{t('flashcards.summary.unreviewed', { count: summary.unreviewed })}</p>}
              {summary.missedCards.length > 0 && (
                <div className="fc-missed">
                  <h3>{t('flashcards.summary.missedHeading')}</h3>
                  <ul>{summary.missedCards.map((m) => <li key={m.id}>{m.front}</li>)}</ul>
                </div>
              )}
            </>
          )}
          <div className="fc-form-actions">
            {summary.deckStats.difficultCards > 0 && (
              <Link className="solid-btn" to={`/flashcards/${deckId}/study?mode=difficult`} onClick={() => { startedKeyRef.current = ''; }}>
                {t('flashcards.summary.practiceDifficult', { count: summary.deckStats.difficultCards })}
              </Link>
            )}
            <button type="button" className={summary.deckStats.difficultCards > 0 ? 'outline-btn' : 'solid-btn'} onClick={() => begin({ restart: true })}>{t('flashcards.summary.studyAgain')}</button>
            <Link className="outline-btn" to={`/flashcards/${deckId}`}>{t('flashcards.study.backToDeck')}</Link>
          </div>
        </section>
      </div>
    );
  }

  if (!card) return null;
  const currentAnswer = answers[card.id];

  return (
    <div className="page-grid">
      <section className="panel fc-study">
        <header className="fc-study-head">
          <button type="button" className="outline-btn dash-small-btn" onClick={backToDeck}>← {t('flashcards.study.exit')}</button>
          <span className="fc-study-count" aria-live="polite">{t('flashcards.study.cardOf', { current: index + 1, total: cards.length })}</span>
        </header>

        <div className="fc-progress" role="progressbar" aria-valuemin={0} aria-valuemax={cards.length} aria-valuenow={answeredCount} aria-label={t('flashcards.study.progress', { done: answeredCount, total: cards.length })}>
          <div className="fc-progress-bar"><span style={{ width: `${cards.length ? (answeredCount / cards.length) * 100 : 0}%` }} /></div>
          <small>{t('flashcards.study.progress', { done: answeredCount, total: cards.length })}</small>
        </div>

        {resumedNotice && <p className="fc-notice" role="status">{t('flashcards.study.resumed')}</p>}

        <FlipCard front={card.front} back={card.back} flipped={flipped} onFlip={flip} />

        {currentAnswer && (
          <p className="fc-rated" role="status">{currentAnswer === 'known' ? t('flashcards.study.ratedKnown') : t('flashcards.study.ratedReview')}</p>
        )}

        {/* Rating first (flip -> rate -> move on), navigation second: the DOM order is the visual order. */}
        <div className="fc-study-controls">
          <button type="button" className="outline-btn fc-btn-review" onClick={() => rate('review')} disabled={!revealed || busy} aria-pressed={currentAnswer === 'review'}>{t('flashcards.study.needReview')}</button>
          <button type="button" className="outline-btn fc-btn-know" onClick={() => rate('known')} disabled={!revealed || busy} aria-pressed={currentAnswer === 'known'}>{t('flashcards.study.know')}</button>
          <button type="button" className="outline-btn" onClick={() => go(-1)} disabled={index === 0 || busy}>{t('flashcards.study.previous')}</button>
          <button type="button" className="outline-btn" onClick={() => go(1)} disabled={index === cards.length - 1 || busy}>{t('flashcards.study.next')}</button>
        </div>
        {!revealed && <p className="fc-notice">{t('flashcards.study.flipFirst')}</p>}

        {actionError && (
          <div className="fc-inline-error" role="alert">
            <span>{actionError}</span>
          </div>
        )}

        <div className="fc-study-secondary">
          <button type="button" className="outline-btn dash-small-btn" onClick={shuffle} disabled={busy}>{t('flashcards.study.shuffle')}</button>
          <button type="button" className="outline-btn dash-small-btn" onClick={() => (answeredCount > 0 ? setConfirmRestart(true) : restart())} disabled={busy}>{t('flashcards.study.restart')}</button>
          <button type="button" className="outline-btn dash-small-btn" onClick={finish} disabled={busy}>{t('flashcards.study.finish')}</button>
        </div>
        <p className="fc-shortcuts">{t('flashcards.study.shortcuts')}</p>
      </section>

      <ConfirmDialog
        open={confirmRestart}
        centered
        title={t('flashcards.study.restartTitle')}
        message={t('flashcards.study.restartMessage')}
        confirmLabel={t('flashcards.study.restart')}
        cancelLabel={t('flashcards.cancel')}
        danger={false}
        onConfirm={restart}
        onCancel={() => setConfirmRestart(false)}
      />
    </div>
  );
};

export default FlashcardStudyPage;
