import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';

const HomePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const authMode = searchParams.get('auth');
  const isAuthOpen = authMode === 'login' || authMode === 'register';

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    targetExam: 'JEE',
  });

  const modeTitle = useMemo(() => {
    if (authMode === 'register') return 'Create your account';
    return 'Welcome back';
  }, [authMode]);

  const openAuth = (mode) => {
    const next = new URLSearchParams(searchParams);
    next.set('auth', mode);
    setSearchParams(next);
    setError('');
  };

  const closeAuth = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('auth');
    setSearchParams(next);
    setError('');
  };

  const scrollToSection = (id) => {
    const node = document.getElementById(id);
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const onLoginSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(loginForm);
      navigate('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const onRegisterSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register(registerForm);
      navigate('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="landing-page">
      <header className="landing-topbar">
        <BrandLogo className="landing-logo" to="/" />

        <nav className="landing-nav">
          <a href="#">Home</a>
          <a href="#">About</a>
          <a href="#">Services</a>
          <a href="#">Contact</a>
          <a href="#">Blog</a>
        </nav>

        <div className="landing-actions">
          <button className="outline-btn" type="button" onClick={() => openAuth('login')}>
            Login
          </button>
          <button className="solid-btn" type="button" onClick={() => openAuth('register')}>
            Start free trial
          </button>
        </div>
      </header>

      <section className="landing-hero">
        <div className="hero-grid-lines" aria-hidden="true" />

        {/* <div className="hero-badge">New: Personalized AI recommendations are live</div> */}

        <div className="hero-content centered">
          <h1>Master Exams with Smart Practice</h1>
          <p>
            AI-powered learning that tracks your performance, detects weak topics, and
            recommends the right questions at the right time.
          </p>

          <div className="hero-cta-row">
            <button className="solid-btn" type="button" onClick={() => openAuth('register')}>
              Start Practicing
            </button>
            <button className="outline-btn" type="button" onClick={() => scrollToSection('how-it-works')}>
              View Demo
            </button>
          </div>
        </div>

        <div className="horizon-wrap" aria-hidden="true">
          <div className="horizon-ring" />
          <div className="horizon-line" />
        </div>
      </section>

      {isAuthOpen && (
        <section className="auth-overlay" onClick={closeAuth}>
          <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
            <div className="auth-modal-head">
              <h3>{modeTitle}</h3>
              <button type="button" className="outline-btn close-btn" onClick={closeAuth}>
                Close
              </button>
            </div>

            {authMode === 'login' ? (
              <form className="auth-modal-form" onSubmit={onLoginSubmit}>
                <input
                  type="email"
                  placeholder="Email"
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  required
                />
                {error && <div className="error-text">{error}</div>}
                <button className="solid-btn" type="submit" disabled={busy}>
                  {busy ? 'Logging in...' : 'Login'}
                </button>
                <small>
                  New user?{' '}
                  <Link to="/?auth=register" onClick={() => openAuth('register')}>
                    Create account
                  </Link>
                </small>
              </form>
            ) : (
              <form className="auth-modal-form" onSubmit={onRegisterSubmit}>
                <input
                  placeholder="Full Name"
                  value={registerForm.name}
                  onChange={(event) =>
                    setRegisterForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={registerForm.email}
                  onChange={(event) =>
                    setRegisterForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  required
                />
                <input
                  type="password"
                  placeholder="Password (min 6 chars)"
                  value={registerForm.password}
                  onChange={(event) =>
                    setRegisterForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  required
                />
                <select
                  value={registerForm.targetExam}
                  onChange={(event) =>
                    setRegisterForm((prev) => ({ ...prev, targetExam: event.target.value }))
                  }
                >
                  <option value="NEET">NEET</option>
                  <option value="JEE">JEE</option>
                  <option value="CET">CET</option>
                </select>
                {error && <div className="error-text">{error}</div>}
                <button className="solid-btn" type="submit" disabled={busy}>
                  {busy ? 'Registering...' : 'Create Account'}
                </button>
                <small>
                  Already have an account?{' '}
                  <Link to="/?auth=login" onClick={() => openAuth('login')}>
                    Login
                  </Link>
                </small>
              </form>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default HomePage;
