import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConfirmDialog from '../ConfirmDialog';

const props = { open: true, title: 'Delete it?', message: 'Sure?', onConfirm: vi.fn(), onCancel: vi.fn() };

describe('ConfirmDialog', () => {
  it('keeps the original in-place, top-aligned admin behaviour by default', () => {
    const { container } = render(<ConfirmDialog {...props} />);
    const backdrop = screen.getByRole('alertdialog').parentElement;
    expect(container.contains(backdrop)).toBe(true);
    expect(backdrop).toHaveClass('admin-modal-backdrop');
    expect(backdrop).not.toHaveClass('fc-modal-backdrop');
  });

  it('centered mode renders into document.body so it sits above the app shell', () => {
    const { container } = render(<ConfirmDialog {...props} centered />);
    const backdrop = screen.getByRole('alertdialog').parentElement;
    expect(container.contains(backdrop)).toBe(false);
    expect(backdrop.parentElement).toBe(document.body);
    expect(backdrop).toHaveClass('fc-modal-backdrop');
  });

  it('renders nothing when closed', () => {
    render(<ConfirmDialog {...props} open={false} centered />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});