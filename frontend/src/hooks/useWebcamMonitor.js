import { useCallback, useEffect, useRef, useState } from 'react';

// Live webcam *availability* monitor for the Exam Simulation.
//
// - Requests video only (no microphone) via MediaDevices.getUserMedia.
// - The stream is used purely for a local <video> preview. Nothing is recorded, uploaded,
//   or analysed - and no face detection is performed.
// - "Unavailable" means the camera cannot provide an active stream (permission denied or
//   revoked, no device, disconnected, track ended/muted, unsupported browser).
// - Camera state never touches the focus-violation counter and never submits the exam.
//
// Alerts are derived from `status` (state), not fired as events, so the same warning can
// never be spammed repeatedly.

const MUTE_GRACE_MS = 2000; // ignore brief mute/unmute flaps
const RESTORED_NOTICE_MS = 4000;
const PROMPT_GRACE_MS = 20000; // upper bound for "permission prompt is open"

const classifyError = (error) => {
  const name = error?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'not-found';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'in-use';
  return 'error';
};

// Friendly copy only - raw browser errors are never shown to the student.
const REASON_HINTS = {
  denied: 'Camera permission is blocked. Allow camera access for this site in your browser, then press Retry.',
  'not-found': 'No camera was detected. Connect a webcam, then press Retry.',
  'in-use': 'Your camera may be in use by another application. Close it, then press Retry.',
  stopped: 'Your camera stopped sending video. Reconnect it, then press Retry.',
  muted: 'Your camera is not providing video. Check that it is connected and not covered or blocked, then press Retry.',
  unsupported: 'This browser cannot access a camera here (a secure HTTPS connection is required).',
  error: 'The camera could not be started. Press Retry.',
};

export const CAMERA_UNAVAILABLE_MESSAGE =
  'Camera unavailable. Please enable or reconnect your webcam to continue the exam.';

