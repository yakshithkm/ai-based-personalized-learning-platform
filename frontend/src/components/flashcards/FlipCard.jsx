import { useTranslation } from 'react-i18next';

/**
 * The study card. A real <button> (native keyboard + touch activation); both faces live in the DOM
 * so they can animate, but only the visible face is exposed to assistive tech - the answer is never
 * announced or shown before the student flips the card. Reduced motion swaps the 3D turn for a
 * quick fade (see flashcards.css).
 */
const FlipCard = ({ front, back, flipped, onFlip }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`fc-flip${flipped ? ' is-flipped' : ''}`}
      onClick={onFlip}
      aria-pressed={flipped}
      data-testid="fc-flip"
    >
      <span className="fc-flip-inner">
        <span className="fc-face fc-face-front" aria-hidden={flipped}>
          <span className="fc-face-label">{t('flashcards.study.question')}</span>
          <span className="fc-face-text">{front}</span>
          <span className="fc-face-hint">{t('flashcards.study.flipHint')}</span>
        </span>
        <span className="fc-face fc-face-back" aria-hidden={!flipped}>
          <span className="fc-face-label">{t('flashcards.study.answer')}</span>
          <span className="fc-face-text">{back}</span>
          <span className="fc-face-hint">{t('flashcards.study.flipBackHint')}</span>
        </span>
      </span>
      <span className="fc-sr-only">{flipped ? t('flashcards.study.showQuestion') : t('flashcards.study.showAnswer')}</span>
    </button>
  );
};

export default FlipCard;
