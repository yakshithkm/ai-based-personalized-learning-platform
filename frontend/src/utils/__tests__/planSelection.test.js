import { describe, expect, it } from 'vitest';
import { getPostAuthPath, normalizePlan, resolvePricingAction, withPlan } from '../planSelection';

describe('plan selection helpers', () => {
  it('only accepts FREE, PRO and PREMIUM', () => {
    expect(normalizePlan('pro')).toBe('PRO');
    expect(normalizePlan(' PREMIUM ')).toBe('PREMIUM');
    expect(normalizePlan('FREE')).toBe('FREE');
    for (const bad of ['ADMIN', 'enterprise', '', null, undefined, 'PRO;DROP']) expect(normalizePlan(bad)).toBeNull();
  });

  it('only carries paid plans through URLs', () => {
    expect(withPlan('/register', 'PRO')).toBe('/register?plan=PRO');
    expect(withPlan('/register', 'FREE')).toBe('/register');
    expect(withPlan('/register', 'junk')).toBe('/register');
    expect(getPostAuthPath('PREMIUM')).toBe('/plans?plan=PREMIUM');
    expect(getPostAuthPath('FREE')).toBe('/dashboard');
    expect(getPostAuthPath(null)).toBe('/dashboard');
  });
});

describe('resolvePricingAction', () => {
  const as = (tier) => ({ tier });

  it('logged-out visitors go to register, preserving the plan', () => {
    expect(resolvePricingAction({ plan: 'free', user: null }).to).toBe('/register');
    expect(resolvePricingAction({ plan: 'pro', user: null }).to).toBe('/register?plan=PRO');
    expect(resolvePricingAction({ plan: 'premium', user: null }).to).toBe('/register?plan=PREMIUM');
  });

  it.each([
    // [current, selected, to, labelKey, disabled]
    ['FREE', 'free', '/dashboard', 'home.pricing.openDashboard', false],
    ['FREE', 'pro', '/plans?plan=PRO', null, false],
    ['FREE', 'premium', '/plans?plan=PREMIUM', null, false],
    ['PRO', 'free', '/dashboard', 'home.pricing.openDashboard', false],
    ['PRO', 'pro', '/plans?plan=PRO', 'tier.currentPlan', true],
    ['PRO', 'premium', '/plans?plan=PREMIUM', null, false],
    ['PREMIUM', 'free', '/dashboard', 'home.pricing.openDashboard', false],
    ['PREMIUM', 'pro', '/plans', 'home.pricing.viewMyPlan', false],
    ['PREMIUM', 'premium', '/plans?plan=PREMIUM', 'tier.currentPlan', true],
  ])('%s user, %s card', (current, plan, to, labelKey, disabled) => {
    expect(resolvePricingAction({ plan, user: as(current) })).toMatchObject({ to, labelKey, disabled });
  });

  it('never routes anywhere that changes a tier (navigation only)', () => {
    const action = resolvePricingAction({ plan: 'premium', user: as('FREE') });
    expect(Object.keys(action).sort()).toEqual(['disabled', 'isCurrent', 'labelKey', 'to']);
  });
});
