export const DEFAULT_LANGUAGE = 'en';
export const FALLBACK_LANGUAGE = 'en';
export const LANGUAGE_STORAGE_KEY = 'tutormind-language';

export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', intlLocale: 'en-IN', dir: 'ltr' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳', intlLocale: 'kn-IN', dir: 'ltr' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', intlLocale: 'hi-IN', dir: 'ltr' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳', intlLocale: 'te-IN', dir: 'ltr' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', intlLocale: 'ta-IN', dir: 'ltr' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳', intlLocale: 'ml-IN', dir: 'ltr' },
];

export const supportedCodes = supportedLanguages.map((lang) => lang.code);
export const isSupportedLanguage = (code) => supportedCodes.includes(code);
export const getLanguageMeta = (code) =>
  supportedLanguages.find((lang) => lang.code === code) || supportedLanguages[0];

export const normalizeLanguageCode = (value) => {
  if (typeof value !== 'string') return null;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return isSupportedLanguage(base) ? base : null;
};