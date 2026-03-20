import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
      <form className="auth-card" onSubmit={onSubmit}>
        <h2>Create Account</h2>
        <p>Start personalized preparation for NEET, JEE, or CET.</p>

        <input name="name" placeholder="Full Name" onChange={onChange} required />
        <input name="email" type="email" placeholder="Email" onChange={onChange} required />
        <input
          name="password"
          type="password"
          placeholder="Password (min 6 chars)"
          onChange={onChange}
          required
        />

        <select name="targetExam" value={form.targetExam} onChange={onChange}>
          <option value="NEET">NEET</option>
          <option value="JEE">JEE</option>
          <option value="CET">CET</option>
        </select>

        {error && <div className="error-text">{error}</div>}

        <button className="solid-btn" type="submit" disabled={busy}>
          {busy ? 'Registering...' : 'Register'}
        </button>

        <small>
          Already have an account? <Link to="/login">Login</Link>
        </small>
      </form>
    </div>
  );
};

export default RegisterPage;
