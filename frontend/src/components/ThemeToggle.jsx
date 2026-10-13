import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

const SunIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M20.2 14.6A8.2 8.2 0 0 1 9.4 3.8a8.2 8.2 0 1 0 10.8 10.8z" />
  </svg>
);

/**
 * Dark/Light switch. Shows the icon of the theme you will switch TO
 * (sun while in dark, moon while in light) and announces that action through
 * its accessible name + tooltip. Placed next to the language selector in the
 * shared headers only — never repeated per page.
 */
const ThemeToggle = ({ className = '' }) => {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  const label = isLight ? t('theme.switchToDark') : t('theme.switchToLight');

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      data-theme-state={theme}
    >
      <span className="theme-toggle-icon" key={theme} aria-hidden="true">
        {isLight ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  );
};

export default ThemeToggle;
