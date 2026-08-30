import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';
import PasswordField from '../components/PasswordField';
import { BrainIcon, SearchIcon, ChartIcon, ClockIcon, ArrowLeftIcon } from '../components/landing/icons';

const FEATURES = [
  { text: 'AI-powered personalized study plans', Icon: BrainIcon },
  { text: 'Adaptive practice based on performance', Icon: ChartIcon },
  { text: 'Performance analytics and weak-topic detection', Icon: SearchIcon },
  { text: 'Realistic exam simulations', Icon: ClockIcon },
];

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    targetExam: 'JEE',
  });
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
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed');
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
            <h3>Create your account</h3>
            <p>Start your personalized learning journey.</p>

            <label htmlFor="register-name">
              Full Name
              <input
                id="register-name"
                name="name"
                placeholder="Your full name"
                value={form.name}
                onChange={onChange}
                required
              />
            </label>
            <label htmlFor="register-email">
              Email
              <input
                id="register-email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={onChange}
                required
              />
            </label>
            <label htmlFor="register-password">
              Password
              <PasswordField
                id="register-password"
                name="password"
                placeholder="Min 6 characters"
                value={form.password}
                onChange={onChange}
                autoComplete="new-password"
                required
              />
            </label>
            <label htmlFor="register-exam">
              Exam / Goal
              <select id="register-exam" name="targetExam" value={form.targetExam} onChange={onChange}>
                <option value="NEET">NEET</option>
                <option value="JEE">JEE</option>
                <option value="CET">CET</option>
              </select>
            </label>

            {error && <div className="error-text">{error}</div>}

            <button className="solid-btn" type="submit" disabled={busy}>
              {busy ? 'Creating account...' : 'Create Account'}
            </button>

            <small>
              Already have an account? <Link to="/login">Login</Link>
            </small>
          </form>
        </div>
      </section>
    </div>
  );
};

export default RegisterPage;