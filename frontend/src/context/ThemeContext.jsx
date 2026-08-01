import { createContext, useContext, useEffect, useMemo } from 'react';

const ThemeContext = createContext(null);

// TutorMind is dark-mode only — the entire UI (landing page included) is
// designed around the dark glass/aurora aesthetic, so there is no light
// theme to switch to. This provider still exists so existing consumers
// (and `data-theme` CSS scoping, if ever needed again) keep working.
export const ThemeProvider = ({ children }) => {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  const value = useMemo(() => ({ theme: 'dark' }), []);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);