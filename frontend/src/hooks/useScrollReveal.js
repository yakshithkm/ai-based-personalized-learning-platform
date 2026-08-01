import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Lightweight, dependency-free scroll-reveal primitive.
 * Returns a ref to attach to an element and a boolean that flips to
 * true once the element enters the viewport. Honors prefers-reduced-motion
 * by revealing content immediately instead of animating it in.
 */
export const useScrollReveal = ({ threshold = 0.18, rootMargin = '0px 0px -8% 0px' } = {}) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setIsVisible(true);
      return undefined;
    }

    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return [ref, isVisible];
};

/**
 * Animated count-up for stat/metric displays. Counts from 0 to `value`
 * once the host element is visible, using requestAnimationFrame so it
 * stays GPU/CPU-light and never triggers React re-renders per frame
 * beyond the text node it owns.
 */
export const useCountUp = (value, { duration = 1400, isActive = true } = {}) => {
  const [display, setDisplay] = useState(prefersReducedMotion() ? value : 0);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!isActive) return undefined;
    if (prefersReducedMotion()) {
      setDisplay(value);
      return undefined;
    }

    const start = performance.now();
    const from = 0;

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo — fast start, gentle settle
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => frameRef.current && cancelAnimationFrame(frameRef.current);
  }, [value, duration, isActive]);

  return display;
};