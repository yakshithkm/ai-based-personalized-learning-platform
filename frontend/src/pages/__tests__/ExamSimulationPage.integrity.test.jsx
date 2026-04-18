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
  questionCount: 1,
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
  ],
});

const getDebugMetric = (label) => {
  const panelTitle = screen.queryByText('Intent Debug');
  if (!panelTitle) return null;
  const panel = panelTitle.closest('section');
  const rowLabel = within(panel).queryByText(label);
  if (!rowLabel) return null;
  return rowLabel.parentElement?.querySelector('strong')?.textContent?.trim() || null;
};

const openDebugPanelIfAvailable = async () => {
  const toggle = screen.queryByRole('button', { name: /Show Debug Panel|Hide Debug Panel/i });
  if (toggle && /show/i.test(toggle.textContent || '')) {
    fireEvent.click(toggle);
  }
};

const startSimulation = async () => {
  render(
    <MemoryRouter>
      <ExamSimulationPage />
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Start Exam Simulation' }));
  await screen.findByText('Choose the correct option.');
  await openDebugPanelIfAvailable();
};

const flushDebounce = async (ms = 350) => {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  });
};

describe('ExamSimulationPage integrity failure handling', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    localStorage.clear();

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

  it('TEST 1: handles stale out-of-order response without overwriting newer selection', async () => {
    const first = createDeferred();
    const second = createDeferred();

    submitExamAnswer
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    await startSimulation();

    fireEvent.click(screen.getByRole('button', { name: 'Option A' }));
    await flushDebounce();
    await waitFor(() => expect(submitExamAnswer).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Option B' }));

    first.resolve({
      data: buildSession({
        selectedAnswerIndex: 0,
        version: 4,
        intentId: 'stale-intent',
        intentSeq: 1,
        ledgerSeq: 1,
      }),
      __examMeta: { didRetry: false },
    });
    await act(async () => {
      await first.promise;
    });

    fireEvent.click(screen.getByRole('button', { name: 'Option B' }));
    await flushDebounce();
    await waitFor(() => expect(submitExamAnswer).toHaveBeenCalledTimes(2));

    const secondPayload = submitExamAnswer.mock.calls[1][0].payload;
    second.resolve({
      data: buildSession({
        selectedAnswerIndex: 1,
        version: 5,
        intentId: secondPayload.intentId,
        intentSeq: secondPayload.intentSeq,
        ledgerSeq: secondPayload.intentSeq,
      }),
      __examMeta: { didRetry: false },
    });
    await act(async () => {
      await second.promise;
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Option B' })).toHaveClass('selected');
      expect(screen.getByRole('button', { name: 'Option A' })).not.toHaveClass('selected');
    });
  });

  it('TEST 2: rejects intentId mismatch response and triggers refetch', async () => {
    const refetched = buildSession({
      selectedAnswerIndex: 1,
      version: 10,
      intentId: 'server-refetch',
      intentSeq: 2,
      ledgerSeq: 2,
    });
    const refetchDeferred = createDeferred();

    getExamSession.mockReturnValueOnce(refetchDeferred.promise);
    submitExamAnswer.mockImplementationOnce(async ({ payload }) => ({
      data: buildSession({
        selectedAnswerIndex: 0,
        version: 9,
        intentId: `wrong-${payload.intentId}`,
        intentSeq: payload.intentSeq,
        ledgerSeq: payload.intentSeq,
      }),
      __examMeta: { didRetry: false },
    }));

    await startSimulation();
    fireEvent.click(screen.getByRole('button', { name: 'Option B' }));
    await flushDebounce();

    await waitFor(() => expect(getExamSession).toHaveBeenCalledTimes(1));
    expect(screen.getAllByText('Resyncing...').length).toBeGreaterThanOrEqual(1);

    refetchDeferred.resolve(refetched);
    await act(async () => {
      await refetchDeferred.promise;
    });

    await waitFor(() => {
      expect(screen.queryAllByText('Resyncing...').length).toBe(0);
      expect(screen.getByRole('button', { name: 'Option B' })).toHaveClass('selected');
    });

    const mismatchCount = getDebugMetric('Mismatch count');
    if (mismatchCount !== null) {
      expect(Number(mismatchCount)).toBeGreaterThanOrEqual(1);
    }
  });

  it('TEST 3: rejects version rollback response and resyncs without UI rollback', async () => {
    const refetched = buildSession({
      selectedAnswerIndex: 1,
      version: 12,
      intentId: 'refetch-intent',
      intentSeq: 2,
      ledgerSeq: 2,
    });

    api.post.mockResolvedValueOnce({ data: buildSession({ version: 11 }) });
    getExamSession.mockResolvedValueOnce(refetched);
    submitExamAnswer.mockImplementationOnce(async ({ payload }) => ({
      data: buildSession({
        selectedAnswerIndex: 0,
        version: 10,
        intentId: payload.intentId,
        intentSeq: payload.intentSeq,
        ledgerSeq: payload.intentSeq,
      }),
      __examMeta: { didRetry: false },
    }));

    await startSimulation();
    fireEvent.click(screen.getByRole('button', { name: 'Option B' }));
    await flushDebounce();

    await waitFor(() => {
      expect(getExamSession).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Option B' })).toHaveClass('selected');
      expect(screen.getByRole('button', { name: 'Option A' })).not.toHaveClass('selected');
    });

    const mismatchCount = getDebugMetric('Mismatch count');
    if (mismatchCount !== null) {
      expect(Number(mismatchCount)).toBeGreaterThanOrEqual(1);
    }
  });

  it('TEST 4: multi-click spam keeps final option stable under random response latency', async () => {
    submitExamAnswer.mockImplementation(async ({ payload }) => {
      const jitterMs = Math.floor(Math.random() * 500);
      await new Promise((resolve) => {
        setTimeout(resolve, jitterMs);
      });
      return {
        data: buildSession({
          selectedAnswerIndex: payload.selectedAnswerIndex,
          version: Number(payload.intentSeq || 1) + 20,
          intentId: payload.intentId,
          intentSeq: Number(payload.intentSeq || 1),
          ledgerSeq: Number(payload.intentSeq || 1),
        }),
        __examMeta: { didRetry: false },
      };
    });

    await startSimulation();

    const clickOrder = ['Option A', 'Option C', 'Option B', 'Option D', 'Option B'];
    for (const name of clickOrder) {
      fireEvent.click(screen.getByRole('button', { name }));
      await flushDebounce(120);
    }

    await flushDebounce(600);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Option B' })).toHaveClass('selected');
      expect(screen.getByRole('button', { name: 'Option A' })).not.toHaveClass('selected');
      expect(screen.getByRole('button', { name: 'Option C' })).not.toHaveClass('selected');
      expect(screen.getByRole('button', { name: 'Option D' })).not.toHaveClass('selected');
    });
  });

  it('TEST 5: locks UI during resync and unlocks after fetch completes', async () => {
    const refetchDeferred = createDeferred();
    getExamSession.mockReturnValueOnce(refetchDeferred.promise);

    submitExamAnswer.mockImplementationOnce(async ({ payload }) => ({
      data: buildSession({
        selectedAnswerIndex: 0,
        version: 9,
        intentId: `invalid-${payload.intentId}`,
        intentSeq: payload.intentSeq,
        ledgerSeq: payload.intentSeq,
      }),
      __examMeta: { didRetry: false },
    }));

    await startSimulation();
    fireEvent.click(screen.getByRole('button', { name: 'Option B' }));
    await flushDebounce();

    await waitFor(() => expect(getExamSession).toHaveBeenCalledTimes(1));

    const optionA = screen.getByRole('button', { name: 'Option A' });
    const optionB = screen.getByRole('button', { name: 'Option B' });

    expect(optionA).toBeDisabled();
    expect(optionB).toBeDisabled();
    expect(screen.getAllByText('Resyncing...').length).toBeGreaterThanOrEqual(1);

    refetchDeferred.resolve(
      buildSession({
        selectedAnswerIndex: 1,
        version: 14,
        intentId: 'after-resync',
        intentSeq: 2,
        ledgerSeq: 2,
      })
    );
    await act(async () => {
      await refetchDeferred.promise;
    });

    await waitFor(() => {
      expect(screen.queryAllByText('Resyncing...').length).toBe(0);
      expect(screen.getByRole('button', { name: 'Option A' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Option B' })).not.toBeDisabled();
    });

    const pendingCount = getDebugMetric('Pending requests');
    if (pendingCount !== null) {
      expect(Number(pendingCount)).toBe(0);
    }

    const confirmedIntentSeq = getDebugMetric('Last confirmed intentSeq');
    if (confirmedIntentSeq !== null) {
      expect(Number(confirmedIntentSeq)).toBeGreaterThanOrEqual(0);
    }
  });
});
