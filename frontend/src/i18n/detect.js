import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, normalizeLanguageCode } from './languages';

export const readStoredLanguage = () => {
  try {
    return normalizeLanguageCode(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch (error) {
    return null;
  }
};

export const storeLanguage = (code) => {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch (error) {
    // non-fatal
  }
};

export const detectBrowserLanguage = () => {
  if (typeof navigator === 'undefined') return null;
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    const code = normalizeLanguageCode(candidate);
    if (code) return code;
  }
  return null;
};

export const resolveInitialLanguage = () =>
  readStoredLanguage() || detectBrowserLanguage() || DEFAULT_LANGUAGE;