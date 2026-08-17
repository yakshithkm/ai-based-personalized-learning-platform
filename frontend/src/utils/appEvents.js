// Lightweight cross-page notification so the app shell (header streak pill,
// notifications) can refresh itself immediately after something changes
// elsewhere in the app, instead of only picking up the change on next
// full page load/mount. Deliberately just a thin wrapper around a native
// window CustomEvent - no extra state library needed for one signal.

const ATTEMPT_SUBMITTED_EVENT = 'tutormind:attempt-submitted';

export const emitAttemptSubmitted = (detail = {}) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ATTEMPT_SUBMITTED_EVENT, { detail }));
};

export const onAttemptSubmitted = (handler) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(ATTEMPT_SUBMITTED_EVENT, handler);
  return () => window.removeEventListener(ATTEMPT_SUBMITTED_EVENT, handler);
};