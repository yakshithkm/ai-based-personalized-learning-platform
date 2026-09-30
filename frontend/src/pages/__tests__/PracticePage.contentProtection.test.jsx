import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PracticePage from '../PracticePage';
import { AuthProvider } from '../../context/AuthContext';
import { ToastProvider } from '../../context/ToastContext';

const mockQuestion = {
  _id: 'q1',
  text: 'What is the SI unit of force?',
  subject: 'Physics',
  topic: 'Laws of Motion',
  difficulty: 'Easy',
  options: ['Newton', 'Joule', 'Watt', 'Pascal'],
};

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/questions/subjects-topics') {
        return Promise.resolve({ data: { subjects: [{ subject: 'Physics', topics: ['Laws of Motion'] }] } });
      }
      if (url === '/questions') {
        return Promise.resolve({ data: { questions: [mockQuestion] } });
      }
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
  API_BASE_URL: 'http://localhost:5000/api',
}));

const renderPracticePage = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <PracticePage />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );

describe('PracticePage content protection', () => {
  it('marks question and option text as protected, and copy/context-menu are prevented, while options stay clickable', async () => {
    localStorage.setItem('token', 'test-token');

    renderPracticePage();

    fireEvent.click(await screen.findByText('Start Practice'));

    const questionText = await screen.findByText(mockQuestion.text);
    expect(questionText).toHaveClass('question-protected-content');

    // Copy/cut/drag/context-menu on the protected text must be prevented.
    const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
    questionText.dispatchEvent(copyEvent);
    expect(copyEvent.defaultPrevented).toBe(true);

    const contextMenuEvent = new Event('contextmenu', { bubbles: true, cancelable: true });
    questionText.dispatchEvent(contextMenuEvent);
    expect(contextMenuEvent.defaultPrevented).toBe(true);

    // Every option's text is protected too.
    const optionSpan = screen.getByText('Newton');
    expect(optionSpan).toHaveClass('question-protected-content');
    const optionCopyEvent = new Event('copy', { bubbles: true, cancelable: true });
    optionSpan.dispatchEvent(optionCopyEvent);
    expect(optionCopyEvent.defaultPrevented).toBe(true);

    // Critical requirement: clicking the option must still select it, even
    // though its text is unselectable/uncopyable.
    const optionButton = optionSpan.closest('button');
    fireEvent.click(optionButton);
    await waitFor(() => expect(optionButton).toHaveClass('selected'));

    // Submitting must still be enabled once an option is selected.
    expect(screen.getByText('Submit Answer')).not.toBeDisabled();

    localStorage.removeItem('token');
  });
});