import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../components/admin/ConfirmDialog';
import CardEditorRow from '../components/flashcards/CardEditorRow';
import { useToast } from '../context/ToastContext';
import { createDeck, generateCards } from '../api/flashcards';
import { isTierError } from '../utils/tierErrors';
import { CARD_STYLES, DIFFICULTIES, FLASHCARD_LIMITS, flashcardError } from '../utils/flashcards';

let rowId = 0;
const newRow = (card = {}) => ({ key: (rowId += 1), front: card.front || '', back: card.back || '', touched: false });

const FlashcardCreatePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { showToast } = useToast();

  const lessonId = params.get('content') || '';
  const lessonTitle = location.state?.lessonTitle || '';
  const [useLesson, setUseLesson] = useState(Boolean(lessonId));

  const [topic, setTopic] = useState(params.get('topic') || location.state?.topic || '');
  const [sourceText, setSourceText] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [count, setCount] = useState(10);
  const [cardStyle, setCardStyle] = useState('qa');

  const [step, setStep] = useState('setup'); // 'setup' | 'review'
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [notes, setNotes] = useState([]);
  const [meta, setMeta] = useState({ source: 'manual', topic: '', difficulty: '', cardStyle: '', lessonId: '' });
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState([]);
  const [rowBusy, setRowBusy] = useState({});
  const [rowError, setRowError] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const savingRef = useRef(false);
  const generatingRef = useRef(false);
  const savedRef = useRef(false);
  const firstStepRef = useRef(true);

  // The setup form and the review list are the same route, so the browser keeps the old scroll
  // position (down by the Generate button) and the review would open part-way down the page.
  // Jump to the top whenever the step changes, before the new content is painted.
  useLayoutEffect(() => {
    if (firstStepRef.current) {
      firstStepRef.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [step]);

  const dirty = step === 'review' && rows.length > 0 && !savedRef.current;
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const hasMaterial = Boolean(topic.trim() || sourceText.trim() || (useLesson && lessonId));
  const requestBody = useMemo(() => ({
    topic: topic.trim(),
    sourceText: sourceText.trim() || undefined,
    learningContentId: useLesson && lessonId ? lessonId : undefined,
    difficulty,
    cardStyle,
  }), [topic, sourceText, useLesson, lessonId, difficulty, cardStyle]);

  const generate = async (event) => {
    event?.preventDefault();
    if (generatingRef.current || !hasMaterial) return;
    generatingRef.current = true;
    setGenerating(true);
    setGenError('');
    try {
      const safeCount = Math.min(FLASHCARD_LIMITS.AI_MAX_CARDS, Math.max(FLASHCARD_LIMITS.AI_MIN_CARDS, Number(count) || 10));
      const result = await generateCards({ ...requestBody, count: safeCount });
      const info = result.meta || {};
      setRows(result.cards.map(newRow));
      setMeta({
        source: info.source || 'topic',
        topic: info.topic || topic.trim(),
        difficulty,
        cardStyle,
        lessonId: info.source === 'lesson' ? lessonId : '',
      });
      setTitle((prev) => prev || (info.topic || topic.trim() || lessonTitle || '').slice(0, FLASHCARD_LIMITS.TITLE));
      const messages = [];
      if (info.dropped > 0) messages.push(t('flashcards.create.droppedNote', { count: info.dropped }));
      if (info.returned < info.requested) messages.push(t('flashcards.create.fewerNote', { returned: info.returned, requested: info.requested }));
      setNotes(messages);
      setStep('review');
    } catch (err) {
      // Plan/quota refusals open the app-wide upgrade dialog; keep a short inline note as well.
      setGenError(isTierError(err?.response?.data) ? t('flashcards.create.quotaReached') : flashcardError(t, err, 'flashcards.errors.generateFailed'));
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  };

  const startManual = () => {
    setRows([newRow()]);
    setMeta({ source: 'manual', topic: topic.trim(), difficulty: '', cardStyle: '', lessonId: '' });
    setTitle((prev) => prev || topic.trim().slice(0, FLASHCARD_LIMITS.TITLE));
    setNotes([]);
    setStep('review');
  };

  const updateRow = (key, patch) => setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const removeRow = (key) => setRows((prev) => prev.filter((row) => row.key !== key));
  const addRow = () => setRows((prev) => (prev.length < FLASHCARD_LIMITS.CARDS_PER_SAVE ? [...prev, newRow()] : prev));

  const regenerateRow = async (row) => {
    if (rowBusy[row.key]) return;
    setRowBusy((prev) => ({ ...prev, [row.key]: true }));
    setRowError((prev) => ({ ...prev, [row.key]: '' }));
    try {
      const result = await generateCards({
        ...requestBody,
        topic: meta.topic || requestBody.topic,
        difficulty: meta.difficulty || difficulty,
        cardStyle: meta.cardStyle || cardStyle,
        count: 1,
        avoidFronts: rows.map((r) => r.front.trim()).filter(Boolean).slice(0, 40),
      });
      const fresh = result.cards[0];
      updateRow(row.key, { front: fresh.front, back: fresh.back, touched: false });
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [row.key]: isTierError(err?.response?.data) ? t('flashcards.create.quotaReached') : flashcardError(t, err, 'flashcards.errors.generateFailed'),
      }));
    } finally {
      setRowBusy((prev) => ({ ...prev, [row.key]: false }));
    }
  };

  const invalidRows = rows.some((row) => !row.front.trim() || !row.back.trim());
  const titleMissing = !title.trim();

  const save = async (event) => {
    event.preventDefault();
    setTitleTouched(true);
    setRows((prev) => prev.map((row) => ({ ...row, touched: true })));
    if (savingRef.current || saving) return;
    if (rows.length === 0) { setSaveError(t('flashcards.create.noCards')); return; }
    if (titleMissing || invalidRows) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const result = await createDeck({
        title: title.trim(),
        topic: (meta.topic || topic).trim(),
        difficulty: meta.difficulty || undefined,
        cardStyle: meta.cardStyle || undefined,
        source: meta.source,
        learningContentId: meta.lessonId || undefined,
        cards: rows.map((row) => ({ front: row.front.trim(), back: row.back.trim() })),
      });
      savedRef.current = true;
      showToast(t('flashcards.toast.created'));
      navigate(`/flashcards/${result.deck.id}`, { replace: true });
    } catch (err) {
      setSaveError(isTierError(err?.response?.data) ? t('flashcards.create.deckLimit') : flashcardError(t, err, 'flashcards.errors.saveFailed'));
      savingRef.current = false;
      setSaving(false);
    }
  };

  const startOver = () => {
    setConfirmReset(false);
    setStep('setup');
    setRows([]);
    setNotes([]);
    setSaveError('');
    setGenError('');
  };

  if (step === 'setup') {
    return (
      <div className="page-grid">
        <section className="panel">
          <Link className="lr-back" to="/flashcards">← {t('flashcards.backToDecks')}</Link>
          <h2>{t('flashcards.create.title')}</h2>
          <p>{t('flashcards.create.intro')}</p>
        </section>

        <form className="panel fc-form" onSubmit={generate}>
          {lessonId && (
            <div className="fc-lesson-banner">
              {useLesson ? (
                <>
                  <span>{lessonTitle ? t('flashcards.create.usingLesson', { title: lessonTitle }) : t('flashcards.create.usingLessonUntitled')}</span>
                  <button type="button" className="outline-btn dash-small-btn" onClick={() => setUseLesson(false)}>{t('flashcards.create.removeLesson')}</button>
                </>
              ) : (
                <>
                  <span>{t('flashcards.create.lessonRemoved')}</span>
                  <button type="button" className="outline-btn dash-small-btn" onClick={() => setUseLesson(true)}>{t('flashcards.create.useLesson')}</button>
                </>
              )}
            </div>
          )}

          <label className="fc-field">
            <span>{t('flashcards.create.topic')}</span>
            <input value={topic} maxLength={FLASHCARD_LIMITS.TOPIC} onChange={(e) => setTopic(e.target.value)} placeholder={t('flashcards.create.topicPlaceholder')} />
          </label>

          {!(useLesson && lessonId) && (
            <label className="fc-field">
              <span>{t('flashcards.create.source')}</span>
              <textarea rows={7} value={sourceText} maxLength={FLASHCARD_LIMITS.SOURCE_TEXT} onChange={(e) => setSourceText(e.target.value)} placeholder={t('flashcards.create.sourcePlaceholder')} />
              <small>{t('flashcards.create.sourceHelp')} <span className="fc-counter">{sourceText.length} / {FLASHCARD_LIMITS.SOURCE_TEXT}</span></small>
            </label>
          )}

          <div className="fc-form-row">
            <label className="fc-field">
              <span>{t('flashcards.create.difficulty')}</span>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{t(`flashcards.difficulty.${d}`)}</option>)}
              </select>
            </label>
            <label className="fc-field">
              <span>{t('flashcards.create.count')}</span>
              <input type="number" min={FLASHCARD_LIMITS.AI_MIN_CARDS} max={FLASHCARD_LIMITS.AI_MAX_CARDS} value={count}
                onChange={(e) => setCount(e.target.value)}
                onBlur={() => setCount((c) => Math.min(FLASHCARD_LIMITS.AI_MAX_CARDS, Math.max(FLASHCARD_LIMITS.AI_MIN_CARDS, Number(c) || 10)))} />
            </label>
            <label className="fc-field">
              <span>{t('flashcards.create.style')}</span>
              <select value={cardStyle} onChange={(e) => setCardStyle(e.target.value)}>
                {CARD_STYLES.map((s) => <option key={s} value={s}>{t(`flashcards.style.${s}`)}</option>)}
              </select>
            </label>
          </div>

          <p className="fc-notice">{t('flashcards.create.aiNotice')}</p>
          {genError && <p className="error-text" role="alert">{genError}</p>}

          <div className="fc-form-actions">
            <button type="submit" className="solid-btn" disabled={generating || !hasMaterial}>
              {generating ? t('flashcards.create.generating') : t('flashcards.create.generate')}
            </button>
            <button type="button" className="outline-btn" onClick={startManual} disabled={generating}>{t('flashcards.create.startManual')}</button>
          </div>
          {generating && <p className="fc-notice" role="status">{t('flashcards.create.generatingHint')}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>{t('flashcards.create.reviewTitle')}</h2>
        <p>{t('flashcards.create.reviewIntro')}</p>
        {notes.map((note) => <p key={note} className="fc-notice" role="status">{note}</p>)}
      </section>

      <form className="panel fc-form" onSubmit={save} noValidate>
        <label className="fc-field">
          <span>{t('flashcards.create.deckTitle')}</span>
          <input value={title} maxLength={FLASHCARD_LIMITS.TITLE} aria-invalid={titleTouched && titleMissing} onChange={(e) => setTitle(e.target.value)} />
          {titleTouched && titleMissing && <small className="error-text" role="alert">{t('flashcards.create.titleRequired')}</small>}
        </label>

        {rows.length === 0 ? (
          <p className="fc-notice">{t('flashcards.create.noCards')}</p>
        ) : (
          <ol className="fc-editor-list">
            {rows.map((row, index) => (
              <CardEditorRow
                key={row.key}
                index={index}
                card={row}
                busy={Boolean(rowBusy[row.key]) || saving}
                canRegenerate={meta.source !== 'manual'}
                error={rowError[row.key]}
                onChange={(patch) => updateRow(row.key, patch)}
                onRemove={() => removeRow(row.key)}
                onRegenerate={() => regenerateRow(row)}
              />
            ))}
          </ol>
        )}

        <div className="fc-form-actions">
          <button type="button" className="outline-btn" onClick={addRow} disabled={rows.length >= FLASHCARD_LIMITS.CARDS_PER_SAVE || saving}>{t('flashcards.create.addCard')}</button>
          <span className="fc-counter">{t('flashcards.create.cardTotal', { count: rows.length })}</span>
        </div>

        {saveError && <p className="error-text" role="alert">{saveError}</p>}

        <div className="fc-form-actions">
          <button type="submit" className="solid-btn" disabled={saving || rows.length === 0}>{saving ? t('flashcards.saving') : t('flashcards.create.save')}</button>
          <button type="button" className="outline-btn" onClick={() => setConfirmReset(true)} disabled={saving}>{t('flashcards.create.startOver')}</button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmReset}
        centered
        title={t('flashcards.create.discardTitle')}
        message={t('flashcards.create.discardMessage')}
        confirmLabel={t('flashcards.create.discard')}
        cancelLabel={t('flashcards.cancel')}
        onConfirm={startOver}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
};

export default FlashcardCreatePage;
