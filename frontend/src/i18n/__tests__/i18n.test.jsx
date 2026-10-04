import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import i18n, { loadAndActivateLanguage } from '../index';
import { LANGUAGE_STORAGE_KEY, supportedLanguages, normalizeLanguageCode } from '../languages';
import { resolveInitialLanguage } from '../detect';
import { translateServerError } from '../serverErrors';
import en from '../locales/en/translation.json';
import kn from '../locales/kn/translation.json';
import hi from '../locales/hi/translation.json';
import te from '../locales/te/translation.json';
import ta from '../locales/ta/translation.json';
import ml from '../locales/ml/translation.json';

const locales = { kn, hi, te, ta, ml };

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? flatten(value, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value]]
  );

const placeholders = (value) => [...String(value).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');

const Probe = () => {
  const { t } = useTranslation();
  return (
    <div>
      <h1>{t('navigation.dashboard')}</h1>
      <p>{t('dashboard.greeting', { greeting: t('dashboard.goodMorning'), name: 'Asha' })}</p>
      <span data-testid="plural">{t('common.questionCount', { count: 1 })}|{t('common.questionCount', { count: 5 })}</span>
      <span data-testid="missing">{t('does.not.exist', { defaultValue: 'Fallback text' })}</span>
    </div>
  );
};

beforeEach(async () => {
  localStorage.clear();
  await act(async () => {
    await loadAndActivateLanguage('en');
  });
});

describe('language configuration', () => {
  it('supports exactly the six requested languages with native names', () => {
    expect(supportedLanguages.map((l) => [l.code, l.nativeName])).toEqual([
      ['en', 'English'],
      ['kn', 'ಕನ್ನಡ'],
      ['hi', 'हिन्दी'],
      ['te', 'తెలుగు'],
      ['ta', 'தமிழ்'],
      ['ml', 'മലയാളം'],
    ]);
  });

  it('normalizes region tags and rejects unsupported codes', () => {
    expect(normalizeLanguageCode('kn-IN')).toBe('kn');
    expect(normalizeLanguageCode('HI_in')).toBe('hi');
    expect(normalizeLanguageCode('fr')).toBeNull();
    expect(normalizeLanguageCode(undefined)).toBeNull();
  });
});

describe('translation files', () => {
  const enKeys = flatten(en);

  for (const [code, data] of Object.entries(locales)) {
    it(`${code} has every English key, with matching placeholders and no empty values`, () => {
      const flat = new Map(flatten(data));
      const missing = [];
      const mismatched = [];
      for (const [key, value] of enKeys) {
        if (!flat.has(key)) {
          missing.push(key);
          continue;
        }
        const translated = flat.get(key);
        if (Array.isArray(value)) {
          if (!Array.isArray(translated) || translated.length !== value.length) mismatched.push(key);
        } else if (!String(translated).trim() || placeholders(translated) !== placeholders(value)) {
          mismatched.push(key);
        }
      }
      expect(missing).toEqual([]);
      expect(mismatched).toEqual([]);
    });

    it(`${code} does not contain keys that English lacks`, () => {
      const enSet = new Set(enKeys.map(([k]) => k));
      expect(flatten(data).map(([k]) => k).filter((k) => !enSet.has(k))).toEqual([]);
    });
  }
});

describe('switching languages', () => {
  it('re-renders in place, with interpolation and plurals, and no page reload', async () => {
    render(<Probe />);
    expect(screen.getByRole('heading')).toHaveTextContent('Dashboard');
    expect(screen.getByText('Good morning, Asha!')).toBeInTheDocument();
    expect(screen.getByTestId('plural')).toHaveTextContent('1 question|5 questions');

    await act(async () => {
      await loadAndActivateLanguage('kn');
    });
    expect(screen.getByRole('heading')).toHaveTextContent('ಡ್ಯಾಶ್‌ಬೋರ್ಡ್');
    expect(screen.getByText('ಶುಭೋದಯ, Asha!')).toBeInTheDocument();
    expect(screen.getByTestId('plural')).toHaveTextContent('1 ಪ್ರಶ್ನೆ|5 ಪ್ರಶ್ನೆಗಳು');
    expect(document.documentElement.getAttribute('lang')).toBe('kn');

    await act(async () => {
      await loadAndActivateLanguage('ml');
    });
    expect(screen.getByRole('heading')).toHaveTextContent('ഡാഷ്ബോർഡ്');
  });

  it('falls back to English (never the raw key) for a missing translation', async () => {
    i18n.addResourceBundle('en', 'translation', { onlyEnglish: { label: 'Only in English' } }, true, true);
    await act(async () => {
      await loadAndActivateLanguage('ta');
    });
    expect(i18n.t('onlyEnglish.label')).toBe('Only in English');
    expect(i18n.t('totally.unknown.key', { defaultValue: 'Fallback text' })).toBe('Fallback text');
  });

  it('falls back to English for an unsupported language', async () => {
    await act(async () => {
      await loadAndActivateLanguage('fr');
    });
    expect(i18n.language).toBe('en');
  });
});

describe('initial language priority', () => {
  it('prefers a saved choice over the browser language', () => {
    Object.defineProperty(window.navigator, 'languages', { value: ['hi-IN', 'en'], configurable: true });
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'te');
    expect(resolveInitialLanguage()).toBe('te');
  });

  it('uses the browser language only when nothing is saved, and English otherwise', () => {
    Object.defineProperty(window.navigator, 'languages', { value: ['hi-IN', 'en'], configurable: true });
    expect(resolveInitialLanguage()).toBe('hi');
    Object.defineProperty(window.navigator, 'languages', { value: ['fr-FR'], configurable: true });
    expect(resolveInitialLanguage()).toBe('en');
  });

  it('ignores a corrupted saved value', () => {
    Object.defineProperty(window.navigator, 'languages', { value: ['en-US'], configurable: true });
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'klingon');
    expect(resolveInitialLanguage()).toBe('en');
  });
});

describe('server error translation', () => {
  const t = (key) => i18n.t(key);

  it('maps known backend messages and keeps unknown English messages verbatim in English', () => {
    expect(translateServerError(t, 'Invalid email or password')).toBe('Invalid email or password.');
    expect(translateServerError(t, 'Some brand new server message', 'auth.loginFailed')).toBe('Some brand new server message');
  });

  it('never shows an untranslated server sentence in another language', async () => {
    await act(async () => {
      await loadAndActivateLanguage('hi');
    });
    expect(translateServerError(t, 'Invalid email or password')).toBe('ईमेल या पासवर्ड अमान्य है।');
    expect(translateServerError(t, 'Some brand new server message', 'auth.loginFailed')).toBe(i18n.t('auth.loginFailed'));
  });
});