// Minimal, dependency-free line icons for the landing page — hand-drawn to
// match a lucide-style 24x24 stroke system (round caps/joins, 1.8 stroke)
// so we don't pull in an icon library just for ~7 glyphs. Each icon inherits
// color from its parent via `currentColor`, so it themes with light/dark
// mode automatically.

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const TargetIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <circle cx="12" cy="12" r="8.2" />
    <circle cx="12" cy="12" r="4.6" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const BoltIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M12.8 2.5 4.6 13.4h5.1L10.9 21.5 19.4 10.3h-5.2z" />
  </svg>
);

export const ChartIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M4 20V10.5" />
    <path d="M10.5 20V4" />
    <path d="M17 20v-7.5" />
    <path d="M3 20.5h18" />
  </svg>
);

export const BrainIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M9.2 4.2a2.7 2.7 0 0 0-2.7 2.7v.4A2.9 2.9 0 0 0 4.8 10v.6a2.9 2.9 0 0 0 1.5 2.55v.55a3.1 3.1 0 0 0 3.1 3.1" />
    <path d="M14.8 4.2a2.7 2.7 0 0 1 2.7 2.7v.4a2.9 2.9 0 0 1 1.7 2.7v.6a2.9 2.9 0 0 1-1.5 2.55v.55a3.1 3.1 0 0 1-3.1 3.1" />
    <path d="M9.2 4.2c0-1 .8-1.9 1.9-1.9h1.8c1.1 0 1.9.9 1.9 1.9v14.7c0 1-.8 1.9-1.9 1.9h-1.8a1.9 1.9 0 0 1-1.9-1.9z" />
  </svg>
);

export const SearchIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <circle cx="10.8" cy="10.8" r="6.3" />
    <path d="m19.5 19.5-4-4" />
  </svg>
);

export const ClockIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7v5.3l3.6 2.1" />
  </svg>
);

export const TrendUpIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="m3.5 16 5.6-5.7 4 4L20.5 6.5" />
    <path d="M15 6.5h5.5V12" />
  </svg>
);

export const ArrowLeftIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M20 12H5" />
    <path d="m11 5-7 7 7 7" />
  </svg>
);

export const ArrowRightIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M4 12h15" />
    <path d="m13 5 7 7-7 7" />
  </svg>
);

export const CheckIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="m4.5 12.5 4.6 4.6L19.5 6.5" />
  </svg>
);

export const EyeIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M2.5 12S5.8 5.5 12 5.5 21.5 12 21.5 12 18.2 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3.1" />
  </svg>
);

export const EyeOffIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M3.5 3.5l17 17" />
    <path d="M10.6 5.68A10.6 10.6 0 0 1 12 5.5c6.2 0 9.5 6.5 9.5 6.5a13.4 13.4 0 0 1-3.28 3.98M6.9 6.9C4.4 8.55 2.5 12 2.5 12s3.3 6.5 9.5 6.5a9.9 9.9 0 0 0 3.15-.52" />
    <path d="M9.6 9.6a3.1 3.1 0 0 0 4.36 4.36" />
  </svg>
);

export const StarIcon = (props) => (
  <svg {...base} fill="currentColor" stroke="none" {...props} aria-hidden="true">
    <path d="M12 2.7l2.7 5.85 6.3.63-4.75 4.35 1.32 6.17L12 16.9l-5.57 2.8 1.32-6.17-4.75-4.35 6.3-.63L12 2.7z" />
  </svg>
);