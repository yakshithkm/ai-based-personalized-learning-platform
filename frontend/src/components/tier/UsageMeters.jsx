import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTier } from '../../context/TierContext';
import TierBadge from './TierBadge';

const ORDER = ['PRACTICE', 'AI', 'RECOMMENDATIONS', 'EXAMS'];

/** Plan + live quota usage, straight from GET /tier/me (what the server is actually counting). */
const UsageMeters = ({ className = '' }) => {
  const { t } = useTranslation();
  const { usage, tier, isDemo, refresh } = useTier();
  // Navigating back to the dashboard must show what the server counts now, not the value cached
  // at login.
  useEffect(() => {
    refresh();
  }, [refresh]);
  if (!usage || !tier) return null;

  return (
    <section className={`panel usage-meters ${className}`} aria-label={t('tier.usage.title')}>
      <div className="usage-meters-head">
        <h3>{t('tier.usage.title')}</h3>
        <TierBadge tier={tier} demo={isDemo} />
      </div>
      <div className="usage-meter-list">
        {ORDER.filter((key) => usage[key]).map((key) => {
          const row = usage[key];
          const pct = row.unlimited || !row.limit ? 0 : Math.min(100, Math.round((row.used / row.limit) * 100));
          const state = !row.unlimited && pct >= 100 ? 'full' : pct >= 80 ? 'warn' : 'ok';
          return (
            <div className="usage-meter" key={key}>
              <div className="usage-meter-row">
                <span>{t(`tier.usage.${key}`)}</span>
                <strong>
                  {row.unlimited
                    ? t('tier.usage.unlimitedUsed', { used: row.used })
                    : t('tier.usage.of', { used: row.used, limit: row.limit })}
                </strong>
              </div>
              {!row.unlimited && (
                <div className="usage-meter-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                  <span className={`usage-meter-fill usage-${state}`} style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default UsageMeters;
