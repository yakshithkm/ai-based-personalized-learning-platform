import { useCallback, useEffect, useRef, useState } from 'react';
import { buildViolationEventId, reportExamViolation } from '../api/examProctoringClient';
import { loadFaceDetector } from '../lib/faceDetector';

// "Is anyone in front of the camera?" monitor for the Exam Simulation.
//
// - Samples the live camera stream about once a second with an on-device face detector
//   (lib/faceDetector). Frames never leave the browser and are never stored.
// - No face for `absentSamples` consecutive samples (~5 s) raises ONE warning (top-right
//   toast). While the person stays away another warning is raised every `rewarnMs`. As soon
//   as a face is seen again the streak resets.
// - `maxWarnings` warnings (default 5) auto-submit the exam through the protected submit path.
// - This counter is SEPARATE from the focus-violation counter: neither adds to the other.
// - Fail-open: if the detector cannot load/run, presence checking switches itself off and the
//   student is never penalised for it. Samples taken while the tab is hidden, the camera
//   permission prompt is open, or the video is not yet playing are ignored - only a
//   successful detection that finds nobody counts as "absent".
// - The server keeps the authoritative count (reason PRESENCE_LIMIT is verified server-side).

export const DEFAULT_MAX_PRESENCE_WARNINGS = 5;

// Mutable on purpose so tests can shorten the timings. Do not change at runtime in the app.
export const PRESENCE_TIMING = {
  sampleIntervalMs: 1000,
  absentSamples: 5,
  rewarnMs: 10000,
  toastMs: 6000,
  maxDetectorErrors: 3,
};

const REPORT_RETRY_DELAYS_MS = [800, 2000];
const FLUSH_TIMEOUT_MS = 2500;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const WARNING_MESSAGE =
  'No person detected in front of the camera. Please sit in front of your camera to continue the exam.';
const FINAL_MESSAGE = 'Maximum camera warnings reached. Your exam is being submitted automatically.';
const RETRY_MESSAGE =
  'Automatic submission could not be completed. Please press Submit Test to finish your exam.';

