import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { useAuth } from './AuthContext';
import { loadAndActivateLanguage } from '../i18n';
import { readStoredLanguage, storeLanguage } from '../i18n/detect';
import { getLanguageMeta, normalizeLanguageCode, supportedLanguages } from '../i18n/languages';

const LanguageContext = createContext(null);

// Persists to the signed-in user's profile. Best-effort: the language has already been
// applied and saved locally, so a network failure must never surface as an error.
const saveToProfile = (code) => {
  if (!localStorage.getItem('token')) return;
  api.patch('/auth/preferences', { language: code }).catch(() => {});
};

export const LanguageProvider = ({ children }) => {
  const { i18n } = useTranslation();
  const auth = useAuth();
  const user = auth?.user;
  const language = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language) || 'en';

  // Switching is a pure in-place re-render: no reload, no route change, and nothing
  // outside i18next's own state is touched (auth, chat, exam and practice state are
  // owned by their components and are untouched).
  const setLanguage = useCallback(async (code) => {
    const next = normalizeLanguageCode(code);
    if (!next) return;
    storeLanguage(next);
    await loadAndActivateLanguage(next);
    saveToProfile(next);
  }, []);

  // Priority once the profile is known: saved user preference > localStorage > browser > 'en'.
  // (localStorage/browser were already applied on first paint by initI18n.)
  useEffect(() => {
    if (!user || user.isAdmin) return;
    const serverLanguage = normalizeLanguageCode(user.preferredLanguage);
    if (serverLanguage) {
      if (serverLanguage !== normalizeLanguageCode(i18n.language)) {
        storeLanguage(serverLanguage);
        loadAndActivateLanguage(serverLanguage);
      }
      return;
    }
    // Nothing saved on the account yet. Only push up a language the user explicitly
    // picked on this device - never one that was merely auto-detected.
    const explicit = readStoredLanguage();
    if (explicit) saveToProfile(explicit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, user?.preferredLanguage]);

  const value = useMemo(
    () => ({ language, setLanguage, languages: supportedLanguages, meta: getLanguageMeta(language) }),
    [language, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

// Works without the provider too (isolated component tests): it then only switches the
// UI language and stores it locally.
export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language) || 'en';
  const standalone = useMemo(
    () => ({
      language,
      languages: supportedLanguages,
      meta: getLanguageMeta(language),
      setLanguage: async (code) => {
        const next = normalizeLanguageCode(code);
        if (!next) return;
        storeLanguage(next);
        await loadAndActivateLanguage(next);
      },
    }),
    [language]
  );
  return ctx || standalone;
};