import { useEffect, useState } from 'react';

// Cycles through a few sample "next up" recommendations rather than
// repeatedly fading the same one — reinforces that this card is a live
// output of the AI, not static decoration.
const recommendations = [
  { subject: 'Organic Chemistry', count: 15 },
  { subject: 'Coordinate Geometry', count: 12 },
  { subject: 'Electrostatics', count: 18 },
];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CYCLE_MS = 4500;
const FADE_MS = 450;

const RecommendationCard = () => {
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    const interval = setInterval(() => {
      if (reduced) {
        setIndex((prev) => (prev + 1) % recommendations.length);
        return;
      }
      setIsVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % recommendations.length);
        setIsVisible(true);
      }, FADE_MS);
    }, CYCLE_MS);
    return () => clearInterval(interval);
  }, []);

  const current = recommendations[index];

  return (
    <div
      className={`hero-float-card hero-float-card-4 ${isVisible ? 'is-swap-visible' : 'is-swap-hidden'}`}
      aria-hidden="true"
    >
      <span className="hero-float-label">Today's recommendation</span>
      <span className="hero-float-value">
        {current.subject}
        <svg className="hero-float-check" viewBox="0 0 20 20" width="13" height="13" aria-hidden="true">
          <path d="M4 10.5l3.5 3.5L16 5" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="hero-float-subvalue">{current.count} questions</span>
    </div>
  );
};

export default RecommendationCard;