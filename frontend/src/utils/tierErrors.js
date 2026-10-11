// Mirrors backend/src/config/tiers.js TIER_ERROR_CODES. The UI never decides access - it only
// reacts to what the server already refused (and to the entitlements the server reports).
export const TIER_CODES = {
  TIER_UPGRADE_REQUIRED: 'TIER_UPGRADE_REQUIRED',
  FEATURE_NOT_AVAILABLE: 'FEATURE_NOT_AVAILABLE',
  USAGE_LIMIT_REACHED: 'USAGE_LIMIT_REACHED',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
};

const BLOCKABLE = new Set(Object.values(TIER_CODES));

export const isTierError = (data) => Boolean(data && data.success === false && BLOCKABLE.has(data.code));

const TIER_BLOCKED_EVENT = 'tutormind:tier-blocked';

export const emitTierBlocked = (detail) => {
  if (typeof window === 'undefined' || !detail) return;
  window.dispatchEvent(new CustomEvent(TIER_BLOCKED_EVENT, { detail }));
};

export const onTierBlocked = (handler) => {
  if (typeof window === 'undefined') return () => {};
  const listener = (event) => handler(event.detail);
  window.addEventListener(TIER_BLOCKED_EVENT, listener);
  return () => window.removeEventListener(TIER_BLOCKED_EVENT, listener);
};

const USAGE_CHANGED_EVENT = 'tutormind:usage-changed';

// Fired after a request that consumes plan quota succeeds, so the meters re-read /tier/me.
export const emitUsageChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(USAGE_CHANGED_EVENT));
};

export const onUsageChanged = (handler) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(USAGE_CHANGED_EVENT, handler);
  return () => window.removeEventListener(USAGE_CHANGED_EVENT, handler);
};

// Successful requests to these endpoints spend quota (practice attempt, exam start, Learn page load).
const QUOTA_ENDPOINTS = [
  ['post', /^\/attempts\/?$/],
  ['post', /^\/exams\/sessions\/?$/],
  ['get', /^\/recommendations\/learning\/?$/],
];
export const consumesQuota = (method, url = '') => {
  const verb = String(method).toLowerCase();
  const path = String(url).split('?')[0];
  return QUOTA_ENDPOINTS.some(([m, re]) => m === verb && re.test(path));
};

// Synthetic payload for "this control is locked for your plan" (no request was made).
export const lockedDetail = (feature, requiredTier = 'PRO', currentTier = 'FREE') => ({
  success: false,
  code: TIER_CODES.TIER_UPGRADE_REQUIRED,
  feature,
  requiredTier,
  currentTier,
});