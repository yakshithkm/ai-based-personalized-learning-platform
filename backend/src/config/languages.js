const SUPPORTED_LANGUAGES = {
  en: { name: 'English', nativeName: 'English' },
  kn: { name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी' },
  te: { name: 'Telugu', nativeName: 'తెలుగు' },
  ta: { name: 'Tamil', nativeName: 'தமிழ்' },
  ml: { name: 'Malayalam', nativeName: 'മലയാളം' },
};
const DEFAULT_LANGUAGE = 'en';
const SUPPORTED_CODES = Object.keys(SUPPORTED_LANGUAGES);

const normalizeLanguage = (value) => {
  if (typeof value !== 'string') return null;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_CODES.includes(base) ? base : null;
};

const resolveRequestLanguage = (req) => {
  const explicit = normalizeLanguage(req?.body?.language) || normalizeLanguage(req?.query?.language);
  if (explicit) return explicit;
  const header = req?.headers?.['accept-language'];
  if (typeof header === 'string') {
    const first = normalizeLanguage(header.split(',')[0].split(';')[0]);
    if (first) return first;
  }
  return DEFAULT_LANGUAGE;
};

module.exports = { SUPPORTED_LANGUAGES, SUPPORTED_CODES, DEFAULT_LANGUAGE, normalizeLanguage, resolveRequestLanguage };