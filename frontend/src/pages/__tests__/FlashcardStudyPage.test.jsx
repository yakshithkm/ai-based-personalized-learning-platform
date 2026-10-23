import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import FlashcardStudyPage from '../FlashcardStudyPage';
import * as api from '../../api/flashcards';

vi.mock('../../api/flashcards', () => ({
  startSession: vi.fn(),
  shuffleSession: vi.fn(),
  recordAnswer: vi.fn(),
  completeSession: vi.fn(),
}));

const card = (n, extra = {}) => ({ id: `c${n}`, front: `Question ${n}?`, back: `Answer ${n}`, progress: {}, ...extra });
const session = (overrides = {}) => ({
  id: 's1', deckId: 'd1', mode: 'all', status: 'active', totalCards: 2, cards: [card(1), card(2)], answers: {}, ...overrides,
});

const renderStudy = (url = '/flashcards/d1/study') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/flashcards/:deckId/study" element={<FlashcardStudyPage />} />
        <Route path="/flashcards/:deckId" element={<div>deck page</div>} />
      </Routes>
    </MemoryRouter>
  );

const flipCard = () => fireEvent.click(screen.getByTestId('fc-flip'));

describe('FlashcardStudyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.startSession.mockResolvedValue({ resumed: false, session: session() });
  });

  it('starts a session, shows card 1 of N, and only enables rating after the card is flipped', async () => {
    renderStudy();
    expect(await screen.findByText('Question 1?')).toBeInTheDocument();
    expect(screen.getByText('Card 1 of 2')).toBeInTheDocument();
    expect(api.startSession).toHaveBeenCalledWith('d1', { mode: 'all', shuffle: false, restart: false });

    const know = screen.getByRole('button', { name: 'Know it' });
    expect(know).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Need to review' })).toBeDisabled();
    flipCard();
    expect(know).toBeEnabled();
  });

  it('lays the controls out as the rating pair first, then Previous / Next (Tab order matches what you see)', async () => {
    renderStudy();
    await screen.findByText('Question 1?');
    const controls = document.querySelector('.fc-study-controls');
    const labels = Array.from(controls.querySelectorAll('button')).map((b) => b.textContent);
    expect(labels).toEqual(['Need to review', 'Know it', 'Previous', 'Next']);
  });

  it('passes mode and shuffle from the URL to the server', async () => {
    api.startSession.mockResolvedValue({ resumed: false, session: session({ mode: 'difficult' }) });
    renderStudy('/flashcards/d1/study?mode=difficult&shuffle=1');
    await screen.findByText('Question 1?');
    expect(api.startSession).toHaveBeenCalledWith('d1', { mode: 'difficult', shuffle: true, restart: false });
  });

  it('supports keyboard flip/navigation but ignores typing and focused controls', async () => {
    renderStudy();
    await screen.findByText('Question 1?');

    fireEvent.keyDown(document.body, { key: ' ' });
    expect(screen.getByTestId('fc-flip')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(screen.getByTestId('fc-flip')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(screen.getByText('Card 2 of 2')).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(screen.getByText('Card 1 of 2')).toBeInTheDocument();

    // typing in an input must not flip or navigate
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: ' ' });
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(screen.getByText('Card 1 of 2')).toBeInTheDocument();
    expect(screen.getByTestId('fc-flip')).toHaveAttribute('aria-pressed', 'false');
    input.remove();

    // Enter on a focused button (e.g. Next) is that button's job, not a flip
    fireEvent.keyDown(screen.getByRole('button', { name: 'Next' }), { key: 'Enter' });
    expect(screen.getByTestId('fc-flip')).toHaveAttribute('aria-pressed', 'false');
  });

  it('records an answer on the server, advances, and completes with the server-built summary', async () => {
    api.recordAnswer.mockResolvedValue({ recorded: true });
    api.completeSession.mockResolvedValue({
      gamification: null,
      summary: {
        sessionId: 's1', reviewed: 2, known: 1, needReview: 1, accuracy: 50, unreviewed: 0, totalCards: 2,
        missedCards: [{ id: 'c2', front: 'Question 2?' }], deckStats: { difficultCards: 1 },
      },
    });
    renderStudy();
    await screen.findByText('Question 1?');

    flipCard();
    fireEvent.click(screen.getByRole('button', { name: 'Know it' }));
    await waitFor(() => expect(api.recordAnswer).toHaveBeenCalledWith('s1', 'c1', 'known'));
    expect(await screen.findByText('Question 2?')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 rated')).toBeInTheDocument();
    // the answer is hidden again on the next card
    expect(screen.getByTestId('fc-flip')).toHaveAttribute('aria-pressed', 'false');

    flipCard();
    fireEvent.click(screen.getByRole('button', { name: 'Need to review' }));
    await waitFor(() => expect(api.completeSession).toHaveBeenCalledWith('s1'));
    expect(await screen.findByText('Nice work!')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Cards to review again')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Practice difficult cards \(1\)/ })).toHaveAttribute('href', '/flashcards/d1/study?mode=difficult');
  });

  it('keeps the student on the card and shows an error when saving an answer fails', async () => {
    api.recordAnswer.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ recorded: true });
    renderStudy();
    await screen.findByText('Question 1?');
    flipCard();
    fireEvent.click(screen.getByRole('button', { name: 'Know it' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn.t save your answer/);
    expect(screen.getByText('Card 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('0 of 2 rated')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Know it' })); // retry
    await waitFor(() => expect(screen.getByText('Card 2 of 2')).toBeInTheDocument());
  });

  it('resumes at the first unanswered card after a refresh', async () => {
    api.startSession.mockResolvedValue({ resumed: true, session: session({ answers: { c1: 'known' } }) });
    renderStudy();
    expect(await screen.findByText('Question 2?')).toBeInTheDocument();
    expect(screen.getByText('Card 2 of 2')).toBeInTheDocument();
    expect(screen.getByText(/continuing your session/)).toBeInTheDocument();
  });

  it('explains when there is nothing to study in a mode', async () => {
    api.startSession.mockRejectedValue({ response: { status: 409, data: { message: 'No cards are due for review right now' } } });
    renderStudy('/flashcards/d1/study?mode=due');
    expect(await screen.findByText('Nothing to study right now')).toBeInTheDocument();
    expect(screen.getByText(/No cards are due for review right now/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to deck' })).toHaveAttribute('href', '/flashcards/d1');
  });

  it('lets the student finish early; zero answers shows a nothing-recorded summary', async () => {
    api.completeSession.mockResolvedValue({
      gamification: null,
      summary: { sessionId: 's1', reviewed: 0, known: 0, needReview: 0, accuracy: null, unreviewed: 2, totalCards: 2, missedCards: [], deckStats: { difficultCards: 0 } },
    });
    renderStudy();
    await screen.findByText('Question 1?');
    fireEvent.click(screen.getByRole('button', { name: 'Finish session' }));
    expect(await screen.findByText('Session ended')).toBeInTheDocument();
    expect(screen.getByText(/nothing was recorded/)).toBeInTheDocument();
  });
});
