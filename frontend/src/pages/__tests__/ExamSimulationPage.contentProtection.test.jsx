import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExamSimulationPage from '../ExamSimulationPage';
import api from '../../api/client';
import { getExamSession, submitExamSession } from '../../api/examClient';
import { reportExamViolation } from '../../api/examProctoringClient';
import { loadFaceDetector } from '../../lib/faceDetector';

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

vi.mock('../../lib/faceDetector', () => ({
  loadFaceDetector: vi.fn(),
}));

vi.mock('../../api/examProctoringClient', () => ({
  buildViolationEventId: () => `evt-${Math.random()}`,
  reportExamViolation: vi.fn(),
}));

const buildActiveSession = (overrides = {}) => ({
  sessionId: 'session-1',
  sessionToken: 'token-1',
  requestNonce: 'nonce-1',
  status: 'active',
  examType: 'NEET',
  mode: 'full-length',
  strictNavigation: false,
  behavior: { modeExplanation: 'Test behavior.' },
  serverNow: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  timeLeftSec: 3600,
  timeLimitSec: 3600,
  currentQuestionIndex: 0,
  questionCount: 1,
  version: 1,
  intentLedger: {},
  responses: [],
  violationCount: 0,
  maximumViolations: 5,
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
  ...overrides,
});

const createFakeCamera = () => {
  const track = new EventTarget();
  track.readyState = 'live';
  track.muted = false;
  track.stop = vi.fn(() => {
    track.readyState = 'ended';
  });
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  };
  return { track, stream };
};

let camera;
const installMediaDevices = (getUserMedia) => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
};

const renderExam = () =>
  render(
    <MemoryRouter initialEntries={['/exam-simulation']}>
      <Routes>
        <Route path="/exam-simulation" element={<ExamSimulationPage />} />
        <Route path="/exam-simulation/result" element={<div>RESULT PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );

const startExam = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Start Exam Simulation' }));
  await screen.findByText('Choose the correct option.');
};

describe('ExamSimulationPage content protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(4);
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(640);
    localStorage.clear();
    loadFaceDetector.mockResolvedValue({ hasFace: async () => true });

    camera = createFakeCamera();
    installMediaDevices(vi.fn().mockResolvedValue(camera.stream));

    const session = buildActiveSession();
    api.get.mockResolvedValue({ data: { session: null } });
    api.post.mockResolvedValue({ data: session });
    getExamSession.mockResolvedValue(session);
    reportExamViolation.mockImplementation(async () => ({ recorded: true }));
    submitExamSession.mockResolvedValue({ data: { submittedAt: new Date().toISOString() } });
  });

  it('marks question and option text as protected, blocks copy/context-menu, and keeps options clickable', async () => {
    renderExam();
    await startExam();

    const questionText = screen.getByText('Choose the correct option.');
    expect(questionText).toHaveClass('question-protected-content');

    const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
    questionText.dispatchEvent(copyEvent);
    expect(copyEvent.defaultPrevented).toBe(true);

    const contextMenuEvent = new Event('contextmenu', { bubbles: true, cancelable: true });
    questionText.dispatchEvent(contextMenuEvent);
    expect(contextMenuEvent.defaultPrevented).toBe(true);

    const optionSpan = screen.getByText('Option A');
    expect(optionSpan).toHaveClass('question-protected-content');
    const dragEvent = new Event('dragstart', { bubbles: true, cancelable: true });
    optionSpan.dispatchEvent(dragEvent);
    expect(dragEvent.defaultPrevented).toBe(true);

    // Selecting an answer must still work normally.
    const optionButton = optionSpan.closest('button');
    fireEvent.click(optionButton);
    await waitFor(() => expect(optionButton).toHaveClass('selected'));

    // Timer/violation UI must still be present and functioning (untouched by
    // this change).
    expect(screen.getByRole('status', { name: /Focus violations/ })).toHaveTextContent('0 / 5');
  });
});