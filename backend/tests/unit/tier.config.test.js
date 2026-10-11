const {
  TIER_ORDER, FEATURES, FEATURE_PERMISSIONS, TIER_LIMITS, FAIR_USE_CEILINGS, USAGE_KEYS,
} = require('../../src/config/tiers');
const svc = require('../../src/services/tier/tierService');
const { getPeriodKey, getPeriodResetAt } = require('../../src/services/tier/usageService');

const rank = (v) => (v === true ? 2 : v === 'LIMITED' ? 1 : 0);

describe('tier configuration', () => {
  test('every feature key has an entry for every tier', () => {
    Object.values(FEATURES).forEach((feature) => {
      expect(FEATURE_PERMISSIONS[feature]).toBeDefined();
      TIER_ORDER.forEach((tier) => expect(FEATURE_PERMISSIONS[feature]).toHaveProperty(tier));
    });
  });

  test('access never decreases going up a tier (FREE <= PRO <= PREMIUM)', () => {
    Object.entries(FEATURE_PERMISSIONS).forEach(([feature, row]) => {
      expect(rank(row.PRO)).toBeGreaterThanOrEqual(rank(row.FREE));
      expect(rank(row.PREMIUM)).toBeGreaterThanOrEqual(rank(row.PRO));
    });
  });

  test('numeric limits never decrease going up a tier', () => {
    Object.keys(TIER_LIMITS.FREE).filter((k) => typeof TIER_LIMITS.FREE[k] === 'number').forEach((key) => {
      expect(TIER_LIMITS.PRO[key]).toBeGreaterThanOrEqual(TIER_LIMITS.FREE[key]);
      expect(TIER_LIMITS.PREMIUM[key]).toBeGreaterThanOrEqual(TIER_LIMITS.PRO[key]);
    });
  });

  test('FREE has exactly the specified starting limits', () => {
    expect(TIER_LIMITS.FREE).toMatchObject({ practicePerDay: 20, aiPerDay: 5, examsPerMonth: 2, recommendationsPerDay: 5 });
    expect(TIER_LIMITS.PRO).toMatchObject({ practicePerDay: 100, aiPerDay: 30, examsPerMonth: 10, recommendationsPerDay: 25 });
  });

  test('every usage key maps to a real limit and every unlimited limit has a finite fair-use ceiling', () => {
    Object.values(USAGE_KEYS).forEach((def) => {
      TIER_ORDER.forEach((tier) => expect(TIER_LIMITS[tier]).toHaveProperty(def.limitKey));
      expect(Number.isFinite(FAIR_USE_CEILINGS[def.limitKey])).toBe(true);
    });
  });
});

describe('tierService', () => {
  test('feature helpers', () => {
    expect(svc.hasFeatureAccess('FREE', FEATURES.ADVANCED_ANALYTICS)).toBe(false);
    expect(svc.hasFeatureAccess('PRO', FEATURES.ADVANCED_ANALYTICS)).toBe(true);
    expect(svc.hasFeatureAccess('FREE', FEATURES.AI_DOUBT_SOLVING)).toBe(true); // LIMITED counts as access
    expect(svc.getFeatureAccess('FREE', FEATURES.AI_DOUBT_SOLVING)).toBe('LIMITED');
    expect(svc.getRequiredTier(FEATURES.ADVANCED_ANALYTICS)).toBe('PRO');
    expect(svc.getRequiredTier(FEATURES.ADVANCED_AI_TUTOR)).toBe('PREMIUM');
    expect(svc.getRequiredTier('NOPE')).toBeNull();
  });

  test('unknown / garbage tiers normalise to FREE (fail closed)', () => {
    ['', null, undefined, 'admin', 'pro; DROP', 42, {}].forEach((v) => expect(svc.normalizeTier(v)).toBe('FREE'));
    expect(svc.normalizeTier(' premium ')).toBe('PREMIUM');
    expect(svc.isValidTier('pro')).toBe(false); // admin input must be the exact enum value
  });

  test('missing tier on a legacy user document is FREE', () => {
    expect(svc.resolveTierContext({ name: 'legacy' })).toMatchObject({ tier: 'FREE', expired: false });
  });

  test('expired paid subscriptions fall back to FREE and are reported as expired', () => {
    const now = new Date('2026-10-04T00:00:00Z');
    const past = new Date('2026-09-01T00:00:00Z');
    const future = new Date('2026-12-01T00:00:00Z');
    expect(svc.resolveTierContext({ tier: 'PRO', subscriptionStatus: 'ACTIVE', subscriptionEndDate: future }, now))
      .toMatchObject({ tier: 'PRO', expired: false });
    expect(svc.resolveTierContext({ tier: 'PRO', subscriptionStatus: 'ACTIVE', subscriptionEndDate: past }, now))
      .toMatchObject({ tier: 'FREE', storedTier: 'PRO', expired: true });
    expect(svc.resolveTierContext({ tier: 'PREMIUM', subscriptionStatus: 'EXPIRED' }, now))
      .toMatchObject({ tier: 'FREE', expired: true });
    expect(svc.resolveTierContext({ tier: 'PRO', subscriptionStatus: 'CANCELLED', subscriptionEndDate: future }, now))
      .toMatchObject({ tier: 'PRO', expired: false }); // cancelled but paid through the period
    expect(svc.resolveTierContext({ tier: 'PREMIUM', subscriptionStatus: 'ACTIVE', subscriptionEndDate: null }, now))
      .toMatchObject({ tier: 'PREMIUM', expired: false }); // demo / admin grants never expire
  });

  test('unlimited plans are bounded by a finite fair-use ceiling; limits serialise without Infinity', () => {
    const enforced = svc.getEnforcedLimit('PREMIUM', 'aiPerDay');
    expect(enforced.unlimited).toBe(true);
    expect(Number.isFinite(enforced.limit)).toBe(true);
    expect(svc.getEnforcedLimit('FREE', 'aiPerDay')).toEqual({ limit: 5, unlimited: false });
    expect(JSON.stringify(svc.serializeLimits('PREMIUM'))).not.toMatch(/Infinity|null.*Infinity/);
    expect(svc.serializeLimits('PREMIUM').aiPerDay).toBeNull();
  });
});

describe('usage periods (IST day / month boundaries)', () => {
  test('buckets by the local calendar day, not UTC', () => {
    // 2026-10-04 20:00 UTC is already 01:30 on Oct 5 in IST.
    const t = new Date('2026-10-04T20:00:00Z');
    expect(getPeriodKey('day', t)).toBe('2026-10-05');
    expect(getPeriodKey('month', new Date('2026-10-31T19:00:00Z'))).toBe('2026-11');
  });

  test('reset instants are local midnights', () => {
    const t = new Date('2026-10-04T20:00:00Z');
    expect(getPeriodResetAt('day', t).toISOString()).toBe('2026-10-05T18:30:00.000Z');
    expect(getPeriodResetAt('month', t).toISOString()).toBe('2026-10-31T18:30:00.000Z');
  });
});
