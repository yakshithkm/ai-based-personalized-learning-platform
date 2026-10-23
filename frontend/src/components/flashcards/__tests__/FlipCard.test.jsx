import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import FlipCard from '../FlipCard';

describe('FlipCard', () => {
  it('does not expose the answer until flipped, and reports flips', () => {
    const onFlip = vi.fn();
    const { rerender, container } = render(<FlipCard front="What is ATP?" back="Energy currency" flipped={false} onFlip={onFlip} />);
    const back = container.querySelector('.fc-face-back');
    const front = container.querySelector('.fc-face-front');
    expect(back).toHaveAttribute('aria-hidden', 'true');
    expect(front).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button'));
    expect(onFlip).toHaveBeenCalledTimes(1);

    rerender(<FlipCard front="What is ATP?" back="Energy currency" flipped onFlip={onFlip} />);
    expect(container.querySelector('.fc-face-back')).toHaveAttribute('aria-hidden', 'false');
    expect(container.querySelector('.fc-face-front')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.fc-flip')).toHaveClass('is-flipped');
  });
});
