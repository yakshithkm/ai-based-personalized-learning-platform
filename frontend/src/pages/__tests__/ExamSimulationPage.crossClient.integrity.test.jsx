import { act, fireEvent, render, waitFor, within } from '@testing-library/react';
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

const SESSION_ID = 'session-1';

const buildSession = ({
  selectedAnswerIndex,
  version = 1,
  intentId = '',
  intentSeq = 0,
  ledgerSeq = 0,
} = {}) => ({
  sessionId: SESSION_ID,
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

const flushMs = async (ms) => {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  });
};

const snapshotStorage = () => {
  const snap = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    snap[key] = localStorage.getItem(key);
  }
  return snap;
};

const loadStorage = (snap = {}) => {
  localStorage.clear();
  Object.entries(snap).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      localStorage.setItem(key, value);
    }
  });
};

const withoutTabLock = (snap = {}) => {
  const next = { ...snap };
  delete next['exam-active-tab-lock'];
  return next;
};

const getMetricFromContainer = (container, label) => {
  const panelTitle = within(container).queryByText('Intent Debug');
  if (!panelTitle) return null;
  const panel = panelTitle.closest('section');
  const rowLabel = within(panel).queryByText(label);
  if (!rowLabel) return null;
  return rowLabel.parentElement?.querySelector('strong')?.textContent?.trim() || null;
};

const openDebugPanel = async (container) => {
  const toggle = within(container).queryByRole('button', { name: /Show Debug Panel|Hide Debug Panel/i });
  if (toggle && /show/i.test(toggle.textContent || '')) {
    fireEvent.click(toggle);
  }
};

const renderClient = () => {
  return render(
    <MemoryRouter>
      <ExamSimulationPage />
    </MemoryRouter>
  );
};

const startExamForClient = async (container) => {
  fireEvent.click(await within(container).findByRole('button', { name: 'Start Exam Simulation' }));
  await within(container).findByText('Choose the correct option.');
  await openDebugPanel(container);
};

