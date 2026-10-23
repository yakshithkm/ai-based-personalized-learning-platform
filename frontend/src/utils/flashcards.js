import { useEffect, useState } from 'react';
import { translateServerError } from '../i18n/serverErrors';

// Mirrors backend/src/config/flashcards.js (the server re-validates everything).
export const FLASHCARD_LIMITS = Object.freeze({
  TITLE: 120,
  TOPIC: 120,
  FRONT: 200,
  BACK: 400,
  SOURCE_TEXT: 12000,
  CARDS_PER_SAVE: 50,
  AI_MAX_CARDS: 25,
  AI_MIN_CARDS: 3,
});

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
export const CARD_STYLES = ['definitions', 'qa', 'conceptual', 'interview'];

export const useDebouncedValue = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

export const flashcardError = (t, err, fallbackKey = 'flashcards.errors.generic') =>
  translateServerError(t, err?.response?.data?.message, fallbackKey);

export const formatDate = (language, value) => {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(language || 'en', { dateStyle: 'medium' }).format(new Date(value));
  } catch (error) {
    return new Date(value).toLocaleDateString();
  }
};

// "in 3 days" style text for a future review time, via translated plural keys.
export const daysUntil = (value, now = Date.now()) => {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - now) / 86400000));
};

// Keyboard shortcuts must never hijack typing or activating a focused control.
export const isTypingTarget = (el) => {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
};

export const isActivatableTarget = (el) => {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  return tag === 'BUTTON' || tag === 'A' || el.getAttribute?.('role') === 'button';
};
