import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sendFeedback } from '../../api/learning';
import { ThumbsDownIcon, ThumbsUpIcon } from './learningUi';

const DIFFICULTY_OPTIONS = [
  ['too-easy', 'learn.feedback.tooEasy'],
  ['just-right', 'learn.feedback.justRight'],
  ['too-difficult', 'learn.feedback.tooDifficult'],
];

// Lightweight feedback stored per resource and used as a ranking signal.
const ContentFeedback = ({ recommendationId, initial = {} }) => {
  const { t } = useTranslation();
  const [helpful, setHelpful] = useState(initial.helpful ?? null);
  const [difficulty, setDifficulty] = useState(initial.difficulty ?? null);
  const [error, setError] = useState('');

  const save = async (body, apply) => {
    setError('');
    const previous = { helpful, difficulty };
    apply();
    try {
      await sendFeedback(recommendationId, body);
    } catch (err) {
      setHelpful(previous.helpful);
      setDifficulty(previous.difficulty);
      setError(t('learn.feedback.saveFailed'));
    }
  };

  return (
    <div className="lr-feedback">
      <fieldset>
        <legend>{t('learn.feedback.wasHelpful')}</legend>
        <div className="lr-feedback-row">
          <button type="button" className={`outline-btn lr-feedback-btn ${helpful === true ? 'lr-selected' : ''}`} aria-pressed={helpful === true}
            onClick={() => save({ helpful: true }, () => setHelpful(true))}><ThumbsUpIcon /> {t('learn.feedback.helpful')}</button>
          <button type="button" className={`outline-btn lr-feedback-btn ${helpful === false ? 'lr-selected' : ''}`} aria-pressed={helpful === false}
            onClick={() => save({ helpful: false }, () => setHelpful(false))}><ThumbsDownIcon /> {t('learn.feedback.notHelpful')}</button>
        </div>
      </fieldset>
      <fieldset>
        <legend>{t('learn.feedback.howDifficulty')}</legend>
        <div className="lr-feedback-row">
          {DIFFICULTY_OPTIONS.map(([value, labelKey]) => (
            <button key={value} type="button" className={`outline-btn ${difficulty === value ? 'lr-selected' : ''}`} aria-pressed={difficulty === value}
              onClick={() => save({ difficulty: value }, () => setDifficulty(value))}>{t(labelKey)}</button>
          ))}
        </div>
      </fieldset>
      {error && <p className="error-text" role="alert">{error}</p>}
      {(helpful !== null || difficulty) && !error && <p className="lr-thanks" role="status">{t('learn.feedback.thanks')}</p>}
    </div>
  );
};

export default ContentFeedback;