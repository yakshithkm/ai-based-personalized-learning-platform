import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import TierBadge from './TierBadge';
import { CheckIcon } from './Icons';
import { BENEFIT_KEYS, tierNameKey, tierRank } from './tierMeta';

/**
 * Reusable "upgrade to <tier>" screen body. Presentational only: it owns no authorization and
 * never changes a tier. A future payment integration plugs in through props:
 *
 *   selectedTier    'PRO' | 'PREMIUM' - what the visitor picked (a UI hint, not an entitlement)
 *   currentTier     the account's real, server-resolved tier
 *   subscription    { status, endDate, ... } as returned by GET /api/tier/me (or null)
 *   checkoutState   'idle' | 'busy' | 'unavailable'  - drive this from the real checkout call
 *   onCheckout      () => void   starts checkout (today POST /api/tier/checkout -> honest 501)
 *   checkoutNotice  optional node replacing the default "not available yet" text; when payments
 *                   exist, render the real status (e.g. pending / activated) here instead
 *   demoAccount     optional { tier, email, password } - enables the clearly labelled demo action
 *   onExploreDemo   (demoAccount) => Promise  signs in through the normal login endpoint
 *
 * A subscription is only ever shown as active when the server reports it; this component never
 * claims activation from navigation or a client-supplied flag.
 */
const PlanUpgradePanel = ({
  selectedTier,
  currentTier = 'FREE',
  subscription = null,
  isDemo = false,
  checkoutState = 'idle',
  onCheckout,
  checkoutNotice,
  demoAccount = null,
  onExploreDemo,
}) => {
  const { t } = useTranslation();
  const [confirmingDemo, setConfirmingDemo] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState(false);

  const plan = t(tierNameKey(selectedTier));
  const current = t(tierNameKey(currentTier));

  if (tierRank(currentTier) >= tierRank(selectedTier)) {
    return (
      <section className="panel plan-upgrade plan-upgrade-owned" aria-live="polite">
        <h3>
          {currentTier === selectedTier
            ? t('tier.plans.upgrade.currentTitle', { plan })
            : t('tier.plans.upgrade.includedTitle', { current, plan })}
        </h3>
      </section>
    );
  }

  const benefits = BENEFIT_KEYS[selectedTier] || [];
  const statusText =
    currentTier === 'FREE' || !subscription?.status
      ? t('tier.plans.upgrade.statusNone')
      : t(`tier.status.${subscription.status}`, { defaultValue: subscription.status });

  const exploreDemo = async () => {
    setDemoBusy(true);
    setDemoError(false);
    try {
      await onExploreDemo(demoAccount);
    } catch {
      setDemoError(true);
      setDemoBusy(false);
    }
  };

  return (
    <section className={`panel plan-upgrade plan-upgrade-${selectedTier.toLowerCase()}`} aria-live="polite">
      <h3>{t('tier.plans.upgrade.title', { plan })}</h3>

      <dl className="plan-upgrade-facts">
        <div>
          <dt>{t('tier.plans.upgrade.current')}</dt>
          <dd><TierBadge tier={currentTier} demo={isDemo} size="sm" /></dd>
        </div>
        <div>
          <dt>{t('tier.plans.upgrade.selected')}</dt>
          <dd><TierBadge tier={selectedTier} size="sm" /></dd>
        </div>
        <div>
          <dt>{t('tier.plans.upgrade.status')}</dt>
          <dd>{statusText}</dd>
        </div>
        <div>
          <dt>{t('tier.plans.upgrade.billing')}</dt>
          <dd>{t('tier.plans.upgrade.billingMonthly')}</dd>
        </div>
      </dl>

      <p className="plan-upgrade-sub">{t('tier.lock.unlockHeading', { plan })}</p>
      <ul className="upgrade-prompt-list">
        {benefits.map((key) => (
          <li key={key}><CheckIcon /> {t(`tier.${key}`)}</li>
        ))}
      </ul>

      <p className="plans-note">{t('tier.plans.upgrade.activationNote')}</p>

      <div className="plan-upgrade-actions">
        <button
          type="button"
          className="primary-btn"
          disabled={isDemo || checkoutState === 'busy'}
          onClick={onCheckout}
        >
          {t('tier.plans.upgrade.checkoutCta', { plan })}
        </button>
        {isDemo && <span className="plans-note">{t('tier.plans.demoNote')}</span>}
      </div>

      {checkoutState === 'unavailable' && (
        <div className="plan-upgrade-notice" role="status">
          <strong>{t('tier.plans.checkoutTitle')}</strong>
          <p>{checkoutNotice || t('tier.plans.checkoutBody')}</p>
        </div>
      )}

      {demoAccount && onExploreDemo && (
        <div className="plan-upgrade-demo">
          <h4>{t('tier.plans.upgrade.demoHeading')}</h4>
          <p className="plans-note">{t('tier.plans.upgrade.demoHint', { plan })}</p>
          {!confirmingDemo ? (
            <button type="button" className="outline-btn" onClick={() => setConfirmingDemo(true)}>
              {t('tier.plans.upgrade.demoCta', { plan })}
            </button>
          ) : (
            <div className="plan-upgrade-actions" role="group" aria-label={t('tier.plans.upgrade.demoConfirm', { plan })}>
              <span>{t('tier.plans.upgrade.demoConfirm', { plan })}</span>
              <button type="button" className="primary-btn" disabled={demoBusy} onClick={exploreDemo}>
                {t('tier.plans.upgrade.demoConfirmYes')}
              </button>
              <button type="button" className="outline-btn" disabled={demoBusy} onClick={() => setConfirmingDemo(false)}>
                {t('tier.plans.upgrade.demoCancel')}
              </button>
            </div>
          )}
          {demoError && <div className="error-text" role="alert">{t('tier.plans.upgrade.demoFailed')}</div>}
        </div>
      )}
    </section>
  );
};

export default PlanUpgradePanel;
