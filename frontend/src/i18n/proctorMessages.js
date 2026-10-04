// Proctoring hooks keep emitting plain English strings (their behaviour is unchanged).
// These are translated at RENDER time in ProctorAlerts / PresenceToast / WebcamMonitor.
const PROCTOR_MESSAGES = {
  'Exam focus violation detected. Please remain on the Exam Simulation page.': 'proctor.focusViolation',
  'Maximum violation limit reached. Your exam is being submitted automatically.': 'proctor.finalViolation',
  'Automatic submission could not be completed. Please press Submit Test to finish your exam.': 'proctor.retrySubmit',
  'No person detected in front of the camera. Please sit in front of your camera to continue the exam.': 'proctor.noPerson',
  'Maximum camera warnings reached. Your exam is being submitted automatically.': 'proctor.finalCamera',
  'Camera unavailable. Please enable or reconnect your webcam to continue the exam.': 'proctor.cameraUnavailable',
  'Camera permission is blocked. Allow camera access for this site in your browser, then press Retry.': 'proctor.hint.denied',
  'No camera was detected. Connect a webcam, then press Retry.': 'proctor.hint.notFound',
  'Your camera may be in use by another application. Close it, then press Retry.': 'proctor.hint.inUse',
  'Your camera stopped sending video. Reconnect it, then press Retry.': 'proctor.hint.stopped',
  'Your camera is not providing video. Check that it is connected and not covered or blocked, then press Retry.': 'proctor.hint.muted',
  'This browser cannot access a camera here (a secure HTTPS connection is required).': 'proctor.hint.unsupported',
  'The camera could not be started. Press Retry.': 'proctor.hint.error',
};

export const translateProctorMessage = (t, message) => {
  if (!message || typeof message !== 'string') return message;
  const key = PROCTOR_MESSAGES[message.trim()];
  if (key) return t(key);
  const violation = /^Violation (\d+) of (\d+)$/.exec(message);
  if (violation) return t('proctor.violationDetail', { current: violation[1], max: violation[2] });
  const warning = /^Warning (\d+) of (\d+)$/.exec(message);
  if (warning) return t('proctor.warningDetail', { current: warning[1], max: warning[2] });
  return message;
};