import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  completeRecommendation,
  reportProgress,
  skipRecommendation,
  startRecommendation,
} from '../api/learning';
import ContentFeedback from '../components/learning/ContentFeedback';
import { DifficultyBadge, ProgressBar, TypeBadge } from '../components/learning/learningUi';
import { renderMiniMarkdown } from '../utils/markdownLite';

const HEARTBEAT_MS = 30000;

const LearningContentPage = () => {
  const { recommendationId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [percent, setPercent] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(null);

  const articleRef = useRef(null);
  const lastPingRef = useRef(Date.now());
  const lastSentPercent = useRef(0);
  const doneRef = useRef(false);

  // Seconds of *visible* time since the last report (so background tabs don't inflate it).
  const takeElapsed = useCallback(() => {
    const now = Date.now();
    const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
    const elapsed = visible ? Math.round((now - lastPingRef.current) / 1000) : 0;
    lastPingRef.current = now;
    return Math.max(0, Math.min(elapsed, 600));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    setCompleted(null);
    doneRef.current = false;
    (async () => {
      try {
        const res = await startRecommendation(recommendationId);
        if (cancelled) return;
        setData(res);
        setPercent(res.progress?.progressPercent || 0);
        lastSentPercent.current = res.progress?.progressPercent || 0;
        lastPingRef.current = Date.now();
        if (res.progress?.status === 'completed') doneRef.current = false; // allow re-reading
      } catch (err) {
        if (!cancelled) {
          setError({
            status: err?.response?.status,
            message: err?.response?.data?.message || 'Could not open this learning resource.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recommendationId]);

  const flush = useCallback(
    (extra = {}) => {
      if (!data || doneRef.current) return;
      const timeSpentSec = takeElapsed();
      if (!timeSpentSec && extra.progressPercent === undefined) return;
      reportProgress(recommendationId, { timeSpentSec, ...extra }).catch(() => {});
    },
    [data, recommendationId, takeElapsed]
  );

  // Scroll-based progress for in-app content, reported when a new quarter is passed.
  useEffect(() => {
    if (!data?.content?.body || completed) return undefined;
    const onScroll = () => {
      const el = articleRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight * 0.6;
      const seen = Math.min(Math.max(-rect.top + window.innerHeight * 0.4, 0), Math.max(total, 1));
      const pct = Math.round(Math.min(99, (seen / Math.max(total, 1)) * 100));
      setPercent((prev) => Math.max(prev, pct));
      const bucket = Math.floor(pct / 25) * 25;
      if (bucket > lastSentPercent.current) {
        lastSentPercent.current = bucket;
        flush({ progressPercent: bucket });
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [data, completed, flush]);

  // Heartbeat + flush on leaving.
  useEffect(() => {
    if (!data || completed) return undefined;
    const timer = setInterval(() => flush(), HEARTBEAT_MS);
    return () => {
      clearInterval(timer);
      flush();
    };
  }, [data, completed, flush]);

  const markHalfway = () => {
    setPercent((prev) => Math.max(prev, 50));
    lastSentPercent.current = Math.max(lastSentPercent.current, 50);
    flush({ progressPercent: 50 });
  };

  const finish = async () => {
    setCompleting(true);
    try {
      const timeSpentSec = takeElapsed();
      const res = await completeRecommendation(recommendationId, { timeSpentSec });
      doneRef.current = true;
      setCompleted(res);
      setPercent(100);
    } catch (err) {
      setError({ status: err?.response?.status, message: err?.response?.data?.message || 'Could not mark this as complete.', soft: true });
    } finally {
      setCompleting(false);
    }
  };

  const skip = async () => {
    try {
      doneRef.current = true;
      await skipRecommendation(recommendationId);
    } catch (err) {
      // fall through to navigation either way
    }
    navigate('/learn');
  };

  if (error && !error.soft) {
    return (
      <div className="page-grid">
        <section className="panel error-state-card">
          <h3>{error.status === 410 ? 'This resource is no longer available' : "Couldn't open this resource"}</h3>
          <p>{error.message}</p>
          <Link className="solid-btn" to="/learn">Back to Learn</Link>
        </section>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-grid">
        <section className="panel" aria-busy="true" aria-label="Opening learning resource">
          <div className="skeleton-chip" style={{ width: '220px', marginBottom: '0.8rem' }} />
          <div className="skeleton-block" style={{ minHeight: '320px' }} />
        </section>
      </div>
    );
  }

  const { content, recommendation } = data;

  return (
    <div className="page-grid lr-page">
      <section className="panel lr-content-head">
        <Link className="lr-back" to="/learn">← Back to Learn</Link>
        <h2>{content.title}</h2>
        <p className="lr-meta">{[content.subject, content.topic, content.concept].filter(Boolean).join(' • ')}</p>
        <div className="lr-badge-row">
          <TypeBadge type={content.contentType} />
          <span className="lr-badge lr-time">{content.estimatedMinutes} min</span>
          <DifficultyBadge difficulty={content.difficulty} />
          {content.provider && <span className="lr-badge lr-type">{content.provider}</span>}
        </div>
        {recommendation?.reason && <p className="lr-why-inline"><strong>Why this:</strong> {recommendation.reason}</p>}
        {!completed && <ProgressBar percent={percent} label="Your progress" />}
      </section>

      {content.learningObjectives?.length > 0 && !completed && (
        <section className="panel lr-objectives">
          <h3>What you will learn</h3>
          <ul>{content.learningObjectives.map((o) => <li key={o}>{o}</li>)}</ul>
        </section>
      )}

      {content.url && (
        <section className="panel">
          <h3>Open the resource</h3>
          <p>This {content.contentType} is hosted by {content.provider || 'an external provider'}. It opens in a new tab.</p>
          <a className="solid-btn" href={content.url} target="_blank" rel="noopener noreferrer">Open resource</a>
          {!completed && (
            <p className="lr-inline-actions">
              <button type="button" className="outline-btn" onClick={markHalfway}>I am about halfway</button>
            </p>
          )}
        </section>
      )}

      {content.body && (
        <article ref={articleRef} className="panel lr-article">{renderMiniMarkdown(content.body)}</article>
      )}

      {!completed && (
        <section className="panel lr-finish">
          <div className="lr-cta-row">
            <button type="button" className="solid-btn" onClick={finish} disabled={completing}>
              {completing ? 'Saving...' : 'I have finished this'}
            </button>
            <button type="button" className="outline-btn" onClick={skip}>Not for me</button>
          </div>
          {error?.soft && <p className="error-text" role="alert">{error.message}</p>}
        </section>
      )}

      {completed && (
        <section className="panel lr-complete" aria-live="polite">
          <p className="eyebrow-label">Nice work</p>
          <h3>You completed {content.title}.</h3>
          <p>Now test your understanding while it is fresh.</p>
          <div className="lr-cta-row">
            <Link className="solid-btn" to={completed.practice?.route || '/practice?mode=recommended'}>
              Start {completed.practice?.count || 5} Question Practice
            </Link>
            <Link className="outline-btn" to="/learn">Back to Learn</Link>
          </div>
          <ContentFeedback recommendationId={recommendationId} initial={completed.progress || {}} />
        </section>
      )}
    </div>
  );
};

export default LearningContentPage;