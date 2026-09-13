import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../../components/BrandLogo';
import PasswordField from '../../components/PasswordField';

const AdminLoginPage = () => {
  const { user, loginAdmin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Already signed in as an admin - skip straight to the dashboard.
  if (user?.isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const onChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      await loginAdmin(form);
      navigate('/admin');
    } catch (err) {
      setError(err?.response?.data?.message || 'Invalid admin credentials');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page admin-auth-page">
      <section className="auth-right admin-auth-only">
        <div className="auth-right-inner">
          <Link to="/" className="auth-back-link">
            ← Back to Home
          </Link>

          <form className="auth-card" onSubmit={onSubmit}>
            <BrandLogo className="admin-login-logo" text="TutorMind" />
            <h3>Admin Portal</h3>
            <p>Sign in with your administrator credentials to manage the platform.</p>

            <label htmlFor="admin-email">
              Admin Email
              <input
                id="admin-email"
                name="email"
                type="email"
                placeholder="admin@learning.com"
                value={form.email}
                onChange={onChange}
                autoComplete="username"
                required
              />
            </label>
            <label htmlFor="admin-password">
              Password
              <PasswordField
                id="admin-password"
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
              {busy ? 'Signing in...' : 'Sign in to Admin Portal'}
            </button>

            <small>
              Not an admin? <Link to="/login">Go to student login</Link>
            </small>
          </form>
        </div>
      </section>
    </div>
  );
};

export default AdminLoginPage;