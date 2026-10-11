import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LockIcon, CheckIcon } from './Icons';
import { BENEFIT_KEYS, tierNameKey } from './tierMeta';

/**
 * Reusable upgrade card. `requiredTier` PRO | PREMIUM decides the copy/benefits. `variant`:
 *   card (default) - full panel with benefit list;  compact - one-line inline notice.
 * `expired` swaps the message for the "subscription expired" one. Never claims a purchase
 * happened: the button only navigates to /plans (checkout placeholder lives there).
 */
const UpgradePrompt = ({ requiredTier = 'PRO', expired = false, currentTier, variant = 'card', onNavigate, className = '' }) => {
  const { t } = useTranslation();
  const plan = t(tierNameKey(requiredTier));
  const benefits = BENEFIT_KEYS[requiredTier] || BENEFIT_KEYS.PRO;

  if (variant === 'compact') {
    return (
      <div className={`upgrade-prompt upgrade-prompt-compact ${className}`} role="note">
        <LockIcon />
        <span>{expired ? t('tier.expired.title') : t('tier.lock.body', { plan })}</span>
        <Link to="/plans" className="upgrade-link" onClick={onNavigate}>
          {t('tier.upgradeTo', { plan })}
        </Link>
      </div>
    );
  }

  return (
    <section className={`upgrade-prompt upgrade-prompt-${String(requiredTier).toLowerCase()} ${className}`} aria-live="polite">
      <div className="upgrade-prompt-head">
        <span className="upgrade-prompt-icon"><LockIcon size={18} /></span>
        <h3>{expired ? t('tier.expired.title') : t('tier.lock.title', { plan })}</h3>
      </div>
      <p className="upgrade-prompt-body">
        {expired ? t('tier.expired.body', { plan: t(tierNameKey(currentTier === 'FREE' ? requiredTier : currentTier)) }) : t('tier.lock.body', { plan })}
      </p>
      {!expired && (
        <>
          <p className="upgrade-prompt-sub">{t('tier.lock.unlockHeading', { plan })}</p>
          <ul className="upgrade-prompt-list">
            {benefits.map((key) => (
              <li key={key}><CheckIcon /> {t(`tier.${key}`)}</li>
            ))}
          </ul>
        </>
      )}
      <Link to="/plans" className="primary-btn upgrade-prompt-cta" onClick={onNavigate}>
        {t('tier.upgradeTo', { plan })}
      </Link>
    </section>
  );
};

export default UpgradePrompt;
