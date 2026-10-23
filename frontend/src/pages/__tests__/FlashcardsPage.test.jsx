import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FlashcardsPage from '../FlashcardsPage';
import FlashcardCreatePage from '../FlashcardCreatePage';
import { ToastProvider } from '../../context/ToastContext';
import * as api from '../../api/flashcards';

vi.mock('../../api/flashcards', () => ({
  listDecks: vi.fn(),
  getSummary: vi.fn(),
  updateDeck: vi.fn(),
  deleteDeck: vi.fn(),
  generateCards: vi.fn(),
  createDeck: vi.fn(),
}));

const stats = (o = {}) => ({ totalCards: 10, reviewedCards: 4, newCards: 6, knownCards: 3, needReviewCards: 1, dueCards: 7, difficultCards: 1, ...o });
const deck = (n, o = {}) => ({
  id: `d${n}`, title: `Deck ${n}`, topic: 'Biology', difficulty: 'beginner', createdAt: '2026-10-01T00:00:00Z', lastStudiedAt: null, stats: stats(), ...o,
});
const page = (decks, o = {}) => ({ decks, total: decks.length, page: 1, pageSize: 12, totalPages: 1, topics: ['Biology'], ...o });

const wrap = (ui) => render(<MemoryRouter><ToastProvider>{ui}</ToastProvider></MemoryRouter>);

describe('FlashcardsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getSummary.mockResolvedValue({ decks: 1, totalCards: 10, dueCards: 7, difficultCards: 1 });
  });

  it('shows an empty state with a create call to action when there are no decks', async () => {
    api.getSummary.mockResolvedValue({ decks: 0, totalCards: 0, dueCards: 0, difficultCards: 0 });
    api.listDecks.mockResolvedValue(page([], { topics: [] }));
    wrap(<FlashcardsPage />);
    expect(await screen.findByText('No flashcard decks yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Create flashcards' }).length + screen.getAllByRole('link', { name: 'Create flashcards' }).length).toBeGreaterThan(0);
  });

  it('lists decks with real stats only (known progress appears only once cards were reviewed)', async () => {
    api.listDecks.mockResolvedValue(page([deck(1), deck(2, { stats: stats({ reviewedCards: 0, knownCards: 0, newCards: 10, dueCards: 10 }) })]));
    wrap(<FlashcardsPage />);
    const first = await screen.findByRole('article', { name: 'Deck 1' });
    expect(within(first).getByText(/^10 cards/)).toBeInTheDocument();
    expect(within(first).getByText('3 of 10 cards known')).toBeInTheDocument();
    expect(within(first).getByText('7 due')).toBeInTheDocument();
    expect(within(first).getByRole('link', { name: 'Study' })).toHaveAttribute('href', '/flashcards/d1/study');
    const second = screen.getByRole('article', { name: 'Deck 2' });
    expect(within(second).queryByText(/cards known/)).not.toBeInTheDocument();
    expect(within(second).getByText('Not studied yet')).toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    api.listDecks.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(page([deck(1)]));
    wrap(<FlashcardsPage />);
    expect(await screen.findByText('Couldn’t load flashcards')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('article', { name: 'Deck 1' })).toBeInTheDocument();
  });

  it('searches and sorts through the API, and offers to clear filters when nothing matches', async () => {
    api.listDecks.mockResolvedValue(page([deck(1)]));
    wrap(<FlashcardsPage />);
    await screen.findByRole('article', { name: 'Deck 1' });

    api.listDecks.mockResolvedValue(page([], { total: 0 }));
    fireEvent.change(screen.getByPlaceholderText('Search by deck title or topic'), { target: { value: 'zzz' } });
    await waitFor(() => expect(api.listDecks).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'zzz', sort: 'recent', page: 1 })));
    expect(await screen.findByText('No matching decks')).toBeInTheDocument();

    api.listDecks.mockResolvedValue(page([deck(1)]));
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await screen.findByRole('article', { name: 'Deck 1' });

    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'title' } });
    await waitFor(() => expect(api.listDecks).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'title' })));
  });

  it('opens the rename and delete dialogs in a body-level portal so they centre above the app shell', async () => {
    api.listDecks.mockResolvedValue(page([deck(1)]));
    const { container } = wrap(<FlashcardsPage />);
    const card = await screen.findByRole('article', { name: 'Deck 1' });

    fireEvent.click(within(card).getByRole('button', { name: 'Rename' }));
    const rename = await screen.findByRole('dialog');
    const renameBackdrop = rename.parentElement;
    expect(container.contains(renameBackdrop)).toBe(false);
    expect(renameBackdrop.parentElement).toBe(document.body);
    expect(renameBackdrop).toHaveClass('fc-modal-backdrop');
    fireEvent.click(within(rename).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(container.contains(confirm)).toBe(false);
    expect(confirm.parentElement.parentElement).toBe(document.body);
    expect(confirm.parentElement).toHaveClass('fc-modal-backdrop');
  });

  it('asks for confirmation before deleting a deck, then deletes it', async () => {
    api.listDecks.mockResolvedValue(page([deck(1)]));
    api.deleteDeck.mockResolvedValue({ deleted: true });
    wrap(<FlashcardsPage />);
    const card = await screen.findByRole('article', { name: 'Deck 1' });
    fireEvent.click(within(card).getByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/Its 10 cards and all review history will be permanently removed/)).toBeInTheDocument();
    expect(api.deleteDeck).not.toHaveBeenCalled();

    api.listDecks.mockResolvedValue(page([], { total: 0 }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.deleteDeck).toHaveBeenCalledWith('d1'));
  });
});

