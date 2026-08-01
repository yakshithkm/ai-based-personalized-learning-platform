import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../HomePage';
import { AuthProvider } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// jsdom has no IntersectionObserver — stub it so useScrollReveal doesn't throw.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('HomePage (landing page) smoke test', () => {
  it('renders hero, new sections, and footer without crashing', async () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );

    render(
      <MemoryRouter>
        <ThemeProvider>
          <AuthProvider>
            <HomePage />
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('AI that understands how you learn')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Why TutorMind' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Built for NEET, JEE, and KCET preparation' })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Simple, transparent pricing' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Frequently asked questions' })).toBeInTheDocument();
    expect(screen.getByText(/TutorMind. All rights reserved/)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});