import { useState } from 'react';
import { EyeIcon, EyeOffIcon } from './landing/icons';

// Shared password input with a show/hide toggle. Meant to sit inside an
// existing <label> (the label text stays outside this component, same as
// the plain <input> it replaces) so it drops straight into the auth forms
// without changing their layout.
const PasswordField = ({
  id,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  autoComplete,
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
};

export default PasswordField;