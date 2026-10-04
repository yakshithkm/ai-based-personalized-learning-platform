import { describe, it, expect, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import LanguageSelector from '../LanguageSelector';
import { loadAndActivateLanguage } from '../../i18n';
import { LANGUAGE_STORAGE_KEY } from '../../i18n/languages';

const Page = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [draft, setDraft] = useState('');
  return (
    <div>
      <LanguageSelector />
      <h1>{t('navigation.practice')}</h1>
      <output data-testid="path">{location.pathname}</output>
      <input aria-label="draft" value={draft} onChange={(e) => setDraft(e.target.value)} />
    </div>
  );
};

const renderAt = (path = '/practice') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<Page />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(async () => {
  localStorage.clear();
  await act(async () => {
    await loadAndActivateLanguage('en');
  });
});

describe('LanguageSelector', () => {
  it('lists all six languages by native name and marks the current one', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /language/i }));
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent.replace(/[^\p{L}\p{M}]/gu, ''))).toEqual([
      'English',
      'ಕನ್ನಡ',
      'हिन्दी',
      'తెలుగు',
      'தமிழ்',
      'മലയാളം',
    ]);
    expect(screen.getByRole('option', { name: /English/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: /ಕನ್ನಡ/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('switches instantly, keeps the route and typed state, and persists the choice', async () => {
    renderAt('/practice');
    fireEvent.change(screen.getByLabelText('draft'), { target: { value: 'half-typed answer' } });
    expect(screen.getByRole('heading')).toHaveTextContent('Practice');

    fireEvent.click(screen.getByRole('button', { name: /language/i }));
    fireEvent.click(screen.getByRole('option', { name: /தமிழ்/ }));

    await waitFor(() => expect(screen.getByRole('heading')).toHaveTextContent('பயிற்சி'));
    expect(screen.getByTestId('path')).toHaveTextContent('/practice');
    expect(screen.getByLabelText('draft')).toHaveValue('half-typed answer');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ta');
    expect(screen.getByRole('button', { name: /மொழி/ })).toHaveTextContent('தமிழ்');
  });

  it('is keyboard operable: arrows move, Enter selects, Escape closes', async () => {
    renderAt();
    const trigger = screen.getByRole('button', { name: /language/i });
    fireEvent.click(trigger);
    const list = screen.getByRole('listbox');
    // focus must move into the list on the very first open, or real keyboard use breaks
    expect(list).toHaveFocus();
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('heading')).toHaveTextContent('ಅಭ್ಯಾಸ'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ಭಾಷೆ/ }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});