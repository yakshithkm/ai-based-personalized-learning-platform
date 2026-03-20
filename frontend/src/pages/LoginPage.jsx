import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
      <form className="auth-card" onSubmit={onSubmit}>
        <h2>Welcome Back</h2>
        <p>Continue your AI-assisted exam preparation.</p>

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
  );
};

export default LoginPage;
