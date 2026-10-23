import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

    expect(screen.getByText('Know Exactly What to Practice Next')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Why TutorMind' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Built for NEET, JEE, and KCET preparation' })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Simple, transparent pricing' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Frequently asked questions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'More than a question bank' })).toBeInTheDocument();
    expect(screen.queryByText('What students are saying')).not.toBeInTheDocument();
    expect(screen.getByText(/TutorMind. All rights reserved/)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('Features lists the Flashcards card (replacing the About Exam card) while the About Exam nav link stays', async () => {
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

    const features = document.getElementById('more-features');
    expect(within(features).getAllByRole('article')).toHaveLength(8);
    const card = within(features).getByRole('heading', { name: 'Flashcards' }).closest('article');
    expect(within(card).getByText(/Generate flashcards from a topic, pasted notes or a lesson/)).toBeInTheDocument();
    expect(within(card).getByText(/AI-generated cards can contain mistakes/)).toBeInTheDocument();
    expect(within(features).queryByRole('heading', { name: 'About Exam' })).not.toBeInTheDocument();
    // the nav link to the About Exam page is separate and unchanged
    expect(screen.getAllByRole('link', { name: 'About Exam' }).length).toBeGreaterThan(0);

    vi.unstubAllGlobals();
  });

  it('each pricing plan lists Flashcards with the real deck limits (Free 5, Pro 30, Premium none)', async () => {
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

    const lists = document.querySelectorAll('.pricing-features');
    expect(lists).toHaveLength(3);
    const [free, pro, premium] = Array.from(lists);
    expect(within(free).getByText(/Flashcards: up to 5 saved decks/)).toBeInTheDocument();
    expect(within(pro).getByText(/Flashcards: up to 30 saved decks/)).toBeInTheDocument();
    expect(within(premium).getByText(/Flashcards with no deck limit \(fair-use ceilings apply\)/)).toBeInTheDocument();
    expect(free.querySelectorAll('li')).toHaveLength(5);
    expect(pro.querySelectorAll('li')).toHaveLength(6);
    expect(premium.querySelectorAll('li')).toHaveLength(5);

    vi.unstubAllGlobals();
  });

  it('links the "About Exam" nav item to the /about-exams route', async () => {
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

    const aboutExamLinks = screen.getAllByRole('link', { name: 'About Exam' });
    expect(aboutExamLinks.length).toBeGreaterThan(0);
    aboutExamLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/about-exams');
    });

    vi.unstubAllGlobals();
  });
});