import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from '../ProfilePage';
import { AuthProvider } from '../../context/AuthContext';
import { ToastProvider } from '../../context/ToastContext';

const mockProfile = {
  user: {
    _id: 'user-1',
    name: 'Yakshith K M',
    email: 'yakshith@example.com',
    targetExam: 'JEE',
    isAdmin: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
};

const buildMockHeatmap = () => {
  const days = [];
  for (let i = 13; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push({ day: date.toISOString().slice(0, 10), count: i % 3 === 0 ? 2 : 0 });
  }
  return days;
};

const mockAnalytics = {
  performance: { totalAttempts: 40, totalCorrect: 28, overallAccuracy: 70 },
  habit: {
    currentStreak: 4,
    longestStreak: 9,
    totalActiveDays: 5,
    streakDays: [
      { day: '2026-08-10', practiced: true, attempts: 3 },
      { day: '2026-08-11', practiced: true, attempts: 2 },
    ],
    heatmap: buildMockHeatmap(),
  },
  xp: { totalXp: 620, weeklyXp: 120, level: 3 },
  benchmark: { percentile: 62, estimated: true, message: 'You are ahead of 62% of students.' },
  solvedSummary: { uniqueSolved: 25, totalQuestions: 500, attempting: 3 },
  attemptsBySubject: [
    { subject: 'Physics', attempts: 20, accuracy: 65 },
    { subject: 'Chemistry', attempts: 20, accuracy: 75 },
  ],
  topicMastery: [
    { subject: 'Physics', topic: 'Kinematics', subtopic: 'General', attempts: 12, masteryScore: 80 },
    { subject: 'Chemistry', topic: 'Organic Basics', subtopic: 'General', attempts: 8, masteryScore: 55 },
  ],
  recentAttempts: [
    {
      _id: 'attempt-1',
      subject: 'Physics',
      topic: 'Kinematics',
      difficulty: 'Medium',
      isCorrect: true,
      timeTakenSec: 45,
      createdAt: new Date().toISOString(),
    },
  ],
};

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/auth/profile') return Promise.resolve({ data: mockProfile });
      if (url === '/analytics/me') return Promise.resolve({ data: mockAnalytics });
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

describe('ProfilePage smoke test', () => {
  it('renders profile identity, stats, and recent activity without crashing', async () => {
    localStorage.setItem('token', 'test-token');

    render(
      <MemoryRouter>
        <AuthProvider>
          <ToastProvider>
            <ProfilePage />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Yakshith K M')).toBeInTheDocument());

    expect(screen.getByText('yakshith@example.com')).toBeInTheDocument();
    expect(screen.getByText('JEE Aspirant')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Badges' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Skills' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeInTheDocument();
    expect(screen.getAllByText('Kinematics').length).toBeGreaterThan(0);
    expect(screen.getByText(/Total active days:/)).toBeInTheDocument();
    expect(screen.getByText(/Max streak:/)).toBeInTheDocument();
    expect(screen.getByText('/500')).toBeInTheDocument();
    expect(screen.getByText('3 Attempting')).toBeInTheDocument();
    expect(screen.getByText('Solved')).toBeInTheDocument();

    const ringWrap = document.querySelector('.profile-ring-wrap');
    fireEvent.mouseEnter(ringWrap);
    expect(screen.getByText('Acceptance')).toBeInTheDocument();
    expect(screen.getByText('70.00%')).toBeInTheDocument();
    expect(screen.getByText('40 submissions')).toBeInTheDocument();
    expect(screen.queryByText('Solved')).not.toBeInTheDocument();
    // The "Attempting" caption must stay mounted through hover so the ring
    // column's height - and therefore the ring's vertical position - never
    // shifts when the center content swaps to the acceptance view.
    expect(screen.getByText('3 Attempting')).toBeInTheDocument();

    fireEvent.mouseLeave(ringWrap);
    expect(screen.getByText('Solved')).toBeInTheDocument();
    expect(screen.queryByText('Acceptance')).not.toBeInTheDocument();
    expect(screen.getByText('3 Attempting')).toBeInTheDocument();

    localStorage.removeItem('token');
  });
});