describe('ExamSimulationPage cross-client consistency', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    localStorage.clear();

    api.get.mockResolvedValue({ data: { session: null } });
    api.post.mockResolvedValue({ data: buildSession({ version: 1 }) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('detects cross-client conflict and converges Client A to backend truth', async () => {
    let storageA = {};
    let storageB = {};

    submitExamAnswer.mockImplementation(async ({ payload }) => {
      const isOptionA = Number(payload.selectedAnswerIndex) === 0;
      if (isOptionA) {
        return {
          data: buildSession({
            selectedAnswerIndex: 0,
            version: 2,
            intentId: payload.intentId,
            intentSeq: payload.intentSeq,
            ledgerSeq: 1,
          }),
          __examMeta: { didRetry: false },
        };
      }
      return {
        data: buildSession({
          selectedAnswerIndex: 1,
          version: 4,
          intentId: payload.intentId,
          intentSeq: payload.intentSeq,
          ledgerSeq: 2,
        }),
        __examMeta: { didRetry: false },
      };
    });

    loadStorage({});
    let clientA = renderClient();
    await startExamForClient(clientA.container);

    fireEvent.click(within(clientA.container).getByRole('button', { name: 'Option A' }));
    await flushMs(400);
    await waitFor(() => {
      expect(within(clientA.container).getByRole('button', { name: 'Option A' })).toHaveClass('selected');
    });
    storageA = snapshotStorage();
    clientA.unmount();

    loadStorage({});
    let clientB = renderClient();
    await startExamForClient(clientB.container);

    fireEvent.click(within(clientB.container).getByRole('button', { name: 'Option B' }));
    await flushMs(400);
    await waitFor(() => {
      expect(within(clientB.container).getByRole('button', { name: 'Option B' })).toHaveClass('selected');
    });
    storageB = snapshotStorage();
    expect(Object.keys(storageB).length).toBeGreaterThan(0);
    clientB.unmount();

    getExamSession
      .mockResolvedValueOnce(
        buildSession({
          selectedAnswerIndex: 0,
          version: 2,
          intentId: 'stale-restore-a',
          intentSeq: 1,
          ledgerSeq: 1,
        })
      )
      .mockResolvedValueOnce(
        buildSession({
          selectedAnswerIndex: 1,
          version: 5,
          intentId: 'server-truth-b',
          intentSeq: 2,
          ledgerSeq: 2,
        })
      );

    submitExamAnswer.mockImplementationOnce(async ({ payload }) => ({
      data: buildSession({
        selectedAnswerIndex: 0,
        version: 2,
        intentId: `stale-${payload.intentId}`,
        intentSeq: payload.intentSeq,
        ledgerSeq: 1,
      }),
      __examMeta: { didRetry: false },
    }));

    loadStorage(withoutTabLock(storageA));
    clientA = renderClient();
    await within(clientA.container).findByText('Choose the correct option.');
    await openDebugPanel(clientA.container);

    fireEvent.click(within(clientA.container).getByRole('button', { name: 'Option A' }));
    await flushMs(400);

    await waitFor(() => {
      expect(getExamSession).toHaveBeenCalled();
      expect(within(clientA.container).getByRole('button', { name: 'Option B' })).toHaveClass('selected');
      expect(within(clientA.container).getByRole('button', { name: 'Option A' })).not.toHaveClass('selected');
    });

    const mismatchCount = getMetricFromContainer(clientA.container, 'Mismatch count');
    const lastConfirmedSeq = getMetricFromContainer(clientA.container, 'Last confirmed intentSeq');
    if (mismatchCount !== null) {
      expect(Number(mismatchCount)).toBeGreaterThanOrEqual(1);
    }
    if (lastConfirmedSeq !== null) {
      expect(Number(lastConfirmedSeq)).toBe(2);
    }

    clientA.unmount();
  });

  it('corrects stale confirmed UI after interaction-triggered refetch', async () => {
    let storageA = {};

    submitExamAnswer
      .mockImplementationOnce(async ({ payload }) => ({
        data: buildSession({
          selectedAnswerIndex: 0,
          version: 2,
          intentId: payload.intentId,
          intentSeq: payload.intentSeq,
          ledgerSeq: 1,
        }),
        __examMeta: { didRetry: false },
      }))
      .mockImplementationOnce(async ({ payload }) => ({
        data: buildSession({
          selectedAnswerIndex: 0,
          version: 2,
          intentId: `mismatch-${payload.intentId}`,
          intentSeq: payload.intentSeq,
          ledgerSeq: 1,
        }),
        __examMeta: { didRetry: false },
      }));

    loadStorage({});
    let clientA = renderClient();
    await startExamForClient(clientA.container);

    fireEvent.click(within(clientA.container).getByRole('button', { name: 'Option A' }));
    await flushMs(400);
    await waitFor(() => {
      expect(within(clientA.container).getByRole('button', { name: 'Option A' })).toHaveClass('selected');
    });

    storageA = snapshotStorage();
    clientA.unmount();

    getExamSession
      .mockResolvedValueOnce(
        buildSession({
          selectedAnswerIndex: 0,
          version: 2,
          intentId: 'restore-stale-a',
          intentSeq: 1,
          ledgerSeq: 1,
        })
      )
      .mockResolvedValueOnce(
        buildSession({
          selectedAnswerIndex: 1,
          version: 5,
          intentId: 'backend-correct-b',
          intentSeq: 2,
          ledgerSeq: 2,
        })
      );

    loadStorage(withoutTabLock(storageA));
    clientA = renderClient();
    await within(clientA.container).findByText('Choose the correct option.');
    await openDebugPanel(clientA.container);

    fireEvent.click(within(clientA.container).getByRole('button', { name: 'Option A' }));
    await flushMs(400);

    await waitFor(() => {
      expect(within(clientA.container).getByRole('button', { name: 'Option B' })).toHaveClass('selected');
      expect(within(clientA.container).getByRole('button', { name: 'Option A' })).not.toHaveClass('selected');
    });

    const mismatchCount = getMetricFromContainer(clientA.container, 'Mismatch count');
    const lastConfirmedSeq = getMetricFromContainer(clientA.container, 'Last confirmed intentSeq');
    if (mismatchCount !== null) {
      expect(Number(mismatchCount)).toBeGreaterThanOrEqual(1);
    }
    if (lastConfirmedSeq !== null) {
      expect(Number(lastConfirmedSeq)).toBe(2);
    }

    clientA.unmount();
  });
});
