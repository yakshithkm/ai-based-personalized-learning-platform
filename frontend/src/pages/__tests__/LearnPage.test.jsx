import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LearnPage from '../LearnPage';
import LearningContentPage from '../LearningContentPage';
import ContentFeedback from '../../components/learning/ContentFeedback';
import ImprovementBanner from '../../components/learning/ImprovementBanner';
import * as learningApi from '../../api/learning';

vi.mock('../../api/learning', () => ({
  getLearningBundle: vi.fn(),
  getLearnNext: vi.fn(),
  getDailyPlan: vi.fn(),
  getRecommendation: vi.fn(),
  startRecommendation: vi.fn(),
  reportProgress: vi.fn().mockResolvedValue({}),
  completeRecommendation: vi.fn(),
  skipRecommendation: vi.fn().mockResolvedValue({}),
  sendFeedback: vi.fn(),
  getPracticeSet: vi.fn(),
}));

const item = (overrides = {}) => ({
  id: 'rec1',
  kind: 'content',
  content: {
    id: 'c1', title: "Kirchhoff's Laws: Core Concepts", contentType: 'concept', difficulty: 'Easy',
    estimatedMinutes: 8, subject: 'Physics', topic: 'Current Electricity', concept: '', learningStage: 'introduction',
  },
  target: { subject: 'Physics', topic: 'Current Electricity', concept: '' },
  recommendationReason: 'weak-topic',
  reason: 'Your accuracy in Current Electricity is 43% across 15 attempts, below the 60% target.',
  priority: 'high',
  score: 81,
  signals: { accuracy: 43, attempts: 15, openMistakes: 3 },
  progress: null,
  practice: { count: 5, difficulty: 'Easy', route: '/practice?mode=content-practice&rec=rec1&count=5' },
  path: [
    { order: 1, kind: 'content', stage: 'introduction', title: "Kirchhoff's Laws: Core Concepts", minutes: 8, status: 'next', recommendationId: 'rec1' },
    { order: 2, kind: 'practice', stage: 'practice', label: '5 Easy Questions', count: 5, difficulty: 'Easy', minutes: 6, status: 'upcoming' },
  ],
  ...overrides,
});

const bundle = (overrides = {}) => ({
  mode: 'personalized',
  learnNext: { primary: item(), alsoConsider: [] },
  sections: {
    weakAreas: [item({ id: 'rec2', content: { ...item().content, id: 'c2', title: 'Solutions intro' }, reason: 'Your accuracy in Solutions is 35% across 10 attempts.', target: { subject: 'Chemistry', topic: 'Solutions', concept: '' }, path: undefined })],
    mistakeRecovery: [],
    continueLearning: [],
    practiceAfterLearning: [],
    challenges: [],
    exploreNew: [],
  },
  dailyPlan: { budgetMinutes: 45, totalMinutes: 14, items: [{ order: 1, type: 'content', title: 'Read the concept', minutes: 8, topic: 'Current Electricity', reason: 'Because.', route: '/learn/rec1' }] },
  improvements: [],
  ...overrides,
});

const renderLearn = () =>
  render(
    <MemoryRouter>
      <LearnPage />
    </MemoryRouter>
  );

describe('LearnPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the Learn Next hero with a data-based reason, the path, sections and the daily plan', async () => {
    learningApi.getLearningBundle.mockResolvedValue(bundle());
    renderLearn();

    expect(await screen.findByRole('heading', { name: "Kirchhoff's Laws: Core Concepts" })).toBeInTheDocument();
    expect(screen.getByText('Learn Next')).toBeInTheDocument();
    expect(screen.getByText(/43% across 15 attempts/)).toBeInTheDocument();
    expect(screen.getByText('43% accuracy')).toBeInTheDocument();
    expect(screen.getByText('3 open mistakes')).toBeInTheDocument();
    expect(screen.getAllByText('high priority').length).toBeGreaterThan(0);
    expect(screen.getByRole('list', { name: 'Recommended learning path' })).toBeInTheDocument();
    expect(screen.getByText('5 Easy Questions')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start Learning' })).toHaveAttribute('href', '/learn/rec1');
    expect(screen.getByRole('region', { name: 'Review Your Weak Areas' })).toBeInTheDocument();
    expect(screen.getByText('Solutions intro')).toBeInTheDocument();
    expect(screen.getByText("Today's Personalized Plan")).toBeInTheDocument();
    // empty sections are not rendered
    expect(screen.queryByRole('region', { name: 'Fix Your Mistakes' })).not.toBeInTheDocument();
  });

  it('offers a baseline path for a brand-new student', async () => {
    learningApi.getLearningBundle.mockResolvedValue(
      bundle({
        mode: 'cold-start',
        welcome: { title: 'Welcome to TutorMind', message: "Let's establish your learning baseline.", baselineRoute: '/practice?mode=recommended' },
        startingPath: [{ subject: 'Physics', topic: 'Kinematics', hasStudyMaterial: true }, { subject: 'Chemistry', topic: 'Atomic Structure', hasStudyMaterial: false }],
        dailyPlan: undefined,
      })
    );
    renderLearn();
    expect(await screen.findByText("Let's establish your learning baseline.")).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Recommended starting path' })).toBeInTheDocument();
    expect(screen.getByText(/Atomic Structure/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start baseline practice' })).toHaveAttribute('href', '/practice?mode=recommended');
  });

  it('shows an empty state and an error state with retry', async () => {
    learningApi.getLearningBundle.mockResolvedValueOnce(
      bundle({ learnNext: null, sections: {}, dailyPlan: undefined, emptyState: { title: 'You are all caught up', message: 'Keep practicing.' } })
    );
    const { unmount } = renderLearn();
    expect(await screen.findByText('You are all caught up')).toBeInTheDocument();
    unmount();

    learningApi.getLearningBundle.mockRejectedValueOnce({ response: { data: { message: 'boom' } } });
    learningApi.getLearningBundle.mockResolvedValueOnce(bundle());
    renderLearn();
    expect(await screen.findByText('boom')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: "Kirchhoff's Laws: Core Concepts" })).toBeInTheDocument();
  });
});

