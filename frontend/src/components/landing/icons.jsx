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

export const MenuIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h16" />
  </svg>
);

export const CloseIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M5 5l14 14" />
    <path d="M19 5L5 19" />
  </svg>
);

// --- About Exams page icons ---
// Same hand-drawn 24x24 stroke system as above, added for the exam
// information cards rather than pulling in an icon library for a handful
// of glyphs.

export const MedicalIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M12 3.5v17" />
    <path d="M3.5 12h17" />
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
  </svg>
);

export const CalculatorIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <rect x="4.5" y="2.8" width="15" height="18.4" rx="2.2" />
    <path d="M7.3 6.6h9.4" />
    <path d="M7.6 11h1.6M11.2 11h1.6M14.8 11h1.6" />
    <path d="M7.6 14.6h1.6M11.2 14.6h1.6M14.8 14.6h1.6" />
    <path d="M7.6 18.2h1.6M11.2 18.2h1.6M14.8 18.2h1.6" />
  </svg>
);

export const MapPinIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M12 21.2s7.2-6.9 7.2-12A7.2 7.2 0 1 0 4.8 9.2c0 5.1 7.2 12 7.2 12z" />
    <circle cx="12" cy="9.2" r="2.6" />
  </svg>
);

export const ExternalLinkIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M9.5 5.5h-4a1.5 1.5 0 0 0-1.5 1.5v11.5a1.5 1.5 0 0 0 1.5 1.5h11.5a1.5 1.5 0 0 0 1.5-1.5v-4" />
    <path d="M14.5 3.5H20.5v6" />
    <path d="M20.2 3.8 11 13" />
  </svg>
);

export const CalendarIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <rect x="3.5" y="4.8" width="17" height="15.7" rx="2.4" />
    <path d="M3.5 9.6h17" />
    <path d="M8 3v3.4M16 3v3.4" />
  </svg>
);

export const NoticeIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M6 3.5h9.2L18 6.3v14.2H6z" />
    <path d="M15.2 3.5v2.8H18" />
    <path d="M8.6 11h6.8M8.6 14.2h6.8M8.6 17.4h4.2" />
  </svg>
);