export const usePresenceMonitor = ({
  active,
  stream,
  paused = false,
  sessionId,
  maxWarnings,
  initialCount = 0,
  onLimitReached,
}) => {
  const max =
    Number.isInteger(Number(maxWarnings)) && Number(maxWarnings) > 0
      ? Number(maxWarnings)
      : DEFAULT_MAX_PRESENCE_WARNINGS;

  const [count, setCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [status, setStatus] = useState('off'); // off | loading | ready | unavailable

  const countRef = useRef(0);
  const maxRef = useRef(max);
  const pausedRef = useRef(paused);
  const sessionIdRef = useRef(sessionId);
  const onLimitRef = useRef(onLimitReached);
  const pendingReportsRef = useRef(new Set());
  const limitFiredRef = useRef(false);
  const mountedRef = useRef(false);
  const toastTimerRef = useRef(null);

  maxRef.current = max;
  pausedRef.current = paused;
  sessionIdRef.current = sessionId;
  onLimitRef.current = onLimitReached;

  const showToast = useCallback((next) => {
    setToast(next);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
    if (next && next.kind === 'warning') {
      toastTimerRef.current = setTimeout(() => setToast(null), PRESENCE_TIMING.toastMs);
    }
  }, []);

  const dismissToast = useCallback(() => {
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
    setToast(null);
  }, []);

  const fireLimit = useCallback(() => {
    limitFiredRef.current = true;
    if (typeof onLimitRef.current === 'function') onLimitRef.current();
  }, []);

  const reconcileWithServer = useCallback((data, forSessionId) => {
    if (!mountedRef.current || forSessionId !== sessionIdRef.current) return;
    const serverCount = Number(data?.presenceWarningCount);
    if (!Number.isInteger(serverCount) || serverCount <= countRef.current) return;
    countRef.current = Math.min(serverCount, maxRef.current);
    setCount(countRef.current);
  }, []);

  const sendReport = useCallback(() => {
    const forSessionId = sessionIdRef.current;
    const eventId = buildViolationEventId();

    const attempt = async () => {
      for (let i = 0; i <= REPORT_RETRY_DELAYS_MS.length; i += 1) {
        try {
          return await reportExamViolation({ sessionId: forSessionId, eventId, type: 'NO_PERSON' });
        } catch (error) {
          const httpStatus = Number(error?.response?.status || 0);
          const permanent = httpStatus >= 400 && httpStatus < 500 && httpStatus !== 429;
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
  }, [reconcileWithServer]);

  const raiseWarning = useCallback(() => {
    if (!sessionIdRef.current) return;

    // Already at the limit (a previous auto-submit failed): don't count past it, just retry
    // the protected submission - the submit guard makes duplicates a no-op.
    if (countRef.current >= maxRef.current) {
      fireLimit();
      return;
    }

    const next = countRef.current + 1;
    countRef.current = next;
    setCount(next);

    const reachedLimit = next >= maxRef.current;
    showToast(
      reachedLimit
        ? { kind: 'final', message: FINAL_MESSAGE, detail: `Warning ${next} of ${maxRef.current}` }
        : { kind: 'warning', message: WARNING_MESSAGE, detail: `Warning ${next} of ${maxRef.current}` }
    );

    sendReport();
    if (reachedLimit) fireLimit();
  }, [fireLimit, sendReport, showToast]);

  // Lets the submission flow wait (bounded) for in-flight reports so the server holds the
  // final count before it verifies a PRESENCE_LIMIT auto-submit.
  const flushReports = useCallback(async () => {
    const pending = Array.from(pendingReportsRef.current);
    if (!pending.length) return;
    await Promise.race([Promise.allSettled(pending), delay(FLUSH_TIMEOUT_MS)]);
  }, []);

  const getWarningCount = useCallback(() => countRef.current, []);

  // Per exam session: the starting count comes from the server, so a refresh can't reset it.
  useEffect(() => {
    const start = sessionId ? Math.min(Math.max(Number(initialCount) || 0, 0), maxRef.current) : 0;
    countRef.current = start;
    setCount(start);
    setToast(null);
    limitFiredRef.current = false;
    pendingReportsRef.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // If a previous automatic submission failed, don't leave a stale "submitting..." toast.
  useEffect(() => {
    if (!active) return;
    setToast((prev) => (prev && prev.kind === 'final' ? { kind: 'final-retry', message: RETRY_MESSAGE } : prev));
  }, [active]);

  // Restored session already at the limit: finish the exam (independent of the camera, so
  // refusing the camera after a refresh can't be used to dodge it).
  useEffect(() => {
    if (!active || !sessionId || limitFiredRef.current) return;
    if (countRef.current >= maxRef.current) {
      showToast({ kind: 'final', message: FINAL_MESSAGE, detail: `Warning ${countRef.current} of ${maxRef.current}` });
      fireLimit();
    }
  }, [active, sessionId, count, fireLimit, showToast]);

  // Sampling loop - runs only while the exam is active AND the camera has a live stream.
  useEffect(() => {
    if (!active || !stream) {
      setStatus('off');
      return undefined;
    }

    let cancelled = false;
    let timer = null;
    let detector = null;
    let misses = 0;
    let lastWarnAt = 0;
    let detectorErrors = 0;

    // Detached <video>: keeps detection independent from the preview element's lifecycle.
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.srcObject = stream;
    try {
      const played = video.play?.();
      if (played && typeof played.catch === 'function') played.catch(() => {});
    } catch (error) {
      // autoplay rejected - readyState check below keeps us from sampling a dead video
    }

    const schedule = () => {
      if (!cancelled) timer = setTimeout(tick, PRESENCE_TIMING.sampleIntervalMs);
    };

    const tick = async () => {
      if (cancelled) return;

      const canSample =
        detector &&
        !pausedRef.current &&
        !document.hidden &&
        video.readyState >= 2 &&
        video.videoWidth > 0;

      if (!canSample) {
        misses = 0; // an invalid sample is never evidence of absence
        schedule();
        return;
      }

      try {
        const present = await detector.hasFace(video);
        if (cancelled) return;
        detectorErrors = 0;

        if (present) {
          misses = 0;
          lastWarnAt = 0;
        } else {
          misses += 1;
          const now = Date.now();
          const streakReached = misses >= PRESENCE_TIMING.absentSamples;
          const dueForWarning = lastWarnAt === 0 || now - lastWarnAt >= PRESENCE_TIMING.rewarnMs;
          if (streakReached && dueForWarning) {
            lastWarnAt = now;
            raiseWarning();
          }
        }
      } catch (error) {
        detectorErrors += 1;
        if (detectorErrors >= PRESENCE_TIMING.maxDetectorErrors) {
          setStatus('unavailable'); // fail open: stop checking, never penalise
          return;
        }
      }

      schedule();
    };

    setStatus('loading');
    loadFaceDetector()
      .then((loaded) => {
        if (cancelled) return;
        detector = loaded;
        setStatus('ready');
        schedule();
      })
      .catch(() => {
        if (!cancelled) setStatus('unavailable');
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      try {
        video.pause?.();
      } catch (error) {
        // ignore
      }
      video.srcObject = null;
    };
  }, [active, stream, raiseWarning]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(toastTimerRef.current);
    };
  }, []);

  return {
    warningCount: count,
    maxWarnings: max,
    status,
    toast,
    dismissToast,
    flushReports,
    getWarningCount,
  };
};

export default usePresenceMonitor;