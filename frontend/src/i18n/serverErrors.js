import i18n from './index';

// Known backend messages -> translation keys. Unknown messages show the server text in
// English, and a translated generic fallback in every other language.
const KNOWN_SERVER_MESSAGES = {
  'Invalid email or password': 'serverErrors.invalidCredentials',
  'Email and password are required': 'serverErrors.emailPasswordRequired',
  'Name, email and password are required': 'serverErrors.registerFieldsRequired',
  'User already exists with this email': 'serverErrors.userExists',
  'This account is an admin account. Please sign in at /admin/login instead.': 'serverErrors.adminAccount',
  'Not authorized, token missing': 'serverErrors.sessionExpired',
  'Not authorized, token invalid': 'serverErrors.sessionExpired',
  'Not authorized, user not found': 'serverErrors.sessionExpired',
  'Too many AI tutor requests. Please wait a moment and try again.': 'serverErrors.aiTooMany',
  'AI usage limit reached temporarily. Please try again later.': 'serverErrors.aiRateLimited',
  'AI explanation is temporarily unavailable.': 'serverErrors.aiUnavailable',
  'Unable to connect to the AI service. Please try again.': 'serverErrors.aiNetwork',
  "Sorry, I couldn't generate an explanation right now. Please try again.": 'serverErrors.aiGeneric',
  'This question has not been attempted yet': 'serverErrors.notAttempted',
  'Question not found': 'serverErrors.questionNotFound',
  'Exam session not found': 'serverErrors.examSessionNotFound',
  'Exam session is not active': 'serverErrors.examSessionInactive',
};

export const translateServerError = (t, message, fallbackKey = 'common.somethingWentWrong') => {
  const key = typeof message === 'string' ? KNOWN_SERVER_MESSAGES[message.trim()] : null;
  if (key) return t(key);
  const isEnglish = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0] === 'en';
  if (isEnglish && typeof message === 'string' && message.trim()) return message;
  return t(fallbackKey);
};