describe('FlashcardCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
  });

  const generated = { cards: [{ front: 'What is ATP?', back: 'Energy currency' }, { front: 'What is DNA?', back: 'Genetic material' }], meta: { requested: 5, returned: 2, dropped: 1, source: 'topic', topic: 'Cells' } };

  it('requires material before generating, generates, lets the student edit, then saves what was reviewed', async () => {
    api.generateCards.mockResolvedValue(generated);
    api.createDeck.mockResolvedValue({ deck: { id: 'new1' } });
    wrap(<FlashcardCreatePage />);

    const generate = screen.getByRole('button', { name: 'Generate flashcards' });
    expect(generate).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Topic or subject'), { target: { value: 'Cells' } });
    expect(generate).toBeEnabled();
    fireEvent.click(generate);

    expect(await screen.findByText('Review your flashcards')).toBeInTheDocument();
    expect(api.generateCards).toHaveBeenCalledWith(expect.objectContaining({ topic: 'Cells', difficulty: 'intermediate', cardStyle: 'qa', count: 10 }));
    expect(screen.getByText(/1 generated cards were skipped/)).toBeInTheDocument();
    expect(screen.getByText(/returned 2 of the 5 cards/)).toBeInTheDocument();
    expect(screen.getByLabelText('Deck title')).toHaveValue('Cells');

    // edit one card, remove the other's sibling flow
    fireEvent.change(screen.getAllByLabelText('Front (question or term)')[0], { target: { value: 'What does ATP stand for?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove card 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save deck' }));

    await waitFor(() => expect(api.createDeck).toHaveBeenCalledTimes(1));
    expect(api.createDeck).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Cells', source: 'topic', difficulty: 'intermediate', cardStyle: 'qa',
      cards: [{ front: 'What does ATP stand for?', back: 'Energy currency' }],
    }));
  });

  it('scrolls back to the top when moving between the setup form and the review list', async () => {
    api.generateCards.mockResolvedValue(generated);
    wrap(<FlashcardCreatePage />);
    expect(window.scrollTo).not.toHaveBeenCalled(); // nothing on first render

    fireEvent.change(screen.getByLabelText('Topic or subject'), { target: { value: 'Cells' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate flashcards' }));
    await screen.findByText('Review your flashcards');
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0);

    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    await screen.findByRole('button', { name: 'Generate flashcards' });
    expect(window.scrollTo).toHaveBeenCalledTimes(2);
  });

  it('blocks saving an empty deck or an invalid card and shows a clear message', async () => {
    wrap(<FlashcardCreatePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Start with an empty deck' }));
    fireEvent.change(screen.getByLabelText('Deck title'), { target: { value: 'My deck' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save deck' }));
    expect(await screen.findByText('Every card needs a front and a back.')).toBeInTheDocument();
    expect(api.createDeck).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Remove card 1' }));
    expect(screen.getByText('Add at least one card before saving.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save deck' }));
    expect(api.createDeck).not.toHaveBeenCalled();
  });

  it('shows a readable error when generation fails and keeps the inputs for another try', async () => {
    api.generateCards.mockRejectedValue({ response: { status: 502, data: { message: 'The AI returned an unreadable response. Please try again.' } } });
    wrap(<FlashcardCreatePage />);
    fireEvent.change(screen.getByLabelText('Topic or subject'), { target: { value: 'Cells' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate flashcards' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText('Topic or subject')).toHaveValue('Cells');
    expect(screen.getByRole('button', { name: 'Generate flashcards' })).toBeEnabled();
  });

  it('prevents duplicate saves while a save is in flight', async () => {
    let resolveSave;
    api.createDeck.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
    wrap(<FlashcardCreatePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Start with an empty deck' }));
    fireEvent.change(screen.getByLabelText('Deck title'), { target: { value: 'Quick' } });
    fireEvent.change(screen.getByLabelText('Front (question or term)'), { target: { value: 'Q?' } });
    fireEvent.change(screen.getByLabelText('Back (answer)'), { target: { value: 'A' } });
    const save = screen.getByRole('button', { name: 'Save deck' });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(api.createDeck).toHaveBeenCalledTimes(1));
    resolveSave({ deck: { id: 'x' } });
  });
});
