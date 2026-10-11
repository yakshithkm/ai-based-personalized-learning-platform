import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { onTierBlocked, TIER_CODES } from '../../utils/tierErrors';
import { tierNameKey, nextTier } from './tierMeta';
import UpgradePrompt from './UpgradePrompt';
import { LockIcon } from './Icons';

/**
 * One app-wide dialog for anything the backend refused for tier reasons. Mounted once in Layout and
 * driven by the axios interceptor, so every page gets the same, translated upgrade experience.
 */
const TierBlockedModal = () => {
  const { t, i18n } = useTranslation();
  const [detail, setDetail] = useState(null);

  useEffect(() => onTierBlocked(setDetail), []);
  useEffect(() => {
    if (!detail) return undefined;
    const onKey = (event) => event.key === 'Escape' && setDetail(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [detail]);

  if (!detail) return null;
  const close = () => setDetail(null);

  let body;
  if (detail.code === TIER_CODES.USAGE_LIMIT_REACHED) {
    const upgradeTier = detail.requiredTier || nextTier(detail.currentTier);
    const what = t(`tier.usage.${detail.usageKey}`, { defaultValue: t('tier.limit.title') });
    const when = detail.resetsAt
      ? new Intl.DateTimeFormat(i18n.language || 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(detail.resetsAt))
      : null;
    body = (
      <section className="upgrade-prompt upgrade-prompt-limit">
        <div className="upgrade-prompt-head">
          <span className="upgrade-prompt-icon"><LockIcon size={18} /></span>
          <h3>{t('tier.limit.title')}</h3>
        </div>
        {detail.fairUse ? (
          <p className="upgrade-prompt-body">{t('tier.limit.fairUse')}</p>
        ) : (
          <p className="upgrade-prompt-body">{t('tier.limit.body', { what, used: detail.used, limit: detail.limit })}</p>
        )}
        {when && <p className="upgrade-prompt-sub">{t('tier.limit.resets', { when })}</p>}
        {!detail.fairUse && detail.requiredTier && (
          <>
            <p className="upgrade-prompt-sub">{t('tier.limit.upgradeHint', { plan: t(tierNameKey(upgradeTier)) })}</p>
            <Link to="/plans" className="primary-btn upgrade-prompt-cta" onClick={close}>
              {t('tier.upgradeTo', { plan: t(tierNameKey(upgradeTier)) })}
            </Link>
          </>
        )}
      </section>
    );
  } else {
    body = (
      <UpgradePrompt
        requiredTier={detail.requiredTier || 'PRO'}
        currentTier={detail.currentTier}
        expired={detail.code === TIER_CODES.SUBSCRIPTION_EXPIRED}
        onNavigate={close}
      />
    );
  }

  return (
    <div className="tier-modal-backdrop" role="presentation" onClick={close}>
      <div className="tier-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        {body}
        <button type="button" className="outline-btn tier-modal-close" onClick={close}>{t('tier.close')}</button>
      </div>
    </div>
  );
};

export default TierBlockedModal;
