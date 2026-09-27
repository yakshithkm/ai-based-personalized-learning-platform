import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AboutExamPage from '../AboutExamPage';

// jsdom has no IntersectionObserver — stub it so useScrollReveal doesn't throw.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('AboutExamPage smoke test', () => {
  it('renders header, all three exam cards, comparison table, and official links without crashing', () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);

    render(
      <MemoryRouter>
        <AboutExamPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'About Entrance Exams', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('EXAM INFORMATION')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'NEET (UG)', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'JEE Main', level: 2 })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Karnataka CET (KCET / UGCET)', level: 2 })
    ).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Quick Comparison' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Which Exam Should I Prepare For?' })).toBeInTheDocument();

    // Official links point at the real authority domains and open safely in a new tab.
    const neetLinks = screen.getAllByRole('link', { name: /Official Website \(opens the official site in a new tab\)/ });
    const neetWebsiteLink = neetLinks.find((link) => link.getAttribute('href') === 'https://neet.nta.nic.in/');
    expect(neetWebsiteLink).toBeDefined();
    expect(neetWebsiteLink).toHaveAttribute('target', '_blank');
    expect(neetWebsiteLink).toHaveAttribute('rel', 'noopener noreferrer');

    expect(
      screen.getAllByText(/Check the official website for the current registration status\./).length
    ).toBeGreaterThan(0);

    expect(screen.getAllByRole('button', { name: /Back to Home/ }).length).toBeGreaterThan(0);

    vi.unstubAllGlobals();
  });
});