// Display-label helpers for backend enums/data values. The stored/URL value is never
// changed - only what is shown. An unknown value falls back to itself (never a key).

export const subjectLabel = (t, subject) =>
  subject ? t(`subjects.${subject}`, { defaultValue: subject }) : '';

export const difficultyLabel = (t, difficulty) =>
  difficulty ? t(`difficulty.${String(difficulty).toLowerCase()}`, { defaultValue: difficulty }) : '';

// e.g. 'concept-gap' -> localized label, else a readable fallback ('concept gap').
export const mistakeTypeLabel = (t, type) =>
  type
    ? t(`mistakeTypes.${String(type).replace(/[^A-Za-z]+/g, '')}`, { defaultValue: String(type).replace(/-/g, ' ') })
    : '';