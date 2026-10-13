import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import ThemeToggle from '../components/ThemeToggle';
import { translateServerError } from '../i18n/serverErrors';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';
import PasswordField from '../components/PasswordField';
import { getPostAuthPath, normalizePlan, withPlan } from '../utils/planSelection';
import { BrainIcon, SearchIcon, ChartIcon, ClockIcon, ArrowLeftIcon } from '../components/landing/icons';

const FEATURES = [
  { textKey: 'auth.features.plans', Icon: BrainIcon },
  { textKey: 'auth.features.adaptive', Icon: ChartIcon },
  { textKey: 'auth.features.analytics', Icon: SearchIcon },
  { textKey: 'auth.features.simulations', Icon: ClockIcon },
];

const RegisterPage = () => {
  const { t, i18n } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Referral code from an invite link (?ref=ABC123XY), preserved through the
  // form and sent to the backend on submit. The backend re-validates it
  // against the database - this is only ever used to prefill the request.
  const referralCode = (searchParams.get('ref') || '').trim();
  // Plan chosen on the pricing section (?plan=PRO). It only decides where to land after sign-up;
  // it is not sent to the API - every new account starts on FREE regardless.
  const selectedPlan = normalizePlan(searchParams.get('plan'));
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
      await register({ ...form, ...(referralCode ? { ref: referralCode } : {}), language: i18n.language });
      navigate(getPostAuthPath(selectedPlan));
    } catch (err) {
      setError(translateServerError(t, err?.response?.data?.message, 'auth.registerFailed'));
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
        <div className="auth-float-actions">
          <ThemeToggle />
          <LanguageSelector variant="compact" />
        </div>
        <div className="auth-right-inner">
          <Link to="/" className="auth-back-link">
            <ArrowLeftIcon />
            {t('common.backToHome')}
          </Link>

          <form className="auth-card" onSubmit={onSubmit}>
            <h3>{t('auth.createYourAccount')}</h3>
            <p>{t('auth.registerSubtitle')}</p>
            {!!referralCode && (
              <p className="chip nav-badge" style={{ marginBottom: '0.6rem' }}>
                {t('auth.invitedWithCode', { code: referralCode })}
              </p>
            )}

            <label htmlFor="register-name">
              {t('auth.fullName')}
              <input
                id="register-name"
                name="name"
                placeholder={t('auth.fullNamePlaceholder')}
                value={form.name}
                onChange={onChange}
                required
              />
            </label>
            <label htmlFor="register-email">
              {t('auth.email')}
              <input
                id="register-email"
                name="email"
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                value={form.email}
                onChange={onChange}
                required
              />
            </label>
            <label htmlFor="register-password">
              {t('auth.password')}
              <PasswordField
                id="register-password"
                name="password"
                placeholder={t('auth.passwordMinPlaceholder')}
                value={form.password}
                onChange={onChange}
                autoComplete="new-password"
                required
              />
            </label>
            <label htmlFor="register-exam">
              {t('auth.examGoal')}
              <select id="register-exam" name="targetExam" value={form.targetExam} onChange={onChange}>
                <option value="NEET">NEET</option>
                <option value="JEE">JEE</option>
                <option value="CET">CET</option>
              </select>
            </label>

            {error && <div className="error-text">{error}</div>}

            <button className="solid-btn" type="submit" disabled={busy}>
              {busy ? t('auth.creatingAccount') : t('auth.createAccount')}
            </button>

            <small>
              {t('auth.alreadyHaveAccount')} <Link to={withPlan('/login', selectedPlan)}>{t('auth.login')}</Link>
            </small>
          </form>
        </div>
      </section>
    </div>
  );
};

export default RegisterPage;