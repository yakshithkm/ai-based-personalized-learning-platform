import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExamSimulationPage from '../ExamSimulationPage';
import api from '../../api/client';
import { getExamSession, submitExamAnswer } from '../../api/examClient';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { targetExam: 'NEET' } }),
}));

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../api/examClient', () => ({
  clearExamSessionAuth: vi.fn(),
  getExamSession: vi.fn(),
  setExamSessionAuth: vi.fn(),
  setLatestVersion: vi.fn(),
  submitExamAnswer: vi.fn(),
  submitExamSession: vi.fn(),
}));

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const buildSession = ({
  selectedAnswerIndex,
  version = 1,
  intentId = '',
  intentSeq = 0,
  ledgerSeq = 0,
} = {}) => ({
  sessionId: 'session-1',
  sessionToken: 'token-1',
  requestNonce: 'nonce-1',
  status: 'active',
  examType: 'NEET',
  mode: 'full-length',
  strictNavigation: true,
  behavior: {
    modeExplanation: 'Test behavior.',
  },
  serverNow: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  timeLeftSec: 3600,
  timeLimitSec: 3600,
  currentQuestionIndex: 0,
  questionCount: 3,
  version,
  intentId,
  intentSeq,
  intentLedger: {
    'q-1': {
      lastAcceptedIntentSeq: ledgerSeq,
    },
  },
  responses: Number.isInteger(selectedAnswerIndex)
    ? [
        {
          questionIndex: 0,
          selectedAnswerIndex,
        },
      ]
    : [],
  questions: [
    {
      _id: 'q-1',
      subject: 'Physics',
      topic: 'Mechanics',
      text: 'Choose the correct option.',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      difficulty: 'medium',
      difficultyLevel: 'Medium',
      weightage: 'Medium',
      isPreviousYear: false,
    },
    {
      _id: 'q-2',
      subject: 'Physics',
      topic: 'Dynamics',
      text: 'Choose the correct option.',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      difficulty: 'medium',
      difficultyLevel: 'Medium',
      weightage: 'Medium',
      isPreviousYear: false,
    },
    {
      _id: 'q-3',
      subject: 'Physics',
      topic: 'Optics',
      text: 'Choose the correct option.',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      difficulty: 'medium',
      difficultyLevel: 'Medium',
      weightage: 'Medium',
      isPreviousYear: false,
    },
  ],
});

