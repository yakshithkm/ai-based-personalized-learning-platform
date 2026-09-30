import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RegisterPage from '../RegisterPage';
import { AuthProvider } from '../../context/AuthContext';

const apiPostMock = vi.fn();

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: (...args) => apiPostMock(...args),
  },
}));

const renderRegisterAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<div>DASHBOARD</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );

const fillAndSubmit = () => {
  fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Jane Doe' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
};

describe('RegisterPage referral handling', () => {
  beforeEach(() => {
    apiPostMock.mockClear();
  });

  it('detects and displays a referral code from the ?ref= query param', () => {
    renderRegisterAt('/register?ref=ABC123XY');
    expect(screen.getByText('Invited with code ABC123XY')).toBeInTheDocument();
  });

  it('sends the referral code to the backend on submit', async () => {
    apiPostMock.mockResolvedValue({ data: { user: { _id: 'u1' }, token: 'tok' } });

    renderRegisterAt('/register?ref=ABC123XY');
    fillAndSubmit();

    await waitFor(() => expect(apiPostMock).toHaveBeenCalled());
    expect(apiPostMock).toHaveBeenCalledWith(
      '/auth/register',
      expect.objectContaining({ ref: 'ABC123XY', email: 'jane@example.com' })
    );
    await screen.findByText('DASHBOARD');
  });

  it('registers normally with no ref field when there is no invite code', async () => {
    apiPostMock.mockResolvedValue({ data: { user: { _id: 'u1' }, token: 'tok' } });

    renderRegisterAt('/register');
    expect(screen.queryByText(/Invited with code/)).not.toBeInTheDocument();
    fillAndSubmit();

    await waitFor(() => expect(apiPostMock).toHaveBeenCalled());
    const [, payload] = apiPostMock.mock.calls[0];
    expect(payload.ref).toBeUndefined();
  });

  it('registration still succeeds even if the referral code turns out to be invalid (handled gracefully)', async () => {
    // The backend silently ignores an unknown code and registers the user
    // anyway - the frontend must not block or error on this.
    apiPostMock.mockResolvedValue({ data: { user: { _id: 'u1' }, token: 'tok' } });

    renderRegisterAt('/register?ref=NOTREAL1');
    fillAndSubmit();

    await screen.findByText('DASHBOARD');
  });
});