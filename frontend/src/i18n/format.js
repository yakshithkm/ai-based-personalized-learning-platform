import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getLanguageMeta } from './languages';

// Locale-aware presentation only - the underlying data is never changed. Numbering
// stays Latin (0-9) in every supported locale so scores/percentages remain unambiguous
// next to the untranslated question content.
const build = (code) => {
  const locale = getLanguageMeta(code).intlLocale;
  const safe = (fn, fallback) => (value, ...rest) => {
    try {
      return fn(value, ...rest);
    } catch (error) {
      return fallback(value);
    }
  };
  const numberFmt = (opts) => new Intl.NumberFormat(locale, { numberingSystem: 'latn', ...opts });
  const dateFmt = (opts) => new Intl.DateTimeFormat(locale, { numberingSystem: 'latn', ...opts });
  const toDate = (value) => (value instanceof Date ? value : new Date(value));

  return {
    locale,
    formatNumber: safe((value, opts) => numberFmt(opts).format(value), String),
    // value is already a 0-100 percentage (the app's convention), not a 0-1 ratio.
    // Keeps the caller's own precision (callers already pass toFixed(0/1/2) strings), so
    // switching language changes the digits' formatting but never rounds differently.
    formatPercent: safe(
      (value, opts) => {
        const decimals = (String(value).split('.')[1] || '').length;
        return numberFmt({ minimumFractionDigits: decimals, maximumFractionDigits: decimals, ...opts }).format(Number(value)) + '%';
      },
      (value) => `${value}%`
    ),
    formatDate: safe(
      (value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => dateFmt(opts).format(toDate(value)),
      String
    ),
    formatTime: safe(
      (value, opts = { hour: '2-digit', minute: '2-digit' }) => dateFmt(opts).format(toDate(value)),
      String
    ),
    formatDateTime: safe(
      (value, opts = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) =>
        dateFmt(opts).format(toDate(value)),
      String
    ),
    // "3 days ago" / "yesterday" in the active language.
    formatRelative: safe(
      (value) => {
        const diffMs = toDate(value).getTime() - Date.now();
        const units = [
          ['year', 31536000000],
          ['month', 2592000000],
          ['day', 86400000],
          ['hour', 3600000],
          ['minute', 60000],
        ];
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', numberingSystem: 'latn' });
        for (const [unit, ms] of units) {
          if (Math.abs(diffMs) >= ms || unit === 'minute') {
            return rtf.format(Math.round(diffMs / ms), unit);
          }
        }
        return '';
      },
      String
    ),
  };
};

export const useLocaleFormat = () => {
  const { i18n } = useTranslation();
  const code = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];
  return useMemo(() => build(code), [code]);
};