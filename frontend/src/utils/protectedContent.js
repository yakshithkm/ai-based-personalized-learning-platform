// Reusable protection for question/option text on Practice and Exam Simulation:
// blocks text selection, copy, cut, drag and the context menu on the wrapped
// content only. Does not touch clicks, so a button/label wrapping this content
// (e.g. an answer option) keeps working normally - only the text itself becomes
// unselectable/uncopyable.
//
// Usage: <p className={PROTECTED_CONTENT_CLASS} {...protectedContentHandlers}>...</p>

export const PROTECTED_CONTENT_CLASS = 'question-protected-content';

const blockEvent = (event) => {
  event.preventDefault();
};

export const protectedContentHandlers = {
  onCopy: blockEvent,
  onCut: blockEvent,
  onDragStart: blockEvent,
  onContextMenu: blockEvent,
};