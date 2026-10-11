import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTier } from '../context/TierContext';
import TierBadge from '../components/tier/TierBadge';
import PlanUpgradePanel from '../components/tier/PlanUpgradePanel';
import { TIER_DEMO_ACCOUNTS } from '../components/tier/demoAccounts';
import { PLAN_QUERY_PARAM, isPaidPlan, normalizePlan } from '../utils/planSelection';
import { CheckIcon, CrossIcon, LockIcon } from '../components/tier/Icons';
import { TIER_ORDER, tierRank, tierNameKey } from '../components/tier/tierMeta';

// Matrix rows shown on the page (feature keys are the server's; the matrix itself comes from the API).
const ROWS = [
  ['BASIC_PRACTICE', 'practice'],
  ['BASIC_ANALYTICS', 'analytics'],
  ['ADVANCED_ANALYTICS', 'advancedAnalytics'],
  ['BASIC_RECOMMENDATIONS', 'recommendations'],
  ['ADVANCED_RECOMMENDATIONS', 'advancedRecommendations'],
  ['STUDY_PLAN', 'studyPlan'],
  ['MISTAKE_BANK', 'mistakeBank'],
  ['FLASHCARDS', 'flashcards'],
  ['EXAM_SIMULATION', 'examSimulation'],
  ['DETAILED_EXAM_REPORT', 'examReports'],
  ['AI_DOUBT_SOLVING', 'aiDoubt'],
  ['AI_PERSONALIZED_LEARNING', 'aiPersonalized'],
  ['ADVANCED_AI_TUTOR', 'advancedTutor'],
  ['READINESS_PREDICTIONS', 'readiness'],
  ['ADAPTIVE_LEARNING_PATHS', 'adaptivePaths'],
  ['PREMIUM_CONTENT', 'premiumContent'],
  ['ADVANCED_GAMIFICATION', 'advancedGamification'],
];

const LIMIT_ROWS = [
  ['practicePerDay', 'practice'],
  ['aiPerDay', 'ai'],
  ['recommendationsPerDay', 'recommendations'],
  ['examsPerMonth', 'exams'],
];

const Cell = ({ level }) => {
  const { t } = useTranslation();
  if (level === 'FULL') return <span className="plan-cell plan-cell-full"><CheckIcon /> {t('tier.included')}</span>;
  if (level === 'LIMITED') return <span className="plan-cell plan-cell-limited"><CheckIcon /> {t('tier.limited')}</span>;
  return <span className="plan-cell plan-cell-none"><CrossIcon /> {t('tier.notIncluded')}</span>;
};

const PlansPage = () => {
  const { t } = useTranslation();
  const { tier, isDemo, subscription } = useTier();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // ?plan=PRO|PREMIUM comes from the pricing section. It only decides what this screen highlights;
  // the account's real tier (from the server) decides everything else, and checkout is re-validated
  // by the API. The query string survives refresh and direct navigation.
  const selectedPlan = normalizePlan(searchParams.get(PLAN_QUERY_PARAM));
  const showUpgradePanel = isPaidPlan(selectedPlan);
  const [catalog, setCatalog] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/tier/plans').then(({ data }) => !cancelled && setCatalog(data)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Placeholder checkout: asks the server. With no payment provider configured the server answers
  // 501 and changes nothing - we show that honestly instead of pretending a purchase happened.
  const startCheckout = async (target) => {
    setBusy(target);
    try {
      await api.post('/tier/checkout', { tier: target });
    } catch {
      // 501 PAYMENT_NOT_CONFIGURED is the expected answer today.
    } finally {
      setBusy('');
      setCheckoutOpen(true);
    }
  };

  // Explicit, user-confirmed demo action: signs in to the seeded demo account through the normal
  // login endpoint (same authorization as any user) - never a silent switch from the pricing page.
  const exploreDemo = async (account) => {
    await login({ email: account.email, password: account.password });
    navigate('/dashboard');
  };

  const plans = catalog?.plans || [];
  const matrix = catalog?.matrix || {};

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>{t('tier.plans.title')}</h2>
        <p>{t('tier.plans.subtitle')}</p>
        {isDemo && <p className="plans-note">{t('tier.plans.demoNote')}</p>}
      </section>

      {showUpgradePanel && (
        <PlanUpgradePanel
          selectedTier={selectedPlan}
          currentTier={tier || 'FREE'}
          subscription={subscription}
          isDemo={isDemo}
          checkoutState={busy ? 'busy' : checkoutOpen ? 'unavailable' : 'idle'}
          onCheckout={() => startCheckout(selectedPlan)}
          demoAccount={TIER_DEMO_ACCOUNTS.find((account) => account.tier === selectedPlan) || null}
          onExploreDemo={exploreDemo}
        />
      )}

      <div className="plans-grid">
        {TIER_ORDER.map((planTier) => {
          const plan = plans.find((p) => p.tier === planTier);
          const isCurrent = tier === planTier;
          const isUpgrade = tier && tierRank(planTier) > tierRank(tier);
          return (
            <article key={planTier} className={`plan-card plan-card-${planTier.toLowerCase()} ${isCurrent ? 'plan-card-current' : ''} ${selectedPlan === planTier ? 'plan-card-selected' : ''}`}>
              <TierBadge tier={planTier} size="lg" />
              <h3>{t(tierNameKey(planTier))}</h3>
              <p className="plan-card-tagline">{t(`tier.plans.tagline.${planTier.toLowerCase()}`)}</p>
              <ul className="plan-limit-list">
                {LIMIT_ROWS.map(([limitKey, labelKey]) => {
                  const value = plan?.limits?.[limitKey];
                  if (plan && value === undefined) return null;
                  return (
                    <li key={limitKey}>
                      {t(`tier.plans.limit.${labelKey}`, { value: plan ? (value === null ? t('tier.unlimited') : value) : '…' })}
                    </li>
                  );
                })}
              </ul>
              {isCurrent ? (
                <button type="button" className="outline-btn plan-card-cta" disabled>{t('tier.currentPlan')}</button>
              ) : isUpgrade ? (
                <button
                  type="button"
                  className="primary-btn plan-card-cta"
                  disabled={isDemo || busy === planTier}
                  onClick={() => startCheckout(planTier)}
                >
                  {t('tier.upgradeTo', { plan: t(tierNameKey(planTier)) })}
                </button>
              ) : (
                <button type="button" className="outline-btn plan-card-cta" disabled>
                  <LockIcon size={12} /> {t('tier.included')}
                </button>
              )}
            </article>
          );
        })}
      </div>

      {checkoutOpen && !showUpgradePanel && (
        <section className="panel" role="status">
          <h3>{t('tier.plans.checkoutTitle')}</h3>
          <p>{t('tier.plans.checkoutBody')}</p>
        </section>
      )}

      <section className="panel plans-compare">
        <h3>{t('tier.plans.compare')}</h3>
        <table className="plans-table">
          <thead>
            <tr>
              <th />
              {TIER_ORDER.map((planTier) => (
                <th key={planTier}>{t(tierNameKey(planTier))}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([featureKey, labelKey]) => (
              <tr key={featureKey}>
                <td>{t(`tier.features.${labelKey}`)}</td>
                {TIER_ORDER.map((planTier) => (
                  <td key={planTier}>
                    <Cell level={matrix[featureKey]?.[planTier] || 'NONE'} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default PlansPage;
