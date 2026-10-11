import { useTranslation } from 'react-i18next';
import { tierNameKey } from './tierMeta';

/** FREE / PRO / PREMIUM pill. `demo` appends the "Demo Account" marker for presentation accounts. */
const TierBadge = ({ tier, demo = false, size = 'md', className = '' }) => {
  const { t } = useTranslation();
  if (!tier) return null;
  const key = String(tier).toLowerCase();
  return (
    <span className={`tier-badge tier-badge-${key} tier-badge-${size} ${className}`} data-tier={tier}>
      <span className="tier-badge-name">{t(tierNameKey(tier))}</span>
      {demo && <span className="tier-badge-demo">{t('tier.demoAccount')}</span>}
    </span>
  );
};

export default TierBadge;
