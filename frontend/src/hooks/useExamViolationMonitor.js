import { useCallback, useEffect, useRef, useState } from 'react';
import { buildViolationEventId, reportExamViolation } from '../api/examProctoringClient';

// Focus / tab / window / route-leave violation monitor for the Exam Simulation.
//
// Rules (browser-supported signals only - this is not tamper-proof proctoring):
//  * ONE leave = ONE violation. `awayRef` is a small state machine: a violation is counted
//    only on the transition "in the exam" -> "away". `window.blur` and `visibilitychange`
//    routinely both fire for the same action; whichever arrives first counts, the other is
//    ignored, and staying away never counts again. Returning (focus / visible) re-arms it.
//  * `blur` is confirmed after a short delay: transient blurs (native confirm() dialogs,
//    permission prompts) restore focus before the check and are ignored. A hidden tab is
//    unambiguous and counts immediately.
//  * Leaving the exam route counts once: in-app link clicks are intercepted with a
//    confirmation; any other route exit (browser back/forward, programmatic navigation) is
//    counted on unmount. Browser back/forward is never blocked.
//  * Camera problems never come through here.
//  * The server is authoritative: each violation is reported with an idempotency key and the
//    stored count survives refresh / session restore.

export const DEFAULT_MAX_VIOLATIONS = 5;

const BLUR_CONFIRM_DELAY_MS = 250;
const NOTICE_DURATION_MS = 6000;
const REPORT_RETRY_DELAYS_MS = [800, 2000];
const FLUSH_TIMEOUT_MS = 2500;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const FOCUS_MESSAGE = 'Exam focus violation detected. Please remain on the Exam Simulation page.';
const FINAL_MESSAGE = 'Maximum violation limit reached. Your exam is being submitted automatically.';
const RETRY_MESSAGE =
  'Automatic submission could not be completed. Please press Submit Test to finish your exam.';

