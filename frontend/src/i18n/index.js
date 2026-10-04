import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/translation.json';
import { DEFAULT_LANGUAGE, FALLBACK_LANGUAGE, getLanguageMeta, isSupportedLanguage } from './languages';
import { resolveInitialLanguage } from './detect';

const loaders = {
  kn: () => import('./locales/kn/translation.json'),
  hi: () => import('./locales/hi/translation.json'),
  te: () => import('./locales/te/translation.json'),
  ta: () => import('./locales/ta/translation.json'),
  ml: () => import('./locales/ml/translation.json'),
};

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: Object.keys(loaders).concat(DEFAULT_LANGUAGE),
  nonExplicitSupportedLngs: false,
  load: 'languageOnly',
  interpolation: { escapeValue: false },
  returnNull: false,
  returnEmptyString: false,
  initAsync: false,
  react: { useSuspense: false },
  saveMissing: false,
  missingKeyHandler: isDev
    ? (lngs, ns, key) => console.warn(`[i18n] missing key "${key}" for ${lngs.join(',')}`)
    : undefined,
});

const applyDocumentLanguage = (code) => {
  if (typeof document === 'undefined') return;
  const meta = getLanguageMeta(code);
  document.documentElement.setAttribute('lang', meta.code);
  document.documentElement.setAttribute('dir', meta.dir);
};
i18n.on('languageChanged', applyDocumentLanguage);
applyDocumentLanguage(i18n.language || DEFAULT_LANGUAGE);

export const loadAndActivateLanguage = async (code) => {
  const target = isSupportedLanguage(code) ? code : DEFAULT_LANGUAGE;
  if (target !== DEFAULT_LANGUAGE && !i18n.hasResourceBundle(target, 'translation')) {
    try {
      const mod = await loaders[target]();
      i18n.addResourceBundle(target, 'translation', mod.default || mod, true, true);
    } catch (error) {
      return i18n.language;
    }
  }
  await i18n.changeLanguage(target);
  return target;
};

export const initI18n = async () => loadAndActivateLanguage(resolveInitialLanguage());

export default i18n;