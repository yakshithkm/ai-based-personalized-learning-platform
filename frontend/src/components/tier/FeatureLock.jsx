import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LockIcon } from './Icons';
import { tierNameKey } from './tierMeta';

/**
 * Locked placeholder for a card/section whose DATA the server withheld. Keeps the layout slot and
 * shows what unlocks it. (The content is genuinely absent from the response - this is not a blur
 * over hidden data.)
 */
const FeatureLock = ({ title, requiredTier = 'PRO', minHeight = 140, className = '' }) => {
  const { t } = useTranslation();
  const plan = t(tierNameKey(requiredTier));
  return (
    <div className={`feature-lock ${className}`} style={{ minHeight }} role="note">
      <span className="feature-lock-icon"><LockIcon size={18} /></span>
      {title && <strong className="feature-lock-title">{title}</strong>}
      <span className="feature-lock-text">{t('tier.lock.body', { plan })}</span>
      <Link to="/plans" className="outline-btn feature-lock-cta">{t('tier.upgradeTo', { plan })}</Link>
    </div>
  );
};

export default FeatureLock;