export const useWebcamMonitor = ({ enabled }) => {
  const [status, setStatus] = useState('idle'); // idle | requesting | active | unavailable
  const [reason, setReason] = useState(null);
  const [stream, setStream] = useState(null);
  const [showRestored, setShowRestored] = useState(false);
  const [promptPending, setPromptPending] = useState(false);

  const enabledRef = useRef(enabled);
  const streamRef = useRef(null);
  const requestIdRef = useRef(0);
  const wasUnavailableRef = useRef(false);
  const permissionStateRef = useRef(null);
  const trackCleanupRef = useRef(null);
  const muteTimerRef = useRef(null);
  const restoredTimerRef = useRef(null);
  const promptTimerRef = useRef(null);

  const clearTimers = useCallback(() => {
    clearTimeout(muteTimerRef.current);
    clearTimeout(restoredTimerRef.current);
    clearTimeout(promptTimerRef.current);
    muteTimerRef.current = null;
    restoredTimerRef.current = null;
    promptTimerRef.current = null;
  }, []);

  const endPromptGrace = useCallback(() => {
    clearTimeout(promptTimerRef.current);
    promptTimerRef.current = null;
    setPromptPending(false);
  }, []);

  // Stops every track (camera light off) and removes track listeners.
  const stopStream = useCallback(() => {
    if (trackCleanupRef.current) {
      trackCleanupRef.current();
      trackCleanupRef.current = null;
    }
    const current = streamRef.current;
    streamRef.current = null;
    if (current) {
      current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (error) {
          // already stopped
        }
      });
    }
    setStream(null);
  }, []);

  const markUnavailable = useCallback((why) => {
    wasUnavailableRef.current = true;
    setReason(why);
    setStatus('unavailable');
  }, []);

  const markActive = useCallback(() => {
    setReason(null);
    setStatus('active');
    if (wasUnavailableRef.current) {
      wasUnavailableRef.current = false;
      setShowRestored(true);
      clearTimeout(restoredTimerRef.current);
      restoredTimerRef.current = setTimeout(() => setShowRestored(false), RESTORED_NOTICE_MS);
    }
  }, []);

  const startCamera = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    stopStream();
    clearTimeout(muteTimerRef.current);

    const mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
      markUnavailable('unsupported');
      return;
    }

    setStatus('requesting');
    setPromptPending(true);
    clearTimeout(promptTimerRef.current);
    promptTimerRef.current = setTimeout(() => setPromptPending(false), PROMPT_GRACE_MS);

    let mediaStream;
    try {
      mediaStream = await mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      endPromptGrace();
      markUnavailable(classifyError(error));
      return;
    }

    // A newer request / disable / unmount happened while the prompt was open: release the
    // stream immediately so the camera is never left running.
    if (requestId !== requestIdRef.current || !enabledRef.current) {
      mediaStream.getTracks().forEach((track) => track.stop());
      return;
    }

    endPromptGrace();
    const track = mediaStream.getVideoTracks()[0];
    if (!track) {
      mediaStream.getTracks().forEach((t) => t.stop());
      markUnavailable('not-found');
      return;
    }

    streamRef.current = mediaStream;
    setStream(mediaStream);

    const isCurrent = () => streamRef.current === mediaStream;

    const handleEnded = () => {
      if (!isCurrent()) return;
      stopStream();
      markUnavailable('stopped');
    };

    const handleMute = () => {
      if (!isCurrent() || document.hidden) return; // some browsers mute in background tabs
      clearTimeout(muteTimerRef.current);
      muteTimerRef.current = setTimeout(() => {
        if (isCurrent() && track.muted && track.readyState === 'live' && !document.hidden) {
          markUnavailable('muted');
        }
      }, MUTE_GRACE_MS);
    };

    const handleUnmute = () => {
      if (!isCurrent()) return;
      clearTimeout(muteTimerRef.current);
      if (track.readyState === 'live' && wasUnavailableRef.current) markActive();
    };

    const handleVisibility = () => {
      if (!isCurrent() || document.hidden) return;
      if (track.readyState !== 'live') {
        handleEnded();
      } else if (track.muted) {
        handleMute();
      } else if (wasUnavailableRef.current) {
        markActive();
      }
    };

    track.addEventListener('ended', handleEnded);
    track.addEventListener('mute', handleMute);
    track.addEventListener('unmute', handleUnmute);
    document.addEventListener('visibilitychange', handleVisibility);
    trackCleanupRef.current = () => {
      track.removeEventListener('ended', handleEnded);
      track.removeEventListener('mute', handleMute);
      track.removeEventListener('unmute', handleUnmute);
      document.removeEventListener('visibilitychange', handleVisibility);
    };

    markActive();
  }, [endPromptGrace, markActive, markUnavailable, stopStream]);

  // Main lifecycle: camera runs only while the exam is actively being monitored.
  useEffect(() => {
    enabledRef.current = enabled;

    if (!enabled) {
      requestIdRef.current += 1; // invalidate any in-flight request
      stopStream();
      clearTimers();
      wasUnavailableRef.current = false;
      setStatus('idle');
      setReason(null);
      setShowRestored(false);
      setPromptPending(false);
      return undefined;
    }

    startCamera();
    return () => {
      requestIdRef.current += 1;
      stopStream();
      clearTimers();
    };
  }, [enabled, startCamera, stopStream, clearTimers]);

  // Permission changes during the exam (revoked -> warning, re-granted -> auto-recover) and
  // device plug/unplug. Uses the Permissions API where the browser supports 'camera'.
  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    let permissionStatus = null;

    const onPermissionChange = () => {
      if (cancelled || !permissionStatus) return;
      permissionStateRef.current = permissionStatus.state;
      if (permissionStatus.state === 'denied') {
        stopStream();
        markUnavailable('denied');
      } else if (permissionStatus.state === 'granted' && wasUnavailableRef.current && !streamRef.current) {
        startCamera();
      }
    };

    const onDeviceChange = () => {
      const canAutoRetry =
        permissionStateRef.current === 'granted' && wasUnavailableRef.current && !streamRef.current;
      if (canAutoRetry) startCamera();
    };

    try {
      navigator.permissions
        ?.query({ name: 'camera' })
        .then((result) => {
          if (cancelled) return;
          permissionStatus = result;
          permissionStateRef.current = result.state;
          result.addEventListener?.('change', onPermissionChange);
        })
        .catch(() => {
          // 'camera' is not a queryable permission in this browser - rely on track events.
        });
    } catch (error) {
      // Permissions API unavailable.
    }

    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange);

    return () => {
      cancelled = true;
      permissionStatus?.removeEventListener?.('change', onPermissionChange);
      navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange);
    };
  }, [enabled, markUnavailable, startCamera, stopStream]);

  return {
    status,
    reason,
    hint: reason ? REASON_HINTS[reason] || REASON_HINTS.error : '',
    stream,
    showRestored,
    // True while the browser's permission prompt is likely open (bounded). Used to avoid
    // treating that prompt's transient focus change as a focus violation.
    promptPending,
    retry: startCamera,
  };
};

export default useWebcamMonitor;