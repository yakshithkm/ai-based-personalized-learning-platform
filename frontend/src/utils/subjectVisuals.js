export const SUBJECT_COLORS = {
  Physics: '#60a5fa',
  Chemistry: '#34d399',
  Mathematics: '#f59e0b',
  Biology: '#f472b6',
};

export const FALLBACK_SUBJECT_COLOR = '#94a3b8';

export const subjectColor = (subject) => SUBJECT_COLORS[subject] || FALLBACK_SUBJECT_COLOR;

// Path data only — callers wrap these in their own <svg> so viewBox/size can
// vary by context (metric card vs. list row vs. legend swatch).
export const SUBJECT_ICON_PATHS = {
  Physics: 'M12 2a4 4 0 100 8 4 4 0 000-8zm0 2a2 2 0 110 4 2 2 0 010-4zm0-4c-5.5 0-10 1.3-10 3s4.5 3 10 3 10-1.3 10-3-4.5-3-10-3zm0 8c-5.5 0-10 4.5-10 10 0 1 4.5 1 10 1s10 0 10-1c0-5.5-4.5-10-10-10z',
  Chemistry: 'M9 2h6v2h-1v4.6l4.5 8A2 2 0 0116.7 20H7.3a2 2 0 01-1.8-3.4L10 8.6V4H9V2zm2 2v5l-1 1.8h4L13 9V4h-2z',
  Biology: 'M12 2c5 0 9 3.6 9 9-3.7 0-6.8-1.8-8.5-4.6C11 9.4 9 12 9 15c0 2.8 2 5 5 5-1.7 2-4.4 2-6 2-4 0-7-4-7-9 0-6 4.5-10.9 11-10.9z',
  Mathematics: 'M4 4h16v2H4V4zm2 4h3v3H6V8zm5 0h3v3h-3V8zm5 0h3v3h-3V8zM6 13h3v3H6v-3zm5 0h7v2h-7v-2zm0 4h7v2h-7v-2zM6 18h3v2H6v-2z',
};

export const subjectIconPath = (subject) => SUBJECT_ICON_PATHS[subject] || SUBJECT_ICON_PATHS.Physics;