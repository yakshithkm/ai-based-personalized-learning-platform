import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';

const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="lang-globe">
    <path
      d="M12 2a10 10 0 100 20 10 10 0 000-20zm6.9 6h-2.95a15.7 15.7 0 00-1.38-3.56A8.03 8.03 0 0118.9 8zM12 4c.83 1.2 1.48 2.53 1.91 4h-3.82c.43-1.47 1.08-2.8 1.91-4zM4.26 14a8.2 8.2 0 010-4h3.38a16.5 16.5 0 000 4H4.26zm.84 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.99 7.99 0 015.1 16zm2.95-8H5.1a7.99 7.99 0 014.33-3.56A15.7 15.7 0 008.05 8zM12 20c-.83-1.2-1.48-2.53-1.91-4h3.82c-.43 1.47-1.08 2.8-1.91 4zm2.34-6H9.66a14.7 14.7 0 010-4h4.68a14.7 14.7 0 010 4zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 01-4.33 3.56zM16.36 14a16.5 16.5 0 000-4h3.38a8.2 8.2 0 010 4h-3.38z"
      fill="currentColor"
    />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="lang-check">
    <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CaretIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="lang-caret">
    <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Accessible language picker (button + listbox). Options always show the language's own
 * native name (never a translated one) plus a flag as decoration only.
 *
 * variant="compact"  - header/landing: 🌐 ಕನ್ನಡ ▾
 * variant="field"    - settings/profile: full-width, labelled row
 */
const LanguageSelector = ({ variant = 'compact', align = 'right', className = '' }) => {
  const { t } = useTranslation();
  const { language, languages, meta, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState(null);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  // The menu is rendered in <body> (portal) and positioned from the button's on-screen
  // rectangle, then clamped to the viewport. Rendering it inside the header would clip /
  // mis-position it: headers use backdrop-filter (which re-anchors position: fixed
  // descendants) and a button near the middle of a narrow screen would push an
  // absolutely-positioned menu off the left edge.
  const positionMenu = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const margin = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = variant === 'field' ? Math.min(rect.width, viewportWidth - margin * 2) : Math.min(224, viewportWidth - margin * 2);
    const preferredLeft = align === 'left' ? rect.left : rect.right - width;
    const left = Math.max(margin, Math.min(preferredLeft, viewportWidth - width - margin));
    const top = rect.bottom + 6;
    setMenuStyle({ top, left, width, maxHeight: Math.max(160, viewportHeight - top - margin) });
  }, [align, variant]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    positionMenu();
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [open, positionMenu]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      const inside =
        (rootRef.current && rootRef.current.contains(event.target)) ||
        (listRef.current && listRef.current.contains(event.target));
      if (!inside) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  // The list mounts one render after `open` (it waits for its computed position), so the
  // focus effect must also depend on that, or the first open would never receive focus.
  const menuReady = Boolean(menuStyle);
  useEffect(() => {
    if (open && menuReady) listRef.current?.focus();
  }, [open, menuReady]);

  const openMenu = () => {
    setActiveIndex(Math.max(0, languages.findIndex((entry) => entry.code === language)));
    setOpen(true);
  };

  const choose = (code) => {
    setLanguage(code);
    close();
  };

  const onListKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % languages.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + languages.length) % languages.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(languages.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(languages[activeIndex].code);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className={`lang-selector lang-selector-${variant} lang-align-${align} ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        ref={buttonRef}
        className="lang-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={t('language.label')}
        title={t('language.label')}
        onClick={() => (open ? close(false) : openMenu())}
      >
        <GlobeIcon />
        <span className="lang-current" lang={meta.code}>
          {meta.nativeName}
        </span>
        <CaretIcon />
      </button>

      {open && menuStyle && createPortal(
        <ul
          id={listId}
          ref={listRef}
          className="lang-menu"
          style={menuStyle}
          role="listbox"
          tabIndex={-1}
          aria-label={t('language.label')}
          aria-activedescendant={`${listId}-${languages[activeIndex].code}`}
          onKeyDown={onListKeyDown}
        >
          {languages.map((entry, index) => {
            const selected = entry.code === language;
            return (
              <li
                key={entry.code}
                id={`${listId}-${entry.code}`}
                role="option"
                aria-selected={selected}
                lang={entry.code}
                className={`lang-option ${selected ? 'is-selected' : ''} ${index === activeIndex ? 'is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(entry.code)}
              >
                <span className="lang-flag" aria-hidden="true">{entry.flag}</span>
                <span className="lang-native">{entry.nativeName}</span>
                {selected && <CheckIcon />}
              </li>
            );
          })}
        </ul>,
        document.body
      )}
    </div>
  );
};

export default LanguageSelector;