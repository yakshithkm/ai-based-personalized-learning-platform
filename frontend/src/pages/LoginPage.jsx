import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import { translateServerError } from '../i18n/serverErrors';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';
import PasswordField from '../components/PasswordField';
import { BrainIcon, SearchIcon, ChartIcon, ClockIcon, ArrowLeftIcon } from '../components/landing/icons';

const DEMO_ACCOUNTS = [
  { labelKey: 'auth.useDemo', tag: 'NEET', email: 'neet@learning.com', password: 'neet@123' },
  { labelKey: 'auth.useDemo', tag: 'CET', email: 'cet@learning.com', password: 'cet@123' },
  { labelKey: 'auth.useDemo', tag: 'JEE', email: 'jee@learning.com', password: 'jee@123' },
];

const FEATURES = [
  { textKey: 'auth.features.plans', Icon: BrainIcon },
  { textKey: 'auth.features.adaptive', Icon: ChartIcon },
  { textKey: 'auth.features.analytics', Icon: SearchIcon },
  { textKey: 'auth.features.simulations', Icon: ClockIcon },
];

const LoginPage = () => {
  const { t } = useTranslation();
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
      setError(translateServerError(t, err?.response?.data?.message, 'auth.loginFailed'));
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
          <span className="auth-eyebrow">{t('layout.tagline')}</span>
          <h1 className="auth-headline">
            {t('auth.headlineLine1')}
            <br />
            {t('auth.headlineLine2')}
          </h1>
          <p className="auth-subtext">{t('auth.subtext')}</p>
          <ul className="auth-feature-list">
            {FEATURES.map(({ textKey, Icon }) => (
              <li key={textKey}>
                <span className="auth-feature-icon">
                  <Icon />
                </span>
                {t(textKey)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="auth-right">
        <LanguageSelector variant="compact" className="lang-floating" />
        <div className="auth-right-inner">
          <Link to="/" className="auth-back-link">
            <ArrowLeftIcon />
            {t('common.backToHome')}
          </Link>

          <form className="auth-card" onSubmit={onSubmit}>
            <h3>{t('auth.welcomeBack')}</h3>
            <p>{t('auth.signInSubtitle')}</p>

            <label htmlFor="login-email">
              {t('auth.email')}
              <input
                id="login-email"
                name="email"
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                value={form.email}
                onChange={onChange}
                required
              />
            </label>
            <label htmlFor="login-password">
              {t('auth.password')}
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
              {busy ? t('auth.loggingIn') : t('auth.login')}
            </button>

            <small>
              {t('auth.newToTutorMind')} <Link to="/register">{t('auth.createAccountLink')}</Link>
            </small>
          </form>

          <div className="auth-demo-section">
            <div className="auth-demo-title">{t('auth.demoAccounts')}</div>
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
                    {t(account.labelKey, { exam: account.tag })}
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