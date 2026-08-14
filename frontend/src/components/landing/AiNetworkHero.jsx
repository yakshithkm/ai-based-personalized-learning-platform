import { useEffect, useRef } from 'react';

// v4: richer "processing hub" core (layered rings, halos, orbiting
// particles, periodic pulse-wave) instead of a plain glowing sphere, plus
// outputs re-aligned to the exact story the hero should tell:
//   Practice Questions/Accuracy/Time/Mistakes -> AI core -> Weak Topics /
//   Exam Readiness / Personalized Recommendations / Next Practice.
// Still no text inside the core — intelligence is read from the motion.

const inputs = [
  { label: 'Practice Questions', angle: 200 },
  { label: 'Accuracy', angle: 160 },
  { label: 'Time Per Question', angle: 120 },
  { label: 'Incorrect Answers', angle: 245 },
];

const outputs = [
  { label: 'Weak Topics', angle: -20 },
  { label: 'Exam Readiness', angle: 20 },
  { label: "Today's Recommendation", angle: 60 },
  { label: 'Accuracy', angle: -60 },
];

const RADIUS = 42;
const CENTER = 50;

const toPoint = (angleDeg, radius = RADIUS) => {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  };
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CYCLE_SECONDS = 14;
const ENTRANCE_OFFSET = 2; // seconds — nodes start cycling only after the core has faded in

const AiNetworkHero = () => {
  const wrapRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const node = wrapRef.current;
    if (!node) return undefined;

    const handleMove = (event) => {
      const rect = node.getBoundingClientRect();
      const relX = (event.clientX - rect.left) / rect.width - 0.5;
      const relY = (event.clientY - rect.top) / rect.height - 0.5;
      node.style.setProperty('--tilt-x', `${(-relY * 4).toFixed(2)}deg`);
      node.style.setProperty('--tilt-y', `${(relX * 4).toFixed(2)}deg`);
    };
    const handleLeave = () => {
      node.style.setProperty('--tilt-x', '0deg');
      node.style.setProperty('--tilt-y', '0deg');
    };

    window.addEventListener('pointermove', handleMove);
    node.addEventListener('pointerleave', handleLeave);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      node.removeEventListener('pointerleave', handleLeave);
    };
  }, []);

  const allNodes = [
    ...inputs.map((n, i) => ({ ...n, kind: 'input', slot: i })),
    ...outputs.map((n, i) => ({ ...n, kind: 'output', slot: i })),
  ];

  return (
    <div className="ai-network" ref={wrapRef} aria-hidden="true">
      <div className="ai-network-inner">
        <svg className="ai-network-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="ai-edge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>

          {allNodes.map((node, index) => {
            const point = toPoint(node.angle);
            const isInput = node.kind === 'input';
            const pathId = `ai-edge-${node.kind}-${index}`;
            const d = isInput
              ? `M ${point.x} ${point.y} L ${CENTER} ${CENTER}`
              : `M ${CENTER} ${CENTER} L ${point.x} ${point.y}`;

            return (
              <g key={`${node.kind}-${node.label}`}>
                <line
                  x1={CENTER}
                  y1={CENTER}
                  x2={point.x}
                  y2={point.y}
                  className="ai-network-edge"
                  style={{ animationDelay: `${index * 0.2}s` }}
                />
                <path id={pathId} d={d} fill="none" opacity="0" />
                <circle
                  r="0.6"
                  className={`ai-network-particle ${isInput ? 'ai-network-particle-in' : 'ai-network-particle-out'}`}
                >
                  <animateMotion
                    dur={`${3.6 + (index % 3) * 0.7}s`}
                    repeatCount="indefinite"
                    begin={`${ENTRANCE_OFFSET + 0.6 + index * 0.5}s`}
                  >
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                </circle>
              </g>
            );
          })}
        </svg>

        {/* AI processing hub: layered rings + halos + orbiting particles +
            a periodic pulse-wave, standing in for "arrival" pulses without
            text inside the core. */}
        <div className="ai-core-wrap">
          <span className="ai-core-pulse-wave" />
          <span className="ai-core-pulse-wave ai-core-pulse-wave-2" />
          <span className="ai-core-halo-outer" />
          <span className="ai-core-halo-inner" />
          <div className="ai-core-orbit">
            <span className="ai-core-orbit-dot" />
            <span className="ai-core-orbit-dot ai-core-orbit-dot-2" />
            <span className="ai-core-orbit-dot ai-core-orbit-dot-3" />
          </div>
          <span className="ai-core-orb">
            <span className="ai-core-orb-highlight" />
          </span>
        </div>

        {allNodes.map((node, index) => {
          const point = toPoint(node.angle);
          return (
            <span
              key={`${node.kind}-${node.label}`}
              className="ai-network-node"
              style={{
                left: `${point.x}%`,
                top: `${point.y}%`,
                animationDelay: `${ENTRANCE_OFFSET + index * (CYCLE_SECONDS / allNodes.length)}s`,
              }}
            >
              {node.label}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default AiNetworkHero;