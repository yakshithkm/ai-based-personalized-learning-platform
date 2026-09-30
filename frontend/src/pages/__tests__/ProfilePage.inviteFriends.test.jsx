import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from '../ProfilePage';
import { AuthProvider } from '../../context/AuthContext';
import { ToastProvider } from '../../context/ToastContext';

const mockProfile = {
  user: {
    _id: 'user-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    targetExam: 'JEE',
    isAdmin: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
};

const mockReferralSummary = { referralCode: 'ABC123XY', friendsInvited: 2, successfulSignups: 1 };

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/auth/profile') return Promise.resolve({ data: mockProfile });
      if (url === '/analytics/me') return Promise.resolve({ data: {} });
      if (url === '/referrals/me') return Promise.resolve({ data: mockReferralSummary });
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

describe('ProfilePage Invite Friends entry point', () => {
  it('opens the Invite Friends modal with live referral data when clicked', async () => {
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

    const inviteButton = await screen.findByRole('button', { name: 'Invite Friends' });
    fireEvent.click(inviteButton);

    await waitFor(() => expect(screen.getByText('ABC123XY')).toBeInTheDocument());
    expect(screen.getByText('2')).toBeInTheDocument();

    localStorage.removeItem('token');
  });
});