import { useState } from 'react';
import { sendFeedback } from '../../api/learning';
import { ThumbsDownIcon, ThumbsUpIcon } from './learningUi';

const DIFFICULTY_OPTIONS = [
  ['too-easy', 'Too easy'],
  ['just-right', 'Just right'],
  ['too-difficult', 'Too difficult'],
];

// Lightweight feedback stored per resource and used as a ranking signal.
const ContentFeedback = ({ recommendationId, initial = {} }) => {
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
      setError('Could not save your feedback. Please try again.');
    }
  };

  return (
    <div className="lr-feedback">
      <fieldset>
        <legend>Was this helpful?</legend>
        <div className="lr-feedback-row">
          <button type="button" className={`outline-btn lr-feedback-btn ${helpful === true ? 'lr-selected' : ''}`} aria-pressed={helpful === true}
            onClick={() => save({ helpful: true }, () => setHelpful(true))}><ThumbsUpIcon /> Helpful</button>
          <button type="button" className={`outline-btn lr-feedback-btn ${helpful === false ? 'lr-selected' : ''}`} aria-pressed={helpful === false}
            onClick={() => save({ helpful: false }, () => setHelpful(false))}><ThumbsDownIcon /> Not helpful</button>
        </div>
      </fieldset>
      <fieldset>
        <legend>How was the difficulty?</legend>
        <div className="lr-feedback-row">
          {DIFFICULTY_OPTIONS.map(([value, label]) => (
            <button key={value} type="button" className={`outline-btn ${difficulty === value ? 'lr-selected' : ''}`} aria-pressed={difficulty === value}
              onClick={() => save({ difficulty: value }, () => setDifficulty(value))}>{label}</button>
          ))}
        </div>
      </fieldset>
      {error && <p className="error-text" role="alert">{error}</p>}
      {(helpful !== null || difficulty) && !error && <p className="lr-thanks" role="status">Thanks - this helps tune what you see next.</p>}
    </div>
  );
};

export default ContentFeedback;