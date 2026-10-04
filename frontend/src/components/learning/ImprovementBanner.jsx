// Before/after accuracy for a completed learning path. Wording reports what happened
// ("after completing"); it never claims the content caused the change.
import { useTranslation } from 'react-i18next';

const ImprovementBanner = ({ title, effectiveness }) => {
  const { t } = useTranslation();
  if (!effectiveness) return null;

  if (!effectiveness.available) {
    return effectiveness.message ? (
      <section className="panel lr-improve" aria-live="polite">
        <h3>{t('learn.improve.title')}</h3>
        <p>{effectiveness.message}</p>
      </section>
    ) : null;
  }

  const { before, after, delta, hasBaseline } = effectiveness;
  const points = delta?.accuracyPoints;
  return (
    <section className="panel lr-improve" aria-live="polite">
      <h3>{title ? t('learn.improve.titleWith', { title }) : t('learn.improve.title')}</h3>
      {hasBaseline && (
        <div className="lr-improve-numbers">
          <div><small>{t('learn.improve.before')}</small><strong>{Math.round(before.accuracy)}%</strong></div>
          <span aria-hidden="true">→</span>
          <div><small>{t('learn.improve.after')}</small><strong>{Math.round(after.accuracy)}%</strong></div>
          <div className={`lr-improve-delta ${points >= 0 ? 'up' : 'down'}`}>
            {t('learn.improve.points', { value: `${points > 0 ? '+' : ''}${points}` })}
          </div>
        </div>
      )}
      <p>{effectiveness.message}</p>
    </section>
  );
};

export default ImprovementBanner;