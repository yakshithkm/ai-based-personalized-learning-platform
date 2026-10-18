import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import HomePage from '../HomePage';
import RegisterPage from '../RegisterPage';
import LoginPage from '../LoginPage';
import PlansPage from '../PlansPage';
import ProtectedRoute from '../../components/ProtectedRoute';
import { AuthProvider } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { TierProvider } from '../../context/TierContext';

const getMock = vi.fn();
const postMock = vi.fn();
vi.mock('../../api/client', () => ({
  default: { get: (...a) => getMock(...a), post: (...a) => postMock(...a) },
}));

class IO { observe() {} unobserve() {} disconnect() {} }

const Where = () => {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname + loc.search}</div>;
};

const asUser = (tier, extra = {}) => {
  localStorage.setItem('token', 'tok');
  const user = { _id: `u-${tier}`, name: 'T', tier, ...extra };
  getMock.mockImplementation(async (url) => {
    if (url === '/auth/profile') return { data: { user } };
    if (url === '/tier/me') return { data: { tier, isDemo: Boolean(extra.isDemo), subscription: { status: tier === 'FREE' ? null : 'ACTIVE' }, features: {}, limits: {}, usage: {} } };
    if (url === '/tier/plans') return { data: { plans: [], matrix: {} } };
    return { data: {} };
  });
};

const renderApp = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <AuthProvider>
          <TierProvider>
            <Routes>
              <Route path="/" element={<><HomePage /><Where /></>} />
              <Route path="/register" element={<><RegisterPage /><Where /></>} />
              <Route path="/login" element={<><LoginPage /><Where /></>} />
              <Route path="/dashboard" element={<><div>DASHBOARD</div><Where /></>} />
              <Route path="/plans" element={<ProtectedRoute><PlansPage /><Where /></ProtectedRoute>} />
            </Routes>
          </TierProvider>
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>
  );

const pricingButton = (plan) => document.querySelector(`#pricing-section button[data-plan="${plan}"]`);

beforeEach(() => {
  localStorage.clear();
  getMock.mockReset().mockResolvedValue({ data: {} });
  postMock.mockReset();
  vi.stubGlobal('IntersectionObserver', IO);
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() {} })));
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('landing pricing buttons', () => {
  it('logged out: Free -> /register, Pro/Premium -> /register with the plan preserved; honest labels', async () => {
    renderApp('/');
    await waitFor(() => expect(pricingButton('PRO')).not.toBeDisabled());
    expect(pricingButton('PRO')).toHaveTextContent('View Pro plan');
    expect(pricingButton('PREMIUM')).toHaveTextContent('View Premium plan');
    expect(document.body.textContent).not.toMatch(/Start Pro trial/);

    fireEvent.click(pricingButton('PRO'));
    expect(await screen.findByTestId('where')).toHaveTextContent('/register?plan=PRO');
  });

  it('logged out: Free goes to plain /register', async () => {
    renderApp('/');
    await waitFor(() => expect(pricingButton('FREE')).not.toBeDisabled());
    fireEvent.click(pricingButton('FREE'));
    expect(await screen.findByTestId('where')).toHaveTextContent(/^\/register$/);
  });

  it('logged-in Pro user: Pro card is a disabled "Current Plan"; Premium opens the upgrade screen', async () => {
    asUser('PRO');
    renderApp('/');
    await waitFor(() => expect(pricingButton('PRO')).toHaveTextContent('Current Plan'));
    expect(pricingButton('PRO')).toBeDisabled();
    fireEvent.click(pricingButton('PREMIUM'));
    expect(await screen.findByTestId('where')).toHaveTextContent('/plans?plan=PREMIUM');
    expect(postMock).not.toHaveBeenCalled();
  });

  it('logged-in Free user: Free card opens the dashboard', async () => {
    asUser('FREE');
    renderApp('/');
    await waitFor(() => expect(pricingButton('FREE')).toHaveTextContent('Open dashboard'));
    fireEvent.click(pricingButton('FREE'));
    await screen.findByText('DASHBOARD');
  });
});

