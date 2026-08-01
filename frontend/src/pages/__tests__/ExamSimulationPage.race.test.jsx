import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

const buildActiveSession = () => ({
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
  version: 1,
  intentLedger: {},
  responses: [],
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

describe('ExamSimulationPage race handling', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    localStorage.clear();

    api.get.mockResolvedValue({ data: { session: null } });

    const baseSession = buildActiveSession();
    api.post.mockResolvedValue({ data: baseSession });
    getExamSession.mockResolvedValue(baseSession);

    submitExamAnswer.mockImplementation(async ({ payload }) => {
      const session = buildActiveSession();
      return {
        data: {
          ...session,
          version: Number(payload.intentSeq || 1),
          intentId: payload.intentId,
          intentSeq: Number(payload.intentSeq || 1),
          currentQuestionIndex: 0,
          responses: [
            {
              questionIndex: 0,
              selectedAnswerIndex: payload.selectedAnswerIndex,
            },
          ],
          intentLedger: {
            'q-1': {
              lastAcceptedIntentSeq: Number(payload.intentSeq || 1),
            },
          },
        },
        __examMeta: {
          didRetry: false,
        },
      };
    });
  });

  it('keeps only the latest rapid answer intent for the same question', async () => {
    render(
      <MemoryRouter>
        <ExamSimulationPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Start Exam Simulation' }));
    await screen.findByText('Choose the correct option.');

    fireEvent.click(screen.getByRole('button', { name: 'Option A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Option B' }));

    await waitFor(() => {
      expect(submitExamAnswer).toHaveBeenCalledTimes(1);
    }, { timeout: 2500 });

    const firstCallPayload = submitExamAnswer.mock.calls[0][0].payload;
    expect(firstCallPayload.selectedAnswerIndex).toBe(1);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Option B' })).toHaveClass('selected');
    });
  });
});
