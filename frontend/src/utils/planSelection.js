import { TIER_ORDER, tierRank } from '../components/tier/tierMeta';

/**
 * Plan selection from the public pricing section.
 *
 * The selected plan is only ever a UI hint: it decides which screen to open after
 * login/registration. It is never proof of entitlement - the server resolves the tier from the
 * database and refuses anything the account has not been granted (see /api/tier/checkout).
 */

export const PLAN_QUERY_PARAM = 'plan';

/** 'pro' | 'PRO' -> 'PRO'. Anything outside FREE / PRO / PREMIUM -> null. */
export const normalizePlan = (value) => {
  const upper = String(value ?? '').trim().toUpperCase();
  return TIER_ORDER.includes(upper) ? upper : null;
};

/** Only paid plans need to survive navigation; FREE is the default path. */
export const isPaidPlan = (plan) => {
  const normalized = normalizePlan(plan);
  return normalized === 'PRO' || normalized === 'PREMIUM';
};

/** '/register' + PRO -> '/register?plan=PRO'. FREE / invalid plans leave the path untouched. */
export const withPlan = (path, plan) => (isPaidPlan(plan) ? `${path}?${PLAN_QUERY_PARAM}=${normalizePlan(plan)}` : path);

/** Where to land after a successful login/registration. */
export const getPostAuthPath = (plan) => (isPaidPlan(plan) ? withPlan('/plans', plan) : '/dashboard');

/**
 * What a landing-page pricing button does for a given plan.
 *   user === null -> logged-out visitor.
 * Returns { to, labelKey, isCurrent, disabled }. `labelKey: null` means "use the card's own CTA".
 * Navigation never changes the account's tier.
 */
export const resolvePricingAction = ({ plan, user }) => {
  const target = normalizePlan(plan) || 'FREE';

  if (!user) {
    return { to: target === 'FREE' ? '/register' : withPlan('/register', target), labelKey: null, isCurrent: false, disabled: false };
  }

  // Admin sessions live in their own portal; the pricing buttons just take them there.
  if (user.isAdmin) {
    return { to: '/admin', labelKey: null, isCurrent: false, disabled: false };
  }

  const current = normalizePlan(user.tier) || 'FREE';
  const isCurrent = current === target;

  if (target === 'FREE') {
    return { to: '/dashboard', labelKey: 'home.pricing.openDashboard', isCurrent, disabled: false };
  }
  if (isCurrent) {
    return { to: withPlan('/plans', target), labelKey: 'tier.currentPlan', isCurrent: true, disabled: true };
  }
  if (tierRank(current) > tierRank(target)) {
    // e.g. a Premium user looking at Pro: show their plan, no upgrade/downgrade.
    return { to: '/plans', labelKey: 'home.pricing.viewMyPlan', isCurrent: false, disabled: false };
  }
  return { to: withPlan('/plans', target), labelKey: null, isCurrent: false, disabled: false };
};
