import { useCountUp, useScrollReveal } from '../../hooks/useScrollReveal';

const PriceCounter = ({ value, prefix = '₹' }) => {
  const [ref, isVisible] = useScrollReveal({ threshold: 0.4 });
  const display = useCountUp(value, { isActive: isVisible, duration: 1200 });

  return (
    <span ref={ref}>
      {prefix}
      {display}
    </span>
  );
};

export default PriceCounter;