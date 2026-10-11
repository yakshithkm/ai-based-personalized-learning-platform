// One random id per page visit. The server uses it to charge the duplicate requests of a single visit
// (React StrictMode's double effect, a double click) once, while a separate visit - even a second
// later - gets its own id and is charged normally.
export const newVisitId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
};