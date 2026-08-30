import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';
import PasswordField from '../components/PasswordField';
import { BrainIcon, SearchIcon, ChartIcon, ClockIcon, ArrowLeftIcon } from '../components/landing/icons';

const DEMO_ACCOUNTS = [
  { label: 'Use NEET Demo', tag: 'NEET', email: 'neet@learning.com', password: 'neet@123' },
  { label: 'Use CET Demo', tag: 'CET', email: 'cet@learning.com', password: 'cet@123' },
  { label: 'Use JEE Demo', tag: 'JEE', email: 'jee@learning.com', password: 'jee@123' },
];

const FEATURES = [
  { text: 'AI-powered personalized study plans', Icon: BrainIcon },
  { text: 'Adaptive practice based on performance', Icon: ChartIcon },
  { text: 'Performance analytics and weak-topic detection', Icon: SearchIcon },
  { text: 'Realistic exam simulations', Icon: ClockIcon },
];

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const fillDemoAccount = (account) => {
    setError('');
    setForm({ email: account.email, password: account.password });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      await login(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-left">
        <div className="auth-left-glow" aria-hidden="true" />
        <div className="auth-left-content">
          <BrandLogo className="landing-logo" to="/" />
          <span className="auth-eyebrow">AI-Powered Learning</span>
          <h1 className="auth-headline">
            Learn Smarter.
            <br />
            Prepare Better.
          </h1>
          <p className="auth-subtext">
            TutorMind gives you personalized preparation for NEET, JEE and CET — powered by
            performance analytics, adaptive practice, study recommendations, and realistic exam
            simulation.
          </p>
          <ul className="auth-feature-list">
            {FEATURES.map(({ text, Icon }) => (
              <li key={text}>
                <span className="auth-feature-icon">
                  <Icon />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="auth-right">
        <div className="auth-right-inner">
          <Link to="/" className="auth-back-link">
            <ArrowLeftIcon />
            Back to Home
          </Link>

          <form className="auth-card" onSubmit={onSubmit}>
            <h3>Welcome back</h3>
            <p>Sign in to continue your learning journey.</p>

            <label htmlFor="login-email">
              Email
              <input
                id="login-email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={onChange}
                required
              />
            </label>
            <label htmlFor="login-password">
              Password
              <PasswordField
                id="login-password"
                name="password"
                placeholder="••••••••"
                value={form.password}
                onChange={onChange}
                autoComplete="current-password"
                required
              />
            </label>

            {error && <div className="error-text">{error}</div>}

            <button className="solid-btn" type="submit" disabled={busy}>
              {busy ? 'Logging in...' : 'Login'}
            </button>

            <small>
              New to TutorMind? <Link to="/register">Create account</Link>
            </small>
          </form>

          <div className="auth-demo-section">
            <div className="auth-demo-title">Demo Accounts</div>
            <div className="auth-demo-grid">
              {DEMO_ACCOUNTS.map((account) => (
                <div className="auth-demo-item" key={account.email}>
                  <div className="auth-demo-item-label">
                    <span className="auth-demo-item-tag">{account.tag}</span>
                    <span className="auth-demo-item-email">{account.email}</span>
                  </div>
                  <button
                    type="button"
                    className="outline-btn outline-btn-sm"
                    onClick={() => fillDemoAccount(account)}
                  >
                    {account.label}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LoginPage;