export const useExamViolationMonitor = ({
  sessionId,
  active,
  paused = false,
  maxViolations,
  initialCount = 0,
  onLimitReached,
  navigate,
}) => {
  const max = Number.isInteger(Number(maxViolations)) && Number(maxViolations) > 0
    ? Number(maxViolations)
    : DEFAULT_MAX_VIOLATIONS;

  const [count, setCount] = useState(0);
  const [notice, setNotice] = useState(null);

  const countRef = useRef(0);
  const awayRef = useRef(false);
  const activeRef = useRef(active);
  const pausedRef = useRef(paused);
  const maxRef = useRef(max);
  const sessionIdRef = useRef(sessionId);
  const onLimitRef = useRef(onLimitReached);
  const navigateRef = useRef(navigate);
  const pendingReportsRef = useRef(new Set());
  const leaveHandledRef = useRef(false);
  const limitFiredRef = useRef(false);
  const mountedRef = useRef(false);
  const blurTimerRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const mountPathRef = useRef(typeof window !== 'undefined' ? window.location.pathname : '');

  // Always read the latest props from stable callbacks (prevents stale closures).
  activeRef.current = active;
  pausedRef.current = paused;
  maxRef.current = max;
  sessionIdRef.current = sessionId;
  onLimitRef.current = onLimitReached;
  navigateRef.current = navigate;

  const clearBlurTimer = useCallback(() => {
    clearTimeout(blurTimerRef.current);
    blurTimerRef.current = null;
  }, []);

  const showNotice = useCallback((next) => {
    setNotice(next);
    clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = null;
    if (next && next.kind === 'focus') {
      noticeTimerRef.current = setTimeout(() => setNotice(null), NOTICE_DURATION_MS);
    }
  }, []);

  const fireLimit = useCallback(() => {
    limitFiredRef.current = true;
    if (typeof onLimitRef.current === 'function') onLimitRef.current();
  }, []);

  const reconcileWithServer = useCallback(
    (data, forSessionId) => {
      if (!mountedRef.current || forSessionId !== sessionIdRef.current) return;
      const serverCount = Number(data?.violationCount);
      if (!Number.isInteger(serverCount) || serverCount <= countRef.current) return;
      countRef.current = Math.min(serverCount, maxRef.current);
      setCount(countRef.current);
    },
    []
  );

  const sendReport = useCallback(
    (type) => {
      const forSessionId = sessionIdRef.current;
      const eventId = buildViolationEventId();

      const attempt = async () => {
        for (let i = 0; i <= REPORT_RETRY_DELAYS_MS.length; i += 1) {
          try {
            return await reportExamViolation({ sessionId: forSessionId, eventId, type });
          } catch (error) {
            const status = Number(error?.response?.status || 0);
            const permanent = status >= 400 && status < 500 && status !== 429;
            if (permanent || i === REPORT_RETRY_DELAYS_MS.length) return null;
            await delay(REPORT_RETRY_DELAYS_MS[i]);
          }
        }
        return null;
      };

      const tracked = attempt()
        .then((data) => reconcileWithServer(data, forSessionId))
        .catch(() => {})
        .finally(() => pendingReportsRef.current.delete(tracked));
      pendingReportsRef.current.add(tracked);
    },
    [reconcileWithServer]
  );

  // Returns true when this violation reached the limit.
  const recordViolation = useCallback(
    (type) => {
      if (!activeRef.current || !sessionIdRef.current) return false;

      // Already at the limit (e.g. a previous auto-submit failed): don't count past the max,
      // just retry the protected submission. The submit guard makes duplicates a no-op.
      if (countRef.current >= maxRef.current) {
        fireLimit();
        return true;
      }

      const next = countRef.current + 1;
      countRef.current = next;
      setCount(next);

      const reachedLimit = next >= maxRef.current;
      showNotice(
        reachedLimit
          ? { kind: 'final', message: FINAL_MESSAGE, detail: `Violation ${next} of ${maxRef.current}` }
          : { kind: 'focus', message: FOCUS_MESSAGE, detail: `Violation ${next} of ${maxRef.current}` }
      );

      sendReport(type);
      if (reachedLimit) fireLimit();
      return reachedLimit;
    },
    [fireLimit, sendReport, showNotice]
  );

  // Lets the submission flow wait (bounded) for in-flight reports so the server has the final
  // count before it verifies an auto-submit reason.
  const flushReports = useCallback(async () => {
    const pending = Array.from(pendingReportsRef.current);
    if (!pending.length) return;
    await Promise.race([Promise.allSettled(pending), delay(FLUSH_TIMEOUT_MS)]);
  }, []);

  const getViolationCount = useCallback(() => countRef.current, []);

  // (Re)initialise per exam session. The starting count comes from the server, so a refresh
  // or restore can never reset violations.
  useEffect(() => {
    const start = sessionId ? Math.min(Math.max(Number(initialCount) || 0, 0), maxRef.current) : 0;
    countRef.current = start;
    setCount(start);
    setNotice(null);
    leaveHandledRef.current = false;
    limitFiredRef.current = false;
    pendingReportsRef.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Restored session (or server-side reconcile) already at the limit: finish the exam.
  useEffect(() => {
    if (!active || !sessionId || limitFiredRef.current) return;
    if (countRef.current >= maxRef.current) {
      showNotice({ kind: 'final', message: FINAL_MESSAGE, detail: `Violation ${countRef.current} of ${maxRef.current}` });
      fireLimit();
    }
  }, [active, sessionId, count, fireLimit, showNotice]);

  // Focus / visibility / in-app navigation listeners - registered only while an exam is active.
  useEffect(() => {
    if (!active) return undefined;

    // If a previous automatic submission failed, don't leave a stale "submitting..." notice.
    setNotice((prev) => (prev && prev.kind === 'final' ? { kind: 'final-retry', message: RETRY_MESSAGE } : prev));

    awayRef.current = document.visibilityState === 'hidden' || !document.hasFocus();

    const registerLeave = (type) => {
      if (awayRef.current) return; // same leave already counted
      if (pausedRef.current) return; // e.g. camera permission prompt is open
      awayRef.current = true;
      recordViolation(type);
    };

    const markReturned = () => {
      clearBlurTimer();
      if (document.visibilityState !== 'hidden') awayRef.current = false;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearBlurTimer();
        registerLeave('TAB_HIDDEN');
      } else {
        markReturned();
      }
    };

    // window-level blur/focus don't bubble up from child elements, so these only fire for the
    // window itself losing/gaining focus.
    const onBlur = () => {
      if (awayRef.current) return;
      clearBlurTimer();
      blurTimerRef.current = setTimeout(() => {
        blurTimerRef.current = null;
        if (document.visibilityState === 'hidden' || !document.hasFocus()) {
          registerLeave('WINDOW_BLUR');
        }
      }, BLUR_CONFIRM_DELAY_MS);
    };

    const onFocus = () => {
      markReturned();
    };

    // In-app link to a different route while the exam is active: confirm, then count once.
    const onClickCapture = (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      let url;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch (error) {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return; // not leaving the exam route

      event.preventDefault();
      event.stopPropagation();

      const nextCount = Math.min(countRef.current + 1, maxRef.current);
      const isFinal = nextCount >= maxRef.current;
      const proceed = window.confirm(
        isFinal
          ? `Leaving the Exam Simulation counts as a violation (${nextCount} of ${maxRef.current}). This is the final violation and your exam will be submitted automatically. Continue?`
          : `Leaving the Exam Simulation counts as a violation (${nextCount} of ${maxRef.current}). Your exam stays open and the timer keeps running. Leave anyway?`
      );
      if (!proceed) return;

      leaveHandledRef.current = true; // the unmount path must not count it a second time
      const reachedLimit = recordViolation('ROUTE_LEAVE');
      if (!reachedLimit && typeof navigateRef.current === 'function') {
        navigateRef.current(`${url.pathname}${url.search}${url.hash}`);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('click', onClickCapture, true);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('click', onClickCapture, true);
      clearBlurTimer();
    };
  }, [active, clearBlurTimer, recordViolation]);

  // True unmount while an exam is active = the student left the exam route by some means we
  // could not intercept (browser back/forward, programmatic navigation). Count it once.
  // The pathname check keeps React StrictMode's simulated unmount/remount (same path) from
  // registering a false violation.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearBlurTimer();
      clearTimeout(noticeTimerRef.current);

      if (!activeRef.current || !sessionIdRef.current || leaveHandledRef.current) return;
      if (window.location.pathname === mountPathRef.current) return;
      if (countRef.current >= maxRef.current) return;

      reportExamViolation({
        sessionId: sessionIdRef.current,
        eventId: buildViolationEventId(),
        type: 'ROUTE_LEAVE',
      }).catch(() => {});
    };
  }, [clearBlurTimer]);

  return {
    violationCount: count,
    maxViolations: max,
    notice,
    flushReports,
    getViolationCount,
  };
};

export default useExamViolationMonitor;