const startSimulation = async () => {
  render(
    <MemoryRouter>
      <ExamSimulationPage />
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Start Exam Simulation' }));
  await screen.findByText('Choose the correct option.');
};

describe('ExamSimulationPage - Single-Flight & Rate-Limit Handling', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    api.get.mockResolvedValue({ data: { session: null } });
    api.post.mockResolvedValue({ data: buildSession({ version: 2 }) });
    getExamSession.mockResolvedValue(buildSession({ selectedAnswerIndex: 1, version: 3, ledgerSeq: 2 }));

    submitExamAnswer.mockImplementation(async ({ payload }) => ({
      data: buildSession({
        selectedAnswerIndex: payload.selectedAnswerIndex,
        version: Number(payload.intentSeq || 1) + 2,
        intentId: payload.intentId,
        intentSeq: Number(payload.intentSeq || 1),
        ledgerSeq: Number(payload.intentSeq || 1),
      }),
      __examMeta: { didRetry: false },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('🔒 SINGLE-FLIGHT LOCK: Only ONE API call fires despite 10 rapid clicks', async () => {
    const saveDeferred = createDeferred();
    submitExamAnswer.mockReturnValueOnce(saveDeferred.promise);

    await startSimulation();

    // Simulate selecting option
    fireEvent.click(screen.getByRole('button', { name: 'Option A' }));
    await act(() => Promise.resolve());

    // Simulate 10 rapid clicks on "Save & Next"
    const saveNextBtn = screen.getByRole('button', { name: 'Save & Next' });
    for (let i = 0; i < 10; i++) {
      fireEvent.click(saveNextBtn);
      // No await between clicks to simulate rapid fire
    }

    // Resolve the deferred promise
    await act(async () => {
      saveDeferred.resolve({
        data: buildSession({ selectedAnswerIndex: 0 }),
        __examMeta: { didRetry: false },
      });
    });

    await waitFor(() => {
      expect(submitExamAnswer).toHaveBeenCalledTimes(1);
    });
  });

  it('🔒 SINGLE-FLIGHT LOCK: Button becomes disabled during submission', async () => {
    const saveDeferred = createDeferred();
    submitExamAnswer.mockReturnValueOnce(saveDeferred.promise);

    await startSimulation();

    fireEvent.click(screen.getByRole('button', { name: 'Option A' }));
    await act(() => Promise.resolve());

    const saveNextBtn = screen.getByRole('button', { name: 'Save & Next' });

    // Before click, button should be enabled
    expect(saveNextBtn).not.toBeDisabled();

    // Click the button
    fireEvent.click(saveNextBtn);
    await act(() => Promise.resolve());

    // Button should be disabled during submission
    await waitFor(() => {
      expect(saveNextBtn).toBeDisabled();
    });

    // Button text should show "Saving..."
    expect(saveNextBtn).toHaveTextContent('Saving...');

    // Resolve to unlock
    await act(async () => {
      saveDeferred.resolve({
        data: buildSession({ selectedAnswerIndex: 0 }),
        __examMeta: { didRetry: false },
      });
    });

    await waitFor(() => {
      expect(saveNextBtn).not.toBeDisabled();
    });
  });

  it('locks Previous, palette, and option selection while the save is active, then releases after success', async () => {
    const saveDeferred = createDeferred();
    let capturedPayload = null;
    submitExamAnswer.mockImplementationOnce(async ({ payload }) => {
      capturedPayload = payload;
      return saveDeferred.promise;
    });

    await startSimulation();

    fireEvent.click(screen.getByRole('button', { name: 'Option A' }));
    await act(() => Promise.resolve());

    const saveNextBtn = screen.getByRole('button', { name: 'Save & Next' });
    fireEvent.click(saveNextBtn);
    await act(() => Promise.resolve());

    const previousBtn = screen.getByRole('button', { name: 'Previous' });
    const optionBBtn = screen.getByRole('button', { name: 'Option B' });
    const paletteBtn2 = screen
      .getAllByRole('button')
      .find((btn) => btn.querySelector('.palette-number')?.textContent === '2');

    await waitFor(() => {
      expect(saveNextBtn).toBeDisabled();
      expect(saveNextBtn).toHaveTextContent('Saving...');
    });
    expect(previousBtn).toBeDisabled();
    expect(optionBBtn).toBeDisabled();
    expect(paletteBtn2).toBeDisabled();

    fireEvent.click(previousBtn);
    fireEvent.click(optionBBtn);
    fireEvent.click(paletteBtn2);

    expect(submitExamAnswer).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Mechanics')).toBeInTheDocument();

    await act(async () => {
      saveDeferred.resolve({
        data: buildSession({
          selectedAnswerIndex: 0,
          version: 3,
          intentId: capturedPayload?.intentId,
          intentSeq: Number(capturedPayload?.intentSeq || 1),
          ledgerSeq: Number(capturedPayload?.intentSeq || 1),
        }),
        __examMeta: { didRetry: false },
      });
    });

    await waitFor(() => {
      expect(previousBtn).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Option B' })).not.toBeDisabled();
      expect(
        screen
          .getAllByRole('button')
          .find((btn) => btn.querySelector('.palette-number')?.textContent === '2')
      ).not.toBeDisabled();
    });
  });

  it('clicking the already-selected option does not trigger another save', async () => {
    getExamSession.mockResolvedValue(buildSession({ selectedAnswerIndex: 0, version: 3, ledgerSeq: 1 }));
    submitExamAnswer.mockImplementationOnce(async ({ payload }) => ({
      data: buildSession({
        selectedAnswerIndex: payload.selectedAnswerIndex,
        version: 3,
        intentId: payload.intentId,
        intentSeq: Number(payload.intentSeq || 1),
        ledgerSeq: Number(payload.intentSeq || 1),
      }),
      __examMeta: { didRetry: false },
    }));

    await startSimulation();

    fireEvent.click(screen.getByRole('button', { name: 'Option A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save & Next' }));

    await waitFor(() => {
      expect(screen.getByText('Dynamics')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

    await waitFor(() => {
      expect(screen.getByText('Mechanics')).toBeInTheDocument();
    });

    expect(submitExamAnswer).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Option A' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(submitExamAnswer).toHaveBeenCalledTimes(1);
  });

  it('save failure styling is applied only to the selected option', async () => {
    submitExamAnswer.mockRejectedValueOnce({
      response: {
        status: 500,
        data: { message: 'Server error.' },
      },
    });

    await startSimulation();

    fireEvent.click(screen.getByRole('button', { name: 'Option A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save & Next' }));

    await waitFor(
      () => {
        expect(document.querySelector('.exam-question-state-line')).toHaveTextContent('Failed');
      },
      { timeout: 3000 }
    );

    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save & Next' })).not.toBeDisabled();

    expect(screen.getByRole('button', { name: 'Option A' })).toHaveClass('failed');
    expect(screen.getByRole('button', { name: 'Option B' })).not.toHaveClass('failed');
    expect(screen.getByRole('button', { name: 'Option C' })).not.toHaveClass('failed');
    expect(screen.getByRole('button', { name: 'Option D' })).not.toHaveClass('failed');
  });

  it('skips mutation on already-confirmed answer and only navigates next', async () => {
    const saveDeferred = createDeferred();
    let capturedPayload = null;
    submitExamAnswer.mockImplementationOnce(async ({ payload }) => {
      capturedPayload = payload;
      return saveDeferred.promise;
    });

    await startSimulation();

    fireEvent.click(screen.getByRole('button', { name: 'Option A' }));
    await act(() => Promise.resolve());
    fireEvent.click(screen.getByRole('button', { name: 'Save & Next' }));

    await act(async () => {
      saveDeferred.resolve({
        data: buildSession({
          selectedAnswerIndex: 0,
          version: 3,
          intentId: capturedPayload?.intentId,
          intentSeq: Number(capturedPayload?.intentSeq || 1),
          ledgerSeq: Number(capturedPayload?.intentSeq || 1),
        }),
        __examMeta: { didRetry: false },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Dynamics')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

    await waitFor(() => {
      expect(screen.getByText('Mechanics')).toBeInTheDocument();
    });

    expect(submitExamAnswer).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Save & Next' }));

    await waitFor(() => {
      expect(screen.getByText('Dynamics')).toBeInTheDocument();
    });

    expect(submitExamAnswer).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Session state mismatch detected. State refreshed.')).not.toBeInTheDocument();
    expect(screen.queryByText('Failed to save. Please try again.')).not.toBeInTheDocument();
  });

  it('⛔ 429 RATE LIMIT: Cooldown activates on 429 error', async () => {
    submitExamAnswer.mockRejectedValueOnce({
      response: {
        status: 429,
        data: { message: 'Too many attempts.' },
      },
    });

    await startSimulation();

    fireEvent.click(screen.getByRole('button', { name: 'Option A' }));
    await act(() => Promise.resolve());

    const saveNextBtn = screen.getByRole('button', { name: 'Save & Next' });
    fireEvent.click(saveNextBtn);

    // Wait for 429 error and cooldown activation
    await waitFor(() => {
      // Button should show countdown like "Wait 3s"
      expect(saveNextBtn.textContent).toMatch(/^Wait \d+s$/);
      expect(saveNextBtn).toBeDisabled();
    });
  });

  it('⛔ 429 RATE LIMIT: Cooldown counts down properly', async () => {
    submitExamAnswer.mockRejectedValueOnce({
      response: {
        status: 429,
        data: { message: 'Too many attempts.' },
      },
    });

    await startSimulation();

    fireEvent.click(screen.getByRole('button', { name: 'Option A' }));
    await act(() => Promise.resolve());

    fireEvent.click(screen.getByRole('button', { name: 'Save & Next' }));

    // Wait for cooldown to activate
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Wait \d+s$/ })).toBeDisabled();
    });

    const saveNextBtn = screen.getByRole('button', { name: /^Wait \d+s$/ });
    expect(screen.getByRole('button', { name: 'Option A' })).toHaveClass('failed');
    expect(screen.getByRole('button', { name: 'Option B' })).not.toHaveClass('failed');
    expect(screen.getByRole('button', { name: 'Option C' })).not.toHaveClass('failed');
    expect(screen.getByRole('button', { name: 'Option D' })).not.toHaveClass('failed');

    // Wait for first countdown (3 -> 2)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    await waitFor(() => {
      expect(saveNextBtn).toHaveTextContent('Wait 2s');
    });

    // Wait for second countdown (2 -> 1)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    await waitFor(() => {
      expect(saveNextBtn).toHaveTextContent('Wait 1s');
    });

    // Wait for third countdown (1 -> 0, release)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    await waitFor(() => {
      expect(saveNextBtn).toHaveTextContent('Save & Next');
      expect(saveNextBtn).not.toBeDisabled();
    });
  });

  it('⛔ 429 RATE LIMIT: Error message displayed on 429', async () => {
    submitExamAnswer.mockRejectedValueOnce({
      response: {
        status: 429,
        data: { message: 'Too many attempts.' },
      },
    });

    await startSimulation();

    fireEvent.click(screen.getByRole('button', { name: 'Option A' }));
    await act(() => Promise.resolve());

    fireEvent.click(screen.getByRole('button', { name: 'Save & Next' }));

    await waitFor(() => {
      expect(screen.getByText('Too many attempts. Please wait.')).toBeInTheDocument();
    });
  });

  it('🚫 NO ADVANCE ON FAILURE: Question does not advance on 429 error', async () => {
    submitExamAnswer.mockRejectedValueOnce({
      response: {
        status: 429,
      },
    });

    await startSimulation();

    // Select answer on Q1
    fireEvent.click(screen.getByRole('button', { name: 'Option A' }));
    await act(() => Promise.resolve());

    // Try to save
    fireEvent.click(screen.getByRole('button', { name: 'Save & Next' }));

    // Wait for error
    await waitFor(() => {
      expect(screen.getByText('Too many attempts. Please wait.')).toBeInTheDocument();
    });

    // Should stay on Q1 - verify by checking palette current state
    const paletteBtns = screen.getAllByRole('button').filter((btn) => {
      const num = btn.querySelector('.palette-number');
      return num && num.textContent === '1';
    });
    expect(paletteBtns[0]).toHaveClass('current');
  });

  it('🚫 NO ADVANCE ON FAILURE: Question stays the same after generic error', async () => {
    submitExamAnswer.mockRejectedValueOnce({
      response: {
        status: 500,
        data: { message: 'Server error.' },
      },
    });

    await startSimulation();

    fireEvent.click(screen.getByRole('button', { name: 'Option B' }));
    await act(() => Promise.resolve());

    fireEvent.click(screen.getByRole('button', { name: 'Save & Next' }));

    await waitFor(() => {
      expect(screen.getByText('Server error.')).toBeInTheDocument();
    });

    // Verify still on Q1 by checking palette current state
    const paletteBtns = screen.getAllByRole('button').filter((btn) => {
      const num = btn.querySelector('.palette-number');
      return num && num.textContent === '1';
    });
    expect(paletteBtns[0]).toHaveClass('current');
  });

  it('💬 ERROR MESSAGE VISIBLE: Shows inline error on save failure', async () => {
    submitExamAnswer.mockRejectedValueOnce({
      response: {
        status: 503,
        data: { message: 'Service temporarily unavailable.' },
      },
    });

    await startSimulation();

    fireEvent.click(screen.getByRole('button', { name: 'Option C' }));
    await act(() => Promise.resolve());

    fireEvent.click(screen.getByRole('button', { name: 'Save & Next' }));

    await waitFor(() => {
      expect(screen.getByText('Service temporarily unavailable.')).toBeInTheDocument();
    });
  });

  it('🎯 HARD BLOCK + 429: Can click multiple times but only 1 API call, then 3s cooldown', async () => {
    const saveDeferred1 = createDeferred();
    submitExamAnswer.mockReturnValueOnce(saveDeferred1.promise);

    await startSimulation();

    fireEvent.click(screen.getByRole('button', { name: 'Option A' }));
    await act(() => Promise.resolve());

    const saveNextBtn = screen.getByRole('button', { name: 'Save & Next' });

    // Simulate 5 rapid clicks
    for (let i = 0; i < 5; i++) {
      fireEvent.click(saveNextBtn);
    }

    // Reject with 429 after a small delay
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      saveDeferred1.reject({
        response: {
          status: 429,
        },
      });
    });

    // Verify only 1 API call
    await waitFor(() => {
      expect(submitExamAnswer).toHaveBeenCalledTimes(1);
    });

    // Verify button shows cooldown
    await waitFor(() => {
      expect(saveNextBtn.textContent).toMatch(/^Wait \d+s$/);
    });

    // Verify button is disabled during cooldown
    expect(saveNextBtn).toBeDisabled();
  });

  it('✅ SUCCESS: Button re-enabled after successful save', async () => {
    const saveDeferred = createDeferred();
    submitExamAnswer.mockReturnValueOnce(saveDeferred.promise);

    await startSimulation();

    fireEvent.click(screen.getByRole('button', { name: 'Option A' }));
    await act(() => Promise.resolve());

    const saveNextBtn = screen.getByRole('button', { name: 'Save & Next' });

    fireEvent.click(saveNextBtn);

    // Button should be disabled during submission
    await waitFor(() => {
      expect(saveNextBtn).toBeDisabled();
      expect(saveNextBtn).toHaveTextContent('Saving...');
    });

    // Verify API call was made
    expect(submitExamAnswer).toHaveBeenCalledTimes(1);

    // Resolve successfully
    await act(async () => {
      saveDeferred.resolve({
        data: buildSession({ selectedAnswerIndex: 0, version: 3 }),
        __examMeta: { didRetry: false },
      });
    });

    // Button should be re-enabled after success
    await waitFor(() => {
      expect(saveNextBtn).not.toBeDisabled();
      expect(saveNextBtn).toHaveTextContent('Save & Next');
    });
  });
});
