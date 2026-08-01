import { Suspense, lazy, useEffect, useState } from 'react';

// three.js + fiber + drei pull in a non-trivial amount of JS, so this stays
// out of the main landing-page bundle and loads as its own chunk once the
// browser is idle — matching the app's existing route-based code-splitting
// approach (see App.jsx).
const HeroScene = lazy(() => import('./HeroScene'));

const StaticFallback = () => (
  <div className="hero-3d-fallback" aria-hidden="true">
    <div className="hero-3d-fallback-orb" />
  </div>
);

const Hero3DCanvas = () => {
  const [shouldRender3D, setShouldRender3D] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    // Skip the 3D scene entirely for users who've asked for reduced motion,
    // and for very small viewports where it mostly just burns battery.
    if (prefersReducedMotion || window.innerWidth < 640) {
      return;
    }

    setShouldRender3D(true);
  }, []);

  if (!shouldRender3D) {
    return <StaticFallback />;
  }

  return (
    <Suspense fallback={<StaticFallback />}>
      <HeroScene />
    </Suspense>
  );
};

export default Hero3DCanvas;
