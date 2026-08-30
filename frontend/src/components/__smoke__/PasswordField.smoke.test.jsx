import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import PasswordField from '../PasswordField';

// Thin controlled wrapper so the field has somewhere to hold its value.
const ControlledPasswordField = (props) => {
  const [value, setValue] = useState('');
  return (
    <PasswordField
      id="test-password"
      name="password"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      {...props}
    />
  );
};

describe('PasswordField smoke test', () => {
  it('defaults to masked input and reveals/hides the value on toggle click', () => {
    const { container } = render(<ControlledPasswordField />);

    const input = container.querySelector('#test-password');
    expect(input).toHaveAttribute('type', 'password');

    fireEvent.change(input, { target: { value: 'super-secret' } });
    expect(input).toHaveValue('super-secret');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });
});