describe('LearningContentPage', () => {
  beforeEach(() => vi.clearAllMocks());

  const renderViewer = () =>
    render(
      <MemoryRouter initialEntries={['/learn/rec1']}>
        <Routes>
          <Route path="/learn/:recommendationId" element={<LearningContentPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('opens the resource, completes it and offers the 5-question practice', async () => {
    learningApi.startRecommendation.mockResolvedValue({
      recommendation: { id: 'rec1', reason: 'Because your accuracy is low.' },
      content: { ...item().content, provider: 'TutorMind', body: '## Heading\n\nSome **study** text.', learningObjectives: ['Do a thing'] },
      progress: { status: 'in-progress', progressPercent: 0 },
      practice: { count: 5, route: '/practice?mode=content-practice&rec=rec1&count=5' },
    });
    learningApi.completeRecommendation.mockResolvedValue({
      progress: { status: 'completed' },
      practice: { count: 5, route: '/practice?mode=content-practice&rec=rec1&count=5' },
    });
    renderViewer();

    expect(await screen.findByRole('heading', { name: "Kirchhoff's Laws: Core Concepts" })).toBeInTheDocument();
    expect(learningApi.startRecommendation).toHaveBeenCalledWith('rec1');
    expect(screen.getByText('Because your accuracy is low.', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Do a thing')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'I have finished this' }));
    const practice = await screen.findByRole('link', { name: 'Start 5 Question Practice' });
    expect(practice).toHaveAttribute('href', '/practice?mode=content-practice&rec=rec1&count=5');
    expect(learningApi.completeRecommendation).toHaveBeenCalledWith('rec1', expect.any(Object));
    expect(screen.getByText('Was this helpful?')).toBeInTheDocument();
  });

  it('explains when the resource was disabled after being recommended', async () => {
    learningApi.startRecommendation.mockRejectedValue({ response: { status: 410, data: { message: 'This learning resource is no longer available' } } });
    renderViewer();
    expect(await screen.findByText('This resource is no longer available')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Learn' })).toHaveAttribute('href', '/learn');
  });
});

describe('ContentFeedback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves helpful and difficulty feedback, and rolls back on failure', async () => {
    learningApi.sendFeedback.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('nope'));
    render(<ContentFeedback recommendationId="rec1" />);

    fireEvent.click(screen.getByRole('button', { name: /^Helpful/ }));
    await waitFor(() => expect(learningApi.sendFeedback).toHaveBeenCalledWith('rec1', { helpful: true }));
    expect(screen.getByRole('button', { name: /^Helpful/ })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Too difficult' }));
    await waitFor(() => expect(learningApi.sendFeedback).toHaveBeenCalledWith('rec1', { difficulty: 'too-difficult' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i);
    expect(screen.getByRole('button', { name: 'Too difficult' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('ImprovementBanner', () => {
  it('reports before/after without causal language, and prompts for more practice when data is thin', () => {
    const { rerender } = render(
      <ImprovementBanner
        title="Current Electricity"
        effectiveness={{ available: true, hasBaseline: true, before: { accuracy: 43 }, after: { accuracy: 68 }, delta: { accuracyPoints: 25 }, message: 'Your accuracy improved by 25 percentage points once you completed this path.' }}
      />
    );
    expect(screen.getByText('+25 pts')).toBeInTheDocument();
    expect(screen.getByText('43%')).toBeInTheDocument();
    expect(screen.getByText('68%')).toBeInTheDocument();
    expect(screen.queryByText(/because/i)).not.toBeInTheDocument();

    rerender(<ImprovementBanner effectiveness={{ available: false, message: 'Answer 2 more questions to see how your accuracy changed.' }} />);
    expect(screen.getByText(/Answer 2 more questions/)).toBeInTheDocument();
    expect(screen.queryByText(/pts/)).not.toBeInTheDocument();
  });
});