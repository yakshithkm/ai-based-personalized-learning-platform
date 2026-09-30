import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import InviteFriendsModal from '../InviteFriendsModal';
import { ToastProvider } from '../../context/ToastContext';

const apiGetMock = vi.fn();

vi.mock('../../api/client', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
  },
}));

const renderModal = (open = true) =>
  render(
    <ToastProvider>
      <InviteFriendsModal open={open} onClose={() => {}} />
    </ToastProvider>
  );

describe('InviteFriendsModal', () => {
  it('does not render anything when closed', () => {
    renderModal(false);
    expect(screen.queryByText('Invite Friends')).not.toBeInTheDocument();
  });

  it('opens, loads the referral code/stats from the server, and builds the invite link', async () => {
    apiGetMock.mockResolvedValue({
      data: { referralCode: 'ABC123XY', friendsInvited: 5, successfulSignups: 3 },
    });

    renderModal(true);

    expect(await screen.findByText('Invite Friends')).toBeInTheDocument();
    expect(
      await screen.findByText('Invite your friends to TutorMind and help them prepare smarter.')
    ).toBeInTheDocument();
    await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith('/referrals/me'));

    expect(await screen.findByText('ABC123XY')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    const linkInput = screen.getByLabelText('Your invite link');
    expect(linkInput.value).toMatch(/\/register\?ref=ABC123XY$/);
  });

  it('shows the empty state copy when the user has no referrals yet', async () => {
    apiGetMock.mockResolvedValue({
      data: { referralCode: 'ZZZ999AA', friendsInvited: 0, successfulSignups: 0 },
    });

    renderModal(true);

    expect(await screen.findByText(/You haven't invited anyone yet\./)).toBeInTheDocument();
  });

  it('copies the invite link and shows a success toast', async () => {
    apiGetMock.mockResolvedValue({
      data: { referralCode: 'ABC123XY', friendsInvited: 1, successfulSignups: 1 },
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderModal(true);
    await screen.findByText('ABC123XY');

    fireEvent.click(screen.getByText('Copy Invite Link'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('ref=ABC123XY')));
    expect(await screen.findByText('Invite link copied!')).toBeInTheDocument();
  });

  it('email invite copies the link as a fallback in case no mail client opens', async () => {
    apiGetMock.mockResolvedValue({
      data: { referralCode: 'ABC123XY', friendsInvited: 1, successfulSignups: 1 },
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderModal(true);
    await screen.findByText('ABC123XY');

    fireEvent.click(screen.getByText('Email Invite'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('ref=ABC123XY')));
    expect(await screen.findByText(/invite link copied too, just in case/)).toBeInTheDocument();
  });

  it('shows a friendly error if the referral summary fails to load', async () => {
    apiGetMock.mockRejectedValue({ response: { data: { message: 'Server error' } } });

    renderModal(true);

    expect(await screen.findByText('Server error')).toBeInTheDocument();
  });
});