describe('plan preserved through registration / login', () => {
  it('register with ?plan=PRO lands on the Pro upgrade screen and never sends the plan to the API', async () => {
    postMock.mockImplementation(async (url) => {
      if (url === '/auth/register') return { data: { token: 'tok', user: { _id: 'n1', tier: 'FREE' } } };
      throw new Error(`unexpected ${url}`);
    });
    getMock.mockImplementation(async (url) => {
      if (url === '/tier/me') return { data: { tier: 'FREE', features: {}, subscription: null } };
      return { data: { plans: [], matrix: {} } };
    });
    renderApp('/register?plan=PRO');
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'j@e.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('Upgrade to Pro', { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/plans?plan=PRO');
    const [, payload] = postMock.mock.calls[0];
    expect(payload.plan).toBeUndefined();
    expect(payload.tier).toBeUndefined();
  });

  it('login/register cross-links keep the plan; invalid plan values are dropped', () => {
    renderApp('/login?plan=PREMIUM');
    expect(screen.getByRole('link', { name: /create/i })).toHaveAttribute('href', '/register?plan=PREMIUM');
  });

  it('login with a bogus plan falls back to the dashboard path', () => {
    renderApp('/login?plan=ADMIN');
    expect(screen.getByRole('link', { name: /create/i })).toHaveAttribute('href', '/register');
  });
});

describe('upgrade screen (/plans?plan=...)', () => {
  it('logged out direct navigation keeps the selection through login', async () => {
    renderApp('/plans?plan=PREMIUM');
    expect(await screen.findByTestId('where')).toHaveTextContent('/login?plan=PREMIUM');
  });

  it('Free user sees Pro benefits, an honest checkout message, no fake success, and no tier change', async () => {
    asUser('FREE');
    postMock.mockRejectedValue({ response: { status: 501, data: { code: 'PAYMENT_NOT_CONFIGURED' } } });
    renderApp('/plans?plan=PRO');
    await screen.findByText('Upgrade to Pro', { selector: 'h3' });
    expect(screen.getByText('No active paid subscription')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue to Pro checkout' }));
    expect(await screen.findByText(/Online subscription checkout is not available yet/)).toBeInTheDocument();
    expect(postMock).toHaveBeenCalledWith('/tier/checkout', { tier: 'PRO' });
    expect(document.body.textContent).not.toMatch(/payment successful|now active|welcome to pro|thank you|you are now/i);
  });

  it('Pro user opening ?plan=PRO sees it as the current plan (no checkout)', async () => {
    asUser('PRO');
    renderApp('/plans?plan=PRO');
    expect(await screen.findByText('Pro is your current plan')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /checkout/i })).toBeNull();
  });

  it('Premium user opening ?plan=PRO sees that Premium already includes it', async () => {
    asUser('PREMIUM');
    renderApp('/plans?plan=PRO');
    expect(await screen.findByText('Your Premium plan already includes Pro')).toBeInTheDocument();
  });

  it('demo action is explicit: needs confirmation, then signs in through the normal login endpoint', async () => {
    asUser('FREE');
    postMock.mockImplementation(async (url, body) => {
      if (url === '/auth/login') return { data: { token: 'demo', user: { _id: 'd1', tier: 'PRO', isDemo: true, email: body.email } } };
      throw new Error('unexpected');
    });
    renderApp('/plans?plan=PRO');
    fireEvent.click(await screen.findByRole('button', { name: 'Explore Pro Demo' }));
    expect(postMock).not.toHaveBeenCalled(); // nothing silent
    fireEvent.click(screen.getByRole('button', { name: 'Yes, open demo' }));
    await screen.findByText('DASHBOARD');
    expect(postMock).toHaveBeenCalledWith('/auth/login', { email: 'pro.demo@learning.com', password: 'pro@123' });
  });

  it('an invalid ?plan= value shows no upgrade panel', async () => {
    asUser('FREE');
    renderApp('/plans?plan=GOLD');
    await waitFor(() => expect(screen.getByTestId('where')).toBeInTheDocument());
    expect(screen.queryByText(/^Upgrade to /, { selector: 'h3' })).toBeNull();
  });
});
