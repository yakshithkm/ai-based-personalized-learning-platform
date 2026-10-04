import { translateServerError } from './serverErrors';

// ExamSimulationPage keeps storing plain English messages in state (its handlers are
// race-sensitive and untouched). They are translated here at RENDER time by exact match.
const EXAM_MESSAGES = {
  'Session expired during restore and auto-submit failed. Please retry.': 'examSim.msg.restoreExpired',
  'Your exam session was restored. Timer resumed.': 'examSim.msg.restored',
  'Hard sync failed. Please reload the exam.': 'examSim.msg.hardSyncFailed',
  'Failed to save. Please try again.': 'examSim.msg.saveFailed',
  'Session authentication failed. Restarting exam session is required.': 'examSim.msg.authFailed',
  'Too many attempts. Please wait.': 'examSim.msg.tooMany',
  'Session state mismatch detected. State refreshed.': 'examSim.msg.stateMismatch',
  'Save failed and state refresh failed. Please reload the exam.': 'examSim.msg.saveAndRefreshFailed',
  'This exam is active in another tab. Interaction is disabled in this tab.': 'examSim.msg.otherTab',
  'Recovering an answer that was not confirmed before the exam session closed...': 'examSim.msg.recovering',
  'Failed to start exam simulation.': 'examSim.msg.startFailed',
  'Auto-submit failed. Please submit manually.': 'examSim.msg.autoSubmitFailed',
  'Failed to submit exam simulation.': 'examSim.msg.submitFailed',
  'Select an option before moving to the next question.': 'examSim.msg.selectOption',
};

export const translateExamMessage = (t, message) => {
  if (!message || typeof message !== 'string') return message;
  const key = EXAM_MESSAGES[message.trim()];
  if (key) return t(key);
  return translateServerError(t, message, 'examSim.msg.generic');
};