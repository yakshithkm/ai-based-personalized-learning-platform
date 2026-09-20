import { useEffect, useRef } from 'react';

// Compact live camera preview + status indicator. Purely local: the stream is attached to a
// <video> element and never recorded, uploaded, or analysed.
const WebcamMonitor = ({ status, stream, hint, onRetry, presence }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    video.srcObject = stream || null;
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  const isActive = status === 'active' && Boolean(stream);
  const isUnavailable = status === 'unavailable';

  let label = 'Camera starts with the exam';
  if (status === 'requesting') label = 'Requesting camera…';
  if (isActive) label = '● Camera Active';
  if (isUnavailable) label = '⚠ Camera Unavailable';

  return (
    <div className={`exam-proctor-cam ${isActive ? 'active' : ''} ${isUnavailable ? 'unavailable' : ''}`}>
      <div className="exam-proctor-cam-frame">
        {stream ? (
          <video
            ref={videoRef}
            className="exam-proctor-cam-video"
            autoPlay
            muted
            playsInline
            aria-label="Live camera preview"
          />
        ) : (
          <div className="exam-proctor-cam-placeholder" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28">
              <path
                d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"
                fill="currentColor"
              />
            </svg>
          </div>
        )}
      </div>
      <p className="exam-proctor-cam-status" role="status">
        {label}
      </p>
      {isActive && presence && presence.status === 'loading' && (
        <p className="exam-proctor-cam-presence">Starting presence check…</p>
      )}
      {isActive && presence && presence.status === 'ready' && (
        <p className="exam-proctor-cam-presence">
          Presence warnings: {presence.count} / {presence.max}
        </p>
      )}
      {isActive && presence && presence.status === 'unavailable' && (
        <p className="exam-proctor-cam-presence">Presence check unavailable</p>
      )}
      {isUnavailable && (
        <div className="exam-proctor-cam-help">
          {hint && <p>{hint}</p>}
          <button type="button" className="outline-btn exam-proctor-retry" onClick={onRetry}>
            Retry camera
          </button>
        </div>
      )}
    </div>
  );
};

export default WebcamMonitor;