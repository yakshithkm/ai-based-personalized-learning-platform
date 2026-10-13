import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Theme state for TutorMind.
 *
 * - Two themes: 'dark' (default) and 'light'.
 * - The active theme is exposed as <html data-theme="…">; every colour in the
 *   app comes from the semantic tokens in styles/theme.css, so switching is a
 *   single attribute change (no re-render of the component tree is needed for
 *   styling).
 * - The preference lives in localStorage under THEME_STORAGE_KEY. Dark is the
 *   fallback when nothing is saved (or storage is unavailable). The operating
 *   system's colour-scheme preference is intentionally NOT consulted.
 * - index.html contains a tiny inline script that applies the saved theme
 *   before first paint (so there is no flash); this provider adopts that value
 *   on mount and keeps it in sync afterwards (including across browser tabs).
 * - Auth state never touches this key, so the choice survives login/logout.
 */
export const THEME_STORAGE_KEY = 'tutormind-theme';
export const THEMES = ['dark', 'light'];
const DEFAULT_THEME = 'dark';
const THEME_COLORS = { dark: '#0f172a', light: '#f7f6f2' };

const isTheme = (value) => value === 'dark' || value === 'light';

export const readStoredTheme = () => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

const applyThemeToDocument = (theme) => {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[theme]);
};

const noop = () => {};
const FALLBACK = {
  theme: DEFAULT_THEME,
  isLight: false,
  setTheme: noop,
  toggleTheme: noop,
};

const ThemeContext = createContext(FALLBACK);

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(readStoredTheme);
  const transitionTimer = useRef(null);
  const isFirstApply = useRef(true);

  // Apply to <html>. A short-lived .theme-transition class gives a smooth
  // colour cross-fade for user-initiated switches only (never on first paint).
  useEffect(() => {
    const root = document.documentElement;
    if (!isFirstApply.current) {
      root.classList.add('theme-transition');
      window.clearTimeout(transitionTimer.current);
      transitionTimer.current = window.setTimeout(() => root.classList.remove('theme-transition'), 320);
    }
    isFirstApply.current = false;
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => () => window.clearTimeout(transitionTimer.current), []);

  // Keep multiple open tabs consistent.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === THEME_STORAGE_KEY && isTheme(event.newValue)) {
        setThemeState(event.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next) => {
    if (!isTheme(next)) return;
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage unavailable (private mode, quota) — the theme still applies for this session */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, isLight: theme === 'light', setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);