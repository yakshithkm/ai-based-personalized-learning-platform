// Minimal, dependency-free line icons for the exam result page — drawn in the same
// lucide-style 24x24 stroke system (round caps/joins, 1.8 stroke) as
// components/landing/icons.jsx, so no icon library is introduced just for two glyphs.
// Each icon inherits color from its parent via `currentColor`.

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const DownloadIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M12 3.5v10.6" />
    <path d="m7.8 10.7 4.2 4.2 4.2-4.2" />
    <path d="M4.8 19.5h14.4" />
  </svg>
);

export const CertificateIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <circle cx="12" cy="8.2" r="5" />
    <path d="M9.3 12.6 7.6 20.5l4.4-2.6 4.4 2.6-1.7-7.9" />
  </svg>
);