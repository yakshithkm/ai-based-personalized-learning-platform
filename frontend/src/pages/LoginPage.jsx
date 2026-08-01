import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
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
      <div className="auth-shell">
        <header className="auth-brandbar">
          <BrandLogo className="landing-logo" to="/" />
        </header>

        <div className="auth-grid">
          <section className="auth-feature-card">
            <p className="hero-eyebrow">Smart Competitive Exam Prep</p>
            <h2>Welcome Back</h2>
            <p>
              Continue your AI-assisted preparation with adaptive practice, weak-topic insights,
              and exam-focused analytics.
            </p>
            <div className="chip-wrap">
              <span className="chip">NEET</span>
              <span className="chip">JEE</span>
              <span className="chip">CET</span>
            </div>
          </section>

          <form className="auth-card auth-form-card" onSubmit={onSubmit}>
            <h3>Login</h3>
            <p>Continue where you left off.</p>

            <input name="email" type="email" placeholder="Email" onChange={onChange} required />
            <input
              name="password"
              type="password"
              placeholder="Password"
              onChange={onChange}
              required
            />

            {error && <div className="error-text">{error}</div>}

            <button className="solid-btn" type="submit" disabled={busy}>
              {busy ? 'Logging in...' : 'Login'}
            </button>

            <small>
              New user? <Link to="/register">Create account</Link>
            </small>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
