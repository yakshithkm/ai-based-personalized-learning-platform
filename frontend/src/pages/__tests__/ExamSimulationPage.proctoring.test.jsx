import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExamSimulationPage from '../ExamSimulationPage';
import api from '../../api/client';
import { getExamSession, submitExamSession } from '../../api/examClient';
import { reportExamViolation } from '../../api/examProctoringClient';
import { loadFaceDetector } from '../../lib/faceDetector';
import { PRESENCE_TIMING } from '../../hooks/usePresenceMonitor';

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

// The real detector (TensorFlow.js + model files) is not exercised in jsdom; tests drive it.
vi.mock('../../lib/faceDetector', () => ({
  loadFaceDetector: vi.fn(),
}));

let eventCounter = 0;
vi.mock('../../api/examProctoringClient', () => ({
  buildViolationEventId: () => {
    eventCounter += 1;
    return `evt-${eventCounter}`;
  },
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

// --- Fake camera -------------------------------------------------------------------------
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

// --- Focus helpers ------------------------------------------------------------------------
const setVisibility = (state) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => state === 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
};

let hasFocus = true;
const leaveTab = () => act(() => setVisibility('hidden'));
const returnToTab = () =>
  act(() => {
    setVisibility('visible');
    hasFocus = true;
    window.dispatchEvent(new Event('focus'));
  });

const renderExam = (extra = null, { strict = false } = {}) => {
  const tree = (
    <MemoryRouter initialEntries={['/exam-simulation']}>
      {extra}
      <Routes>
        <Route path="/exam-simulation" element={<ExamSimulationPage />} />
        <Route path="/exam-simulation/result" element={<div>RESULT PAGE</div>} />
        <Route path="/dashboard" element={<div>DASHBOARD PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
};

const startExam = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Start Exam Simulation' }));
  await screen.findByText('Choose the correct option.');
};

const violationText = () => screen.getByRole('status', { name: /Focus violations/ }).textContent;

// --- Presence (face-detector) helpers ---------------------------------------------------------
let facePresent = true;
const originalTiming = { ...PRESENCE_TIMING };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('ExamSimulationPage proctoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    facePresent = true;
    Object.assign(PRESENCE_TIMING, originalTiming);
    loadFaceDetector.mockResolvedValue({ hasFace: async () => facePresent });
    // jsdom has no real video playback: pretend the detached <video> has frames.
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(4);
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(640);
    eventCounter = 0;
    localStorage.clear();
    hasFocus = true;
    vi.spyOn(document, 'hasFocus').mockImplementation(() => hasFocus);
    setVisibility('visible');

    camera = createFakeCamera();
    installMediaDevices(vi.fn().mockResolvedValue(camera.stream));

    const session = buildActiveSession();
    api.get.mockResolvedValue({ data: { session: null } });
    api.post.mockResolvedValue({ data: session });
    getExamSession.mockResolvedValue(session);
    reportExamViolation.mockImplementation(async () => ({ recorded: true }));
    submitExamSession.mockResolvedValue({ data: { submittedAt: new Date().toISOString() } });
  });

  afterEach(() => {
    cleanup(); // unmount while the media spies are still installed
    vi.restoreAllMocks();
    Object.assign(PRESENCE_TIMING, originalTiming);
    setVisibility('visible');
  });

  it('starts at 0 / 5 with the camera active (video only, no audio)', async () => {
    renderExam();
    expect(screen.queryByRole('status', { name: /Focus violations/ })).not.toBeInTheDocument();
    await startExam();

    expect(violationText()).toContain('0 / 5');
    expect(await screen.findByText('● Camera Active')).toBeInTheDocument();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ video: true, audio: false });
  });

  it('counts one violation per tab switch and none for returning', async () => {
    renderExam();
    await startExam();

    leaveTab();
    expect(violationText()).toContain('1 / 5');

    returnToTab();
    expect(violationText()).toContain('1 / 5');

    leaveTab();
    expect(violationText()).toContain('2 / 5');
    expect(screen.getByText(/Exam focus violation detected/)).toBeInTheDocument();
  });

  it('does not double count blur + visibilitychange, or count while staying away', async () => {
    renderExam();
    await startExam();

    // A real tab switch fires both events for the same action.
    hasFocus = false;
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    leaveTab();
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(violationText()).toContain('1 / 5');
    expect(reportExamViolation).toHaveBeenCalledTimes(1);
  });

  it('counts an application/window switch (blur only) once, and ignores transient blurs', async () => {
    renderExam();
    await startExam();

    // Transient blur (e.g. a native dialog): focus is back before the confirmation check.
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(violationText()).toContain('0 / 5');

    // Real switch to another application.
    hasFocus = false;
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    await waitFor(() => expect(violationText()).toContain('1 / 5'));
  });

  it('camera failures show a warning and never change the violation count', async () => {
    renderExam();
    await startExam();
    leaveTab();
    returnToTab();
    leaveTab();
    returnToTab();
    expect(violationText()).toContain('2 / 5');

    // Camera disconnects mid-exam.
    act(() => {
      camera.track.readyState = 'ended';
      camera.track.dispatchEvent(new Event('ended'));
    });

    expect(await screen.findByText('⚠ Camera Unavailable')).toBeInTheDocument();
    expect(screen.getByText('⚠ Camera Warning')).toBeInTheDocument();
    expect(screen.getAllByText(/Please enable or reconnect your webcam/).length).toBeGreaterThan(0);
    expect(violationText()).toContain('2 / 5');
    expect(submitExamSession).not.toHaveBeenCalled();
  });

  it('shows a friendly warning (no raw error) when camera permission is denied', async () => {
    const denied = Object.assign(new Error('Permission denied by system'), { name: 'NotAllowedError' });
    installMediaDevices(vi.fn().mockRejectedValue(denied));

    renderExam();
    await startExam();

    expect(await screen.findByText('⚠ Camera Unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/Permission denied by system/)).not.toBeInTheDocument();
    expect(violationText()).toContain('0 / 5');
    expect(submitExamSession).not.toHaveBeenCalled();
  });

  it('handles a browser without getUserMedia', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    renderExam();
    await startExam();

    expect(await screen.findByText('⚠ Camera Unavailable')).toBeInTheDocument();
    expect(violationText()).toContain('0 / 5');
  });

  it('reports restored camera after a retry succeeds', async () => {
    const denied = Object.assign(new Error('x'), { name: 'NotAllowedError' });
    const getUserMedia = vi.fn().mockRejectedValueOnce(denied).mockResolvedValue(camera.stream);
    installMediaDevices(getUserMedia);

    renderExam();
    await startExam();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry camera' }));

    expect(await screen.findByText('● Camera Active')).toBeInTheDocument();
    expect(await screen.findByText('Camera connection restored.')).toBeInTheDocument();
  });

  it('auto-submits exactly once at 5 / 5 with the MAX_VIOLATIONS reason, then ignores further events', async () => {
    renderExam();
    await startExam();

    for (let i = 0; i < 5; i += 1) {
      leaveTab();
      returnToTab();
    }

    await screen.findByText('RESULT PAGE');
    expect(submitExamSession).toHaveBeenCalledTimes(1);
    expect(submitExamSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-1', reason: 'MAX_VIOLATIONS', violationCount: 5 })
    );
    expect(camera.track.stop).toHaveBeenCalled();

    // Events after submission are inert.
    leaveTab();
    returnToTab();
    expect(submitExamSession).toHaveBeenCalledTimes(1);
  });

  it('a manual submit in progress swallows later violation events (single submission)', async () => {
    let resolveSubmit;
    submitExamSession.mockImplementation(
      () => new Promise((resolve) => {
        resolveSubmit = resolve;
      })
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderExam();
    await startExam();
    fireEvent.click(screen.getByRole('button', { name: 'Submit Test' }));
    await waitFor(() => expect(submitExamSession).toHaveBeenCalledTimes(1));

    for (let i = 0; i < 6; i += 1) {
      leaveTab();
      returnToTab();
    }
    expect(submitExamSession).toHaveBeenCalledTimes(1);
    expect(submitExamSession).toHaveBeenCalledWith(expect.objectContaining({ reason: 'MANUAL' }));
    expect(camera.track.stop).toHaveBeenCalled();

    await act(async () => {
      resolveSubmit({ data: { submittedAt: new Date().toISOString() } });
    });
    await screen.findByText('RESULT PAGE');
    expect(submitExamSession).toHaveBeenCalledTimes(1);
  });

  it('restores the server-side count after a refresh and finishes the exam when it is already at the limit', async () => {
    api.get.mockResolvedValue({ data: { session: buildActiveSession({ violationCount: 4 }) } });
    renderExam();

    await screen.findByText('Choose the correct option.');
    expect(violationText()).toContain('4 / 5');
    leaveTab();
    await screen.findByText('RESULT PAGE');
    expect(submitExamSession).toHaveBeenCalledTimes(1);
    expect(submitExamSession).toHaveBeenCalledWith(expect.objectContaining({ reason: 'MAX_VIOLATIONS' }));
  });

  it('a restored session already at 5 / 5 is submitted automatically', async () => {
    api.get.mockResolvedValue({ data: { session: buildActiveSession({ violationCount: 5 }) } });
    renderExam();
    await screen.findByText('RESULT PAGE');
    expect(submitExamSession).toHaveBeenCalledTimes(1);
    expect(submitExamSession).toHaveBeenCalledWith(expect.objectContaining({ reason: 'MAX_VIOLATIONS' }));
  });

  it('leaving via an in-app link asks first, counts once, and cancelling counts nothing', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderExam(<Link to="/dashboard">Go to dashboard</Link>);
    await startExam();

    fireEvent.click(screen.getByText('Go to dashboard'));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(violationText()).toContain('0 / 5');
    expect(screen.queryByText('DASHBOARD PAGE')).not.toBeInTheDocument();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByText('Go to dashboard'));
    await screen.findByText('DASHBOARD PAGE');
    // One report for the deliberate leave; the unmount path must not add a second.
    expect(reportExamViolation).toHaveBeenCalledTimes(1);
    expect(reportExamViolation).toHaveBeenCalledWith(expect.objectContaining({ type: 'ROUTE_LEAVE' }));
  });

  it('a timer auto-submit in progress also swallows violation events (single submission)', async () => {
    let resolveSubmit;
    submitExamSession.mockImplementation(
      () => new Promise((resolve) => {
        resolveSubmit = resolve;
      })
    );
    api.post.mockResolvedValue({
      data: buildActiveSession({ expiresAt: new Date(Date.now() + 1200).toISOString(), timeLeftSec: 1 }),
    });

    renderExam();
    await startExam();
    await waitFor(() => expect(submitExamSession).toHaveBeenCalledTimes(1), { timeout: 4000 });
    expect(submitExamSession).toHaveBeenCalledWith(expect.objectContaining({ reason: 'TIME_EXPIRED' }));

    for (let i = 0; i < 6; i += 1) {
      leaveTab();
      returnToTab();
    }
    expect(submitExamSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSubmit({ data: { submittedAt: new Date().toISOString() } });
    });
    await screen.findByText('RESULT PAGE');
    expect(submitExamSession).toHaveBeenCalledTimes(1);
  });

  it('counts a route exit we could not intercept (e.g. browser back) exactly once', async () => {
    const { unmount } = renderExam();
    await startExam();

    // BrowserRouter updates window.location before the page unmounts.
    window.history.pushState({}, '', '/somewhere-else');
    unmount();
    window.history.pushState({}, '', '/');

    expect(reportExamViolation).toHaveBeenCalledTimes(1);
    expect(reportExamViolation).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-1', type: 'ROUTE_LEAVE' })
    );
  });

  it('does not count React StrictMode remounts and cleans up listeners and the camera on unmount', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const docAddSpy = vi.spyOn(document, 'addEventListener');
    const docRemoveSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderExam(null, { strict: true });
    await startExam();
    await screen.findByText('● Camera Active');
    expect(violationText()).toContain('0 / 5');
    unmount();

    const balance = (adds, removes, name) =>
      adds.mock.calls.filter(([type]) => type === name).length -
      removes.mock.calls.filter(([type]) => type === name).length;

    expect(balance(addSpy, removeSpy, 'blur')).toBe(0);
    expect(balance(addSpy, removeSpy, 'focus')).toBe(0);
    expect(balance(docAddSpy, docRemoveSpy, 'visibilitychange')).toBe(0);
    expect(camera.track.stop).toHaveBeenCalled();
    expect(reportExamViolation).not.toHaveBeenCalled();
  });

  describe('presence: no person in front of the camera', () => {
    const fastTiming = (overrides = {}) =>
      Object.assign(PRESENCE_TIMING, { sampleIntervalMs: 10, absentSamples: 3, rewarnMs: 60000, toastMs: 6000 }, overrides);

    it('shows a top-right warning, counts it separately from focus violations, and reports it', async () => {
      fastTiming();
      renderExam();
      await startExam();
      facePresent = false;

      const alert = await screen.findByText(/No person detected in front of the camera/);
      expect(alert.closest('.exam-presence-stack')).not.toBeNull(); // top-right toast stack
      expect(screen.getByText('Warning 1 of 5')).toBeInTheDocument();
      expect(screen.getByText('Presence warnings: 1 / 5')).toBeInTheDocument();

      // Focus counter is untouched, and nothing was submitted.
      expect(violationText()).toContain('0 / 5');
      expect(submitExamSession).not.toHaveBeenCalled();
      expect(reportExamViolation).toHaveBeenCalledWith(expect.objectContaining({ type: 'NO_PERSON' }));
    });

    it('a person who comes back in time resets the streak (no warning)', async () => {
      fastTiming({ absentSamples: 12 }); // ~120 ms of absence needed
      renderExam();
      await startExam();

      facePresent = false;
      await sleep(50);
      facePresent = true;
      await sleep(300);

      expect(screen.queryByText(/No person detected in front of the camera/)).not.toBeInTheDocument();
      expect(screen.getByText('Presence warnings: 0 / 5')).toBeInTheDocument();
    });

    it('auto-submits exactly once after 5 warnings with the PRESENCE_LIMIT reason', async () => {
      fastTiming({ absentSamples: 2, rewarnMs: 30 });
      renderExam();
      await startExam();
      facePresent = false;

      await screen.findByText('RESULT PAGE', undefined, { timeout: 4000 });
      expect(submitExamSession).toHaveBeenCalledTimes(1);
      expect(submitExamSession).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-1', reason: 'PRESENCE_LIMIT', presenceWarningCount: 5 })
      );
      expect(camera.track.stop).toHaveBeenCalled();
      expect(reportExamViolation.mock.calls.filter(([arg]) => arg.type === 'NO_PERSON')).toHaveLength(5);
    });

    it('never penalises the student when the detector cannot load', async () => {
      fastTiming();
      loadFaceDetector.mockRejectedValue(new Error('model missing'));
      renderExam();
      await startExam();
      facePresent = false;

      expect(await screen.findByText('Presence check unavailable')).toBeInTheDocument();
      await sleep(200);
      expect(screen.queryByText(/No person detected in front of the camera/)).not.toBeInTheDocument();
      expect(submitExamSession).not.toHaveBeenCalled();
    });

    it('does not sample while the camera is unavailable or the tab is hidden', async () => {
      fastTiming();
      facePresent = false;

      // Camera denied: no stream, so nothing to sample.
      const denied = Object.assign(new Error('x'), { name: 'NotAllowedError' });
      installMediaDevices(vi.fn().mockRejectedValue(denied));
      const first = renderExam();
      await startExam();
      await screen.findByText('⚠ Camera Unavailable');
      await sleep(200);
      expect(screen.queryByText(/No person detected in front of the camera/)).not.toBeInTheDocument();
      first.unmount();

      // Camera fine but tab hidden: samples are ignored.
      installMediaDevices(vi.fn().mockResolvedValue(camera.stream));
      renderExam();
      await startExam();
      await screen.findByText('● Camera Active');
      leaveTab();
      await sleep(200);
      expect(screen.queryByText(/No person detected in front of the camera/)).not.toBeInTheDocument();
      expect(submitExamSession).not.toHaveBeenCalled();
    });

    it('a restored session already at the presence limit is submitted automatically', async () => {
      api.get.mockResolvedValue({ data: { session: buildActiveSession({ presenceWarningCount: 5 }) } });
      renderExam();
      await screen.findByText('RESULT PAGE');
      expect(submitExamSession).toHaveBeenCalledTimes(1);
      expect(submitExamSession).toHaveBeenCalledWith(expect.objectContaining({ reason: 'PRESENCE_LIMIT' }));
    });

    it('a manual submit in progress stops presence warnings (single submission)', async () => {
      fastTiming({ absentSamples: 2, rewarnMs: 20 });
      let resolveSubmit;
      submitExamSession.mockImplementation(
        () => new Promise((resolve) => {
          resolveSubmit = resolve;
        })
      );
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderExam();
      await startExam();
      fireEvent.click(screen.getByRole('button', { name: 'Submit Test' }));
      await waitFor(() => expect(submitExamSession).toHaveBeenCalledTimes(1));

      facePresent = false;
      await sleep(300);
      expect(submitExamSession).toHaveBeenCalledTimes(1);
      expect(submitExamSession).toHaveBeenCalledWith(expect.objectContaining({ reason: 'MANUAL' }));

      await act(async () => {
        resolveSubmit({ data: { submittedAt: new Date().toISOString() } });
      });
      await screen.findByText('RESULT PAGE');
    });
  });
});