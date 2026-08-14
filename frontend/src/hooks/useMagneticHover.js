import { useEffect, useRef } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Subtle "magnetic" hover pull for a button — nudges it a few px toward the
 * cursor while hovered, spring-releases back to center on leave, and
 * scales down slightly on press for click feedback. Skipped entirely under
 * prefers-reduced-motion. Returns a ref to attach to the target element.
 *
 * Combines translate + press-scale into one inline `transform` (rather than
 * a separate CSS `:active` rule) because this hook already owns `transform`
 * via continuous pointermove updates — a plain CSS rule would never win
 * against that inline style, so the press feedback has to live here too.
 */
export const useMagneticHover = ({ strength = 0.28, max = 8 } = {}) => {
  const ref = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const node = ref.current;
    if (!node) return undefined;

    let currentX = 0;
    let currentY = 0;
    let pressed = false;

    const apply = () => {
      const scale = pressed ? 0.98 : 1;
      node.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;
    };

    const handleMove = (event) => {
      const rect = node.getBoundingClientRect();
      const relX = event.clientX - (rect.left + rect.width / 2);
      const relY = event.clientY - (rect.top + rect.height / 2);
      currentX = Math.max(-max, Math.min(max, relX * strength));
      currentY = Math.max(-max, Math.min(max, relY * strength));
      apply();
    };

    const handleLeave = () => {
      currentX = 0;
      currentY = 0;
      pressed = false;
      node.style.transform = '';
    };

    const handleDown = () => {
      pressed = true;
      apply();
    };

    const handleUp = () => {
      pressed = false;
      apply();
    };

    node.addEventListener('pointermove', handleMove);
    node.addEventListener('pointerleave', handleLeave);
    node.addEventListener('pointerdown', handleDown);
    node.addEventListener('pointerup', handleUp);
    return () => {
      node.removeEventListener('pointermove', handleMove);
      node.removeEventListener('pointerleave', handleLeave);
      node.removeEventListener('pointerdown', handleDown);
      node.removeEventListener('pointerup', handleUp);
    };
  }, [strength, max]);

  return ref;
};