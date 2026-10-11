import { useTranslation } from 'react-i18next';
import { LockIcon } from './Icons';
import { tierNameKey } from './tierMeta';

/** Small lock + plan name, used next to controls / headings that need a higher plan. */
const PremiumBadge = ({ tier = 'PRO', className = '' }) => {
  const { t } = useTranslation();
  return (
    <span className={`premium-badge premium-badge-${String(tier).toLowerCase()} ${className}`}>
      <LockIcon size={11} />
      {t(tierNameKey(tier))}
    </span>
  );
};

export default PremiumBadge;
