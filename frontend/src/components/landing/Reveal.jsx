import { useScrollReveal } from '../../hooks/useScrollReveal';

/**
 * Generic scroll-reveal wrapper for landing-page content. Renders its own
 * element (default <div>) so it can wrap sections, grids, or individual
 * cards without extra markup assumptions from the caller.
 *
 * `delay` (ms) staggers groups of siblings — pass index * 80 or similar.
 */
const Reveal = ({
  as: Tag = 'div',
  delay = 0,
  className = '',
  children,
  ...rest
}) => {
  const [ref, isVisible] = useScrollReveal();

  return (
    <Tag
      ref={ref}
      className={`reveal-on-scroll ${isVisible ? 'is-visible' : ''} ${className}`.trim()}
      style={isVisible ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
};

export default Reveal;