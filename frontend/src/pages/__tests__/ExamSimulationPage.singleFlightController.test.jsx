import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const deferred = () => {
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
  behavior: { modeExplanation: 'Test behavior.' },
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
    'q-1': { lastAcceptedIntentSeq: ledgerSeq },
  },
  responses: Number.isInteger(selectedAnswerIndex)
    ? [{ questionIndex: 0, selectedAnswerIndex }]
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

describe('ExamSimulationPage centralized single-flight controller', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    api.get.mockResolvedValue({ data: { session: null } });
    api.post.mockResolvedValue({ data: buildSession({ version: 2 }) });
    getExamSession.mockResolvedValue(buildSession({ selectedAnswerIndex: 0, version: 3, ledgerSeq: 1 }));

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

  it('20 rapid Save and Next clicks still produce exactly one submit call', async () => {
    const pending = deferred();
    submitExamAnswer.mockReturnValueOnce(pending.promise);

    await startSimulation();

    fireEvent.click(screen.getByRole('button', { name: 'Option A' }));
    await act(() => Promise.resolve());

    const saveBtn = screen.getByRole('button', { name: 'Save & Next' });
    for (let i = 0; i < 20; i += 1) {
      fireEvent.click(saveBtn);
    }

    await act(async () => {
      pending.resolve({
        data: buildSession({ selectedAnswerIndex: 0 }),
        __examMeta: { didRetry: false },
      });
    });

    await waitFor(() => {
      expect(submitExamAnswer).toHaveBeenCalledTimes(1);
    });
  });

  it('save spam mixed with palette clicks still reuses one in-flight request', async () => {
    const pending = deferred();
    submitExamAnswer.mockReturnValueOnce(pending.promise);

    await startSimulation();

    fireEvent.click(screen.getByRole('button', { name: 'Option B' }));
    await act(() => Promise.resolve());

    const saveBtn = screen.getByRole('button', { name: 'Save & Next' });

    fireEvent.click(saveBtn);
    fireEvent.click(saveBtn);

    const q2PaletteBtn = screen
      .getAllByRole('button')
      .find((btn) => btn.querySelector('.palette-number')?.textContent === '2');

    if (q2PaletteBtn) {
      fireEvent.click(q2PaletteBtn);
      fireEvent.click(q2PaletteBtn);
    }

    fireEvent.click(saveBtn);
    fireEvent.click(saveBtn);

    await act(async () => {
      pending.resolve({
        data: buildSession({ selectedAnswerIndex: 1 }),
        __examMeta: { didRetry: false },
      });
    });

    await waitFor(() => {
      expect(submitExamAnswer).toHaveBeenCalledTimes(1);
    });
  });
});
