import { describe, it, expect, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import { ThemeProvider, THEME_STORAGE_KEY, readStoredTheme, useTheme } from '../ThemeContext';
import ThemeToggle from '../../components/ThemeToggle';

const Probe = () => {
  const { theme } = useTheme();
  return <span data-testid="theme">{theme}</span>;
};

const mount = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <Probe />
        <ThemeToggle />
      </ThemeProvider>
    </I18nextProvider>
  );

const mockOsPrefersLight = () => {
  window.matchMedia = (query) => ({
    matches: query.includes('light'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  });
};

beforeEach(async () => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  await act(async () => {
    await i18n.changeLanguage('en');
  });
});

describe('theme system', () => {
  it('defaults to dark when nothing is saved', () => {
    mount();
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('ignores the operating-system light preference', () => {
    mockOsPrefersLight();
    mount();
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('restores a saved light preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    mount();
    expect(screen.getByTestId('theme').textContent).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('falls back to dark for an invalid saved value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(readStoredTheme()).toBe('dark');
  });

  it('toggles immediately, persists, and exposes an accessible action label', () => {
    mount();
    const toggle = screen.getByRole('button', { name: 'Switch to light theme' });
    fireEvent.click(toggle);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    const back = screen.getByRole('button', { name: 'Switch to dark theme' });
    fireEvent.click(back);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('is not cleared by auth logout (which only removes the token)', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    localStorage.setItem('token', 'abc');
    localStorage.removeItem('token');
    expect(readStoredTheme()).toBe('light');
  });
});
