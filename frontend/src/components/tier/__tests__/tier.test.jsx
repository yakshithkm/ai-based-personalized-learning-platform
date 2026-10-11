import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n, { loadAndActivateLanguage } from '../../../i18n';
import TierContext from '../../../context/TierContext';
import TierGate from '../TierGate';
import TierRoute from '../TierRoute';
import TierBlockedModal from '../TierBlockedModal';
import { emitTierBlocked, isTierError } from '../../../utils/tierErrors';

const withTier = (features, tier, children) => (
  <MemoryRouter>
    <TierContext.Provider
      value={{
        tier,
        features,
        loading: false,
        access: (f) => features[f] || 'NONE',
        can: (f) => (features[f] || 'NONE') !== 'NONE',
      }}
    >
      {children}
    </TierContext.Provider>
  </MemoryRouter>
);

beforeEach(async () => {
  localStorage.clear();
  await act(async () => {
    await loadAndActivateLanguage('en');
  });
});

describe('TierGate / TierRoute', () => {
  it('shows the upgrade prompt (not the content) when the server reports no access', () => {
    render(withTier({ ADVANCED_ANALYTICS: 'NONE' }, 'FREE', <TierGate feature="ADVANCED_ANALYTICS" requiredTier="PRO"><p>secret analytics</p></TierGate>));
    expect(screen.queryByText('secret analytics')).toBeNull();
    expect(screen.getByText('Pro feature')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upgrade to Pro' })).toHaveAttribute('href', '/plans');
  });

  it('renders content for FULL and LIMITED access', () => {
    const { rerender } = render(withTier({ X: 'FULL' }, 'PRO', <TierGate feature="X"><p>visible</p></TierGate>));
    expect(screen.getByText('visible')).toBeInTheDocument();
    rerender(withTier({ X: 'LIMITED' }, 'FREE', <TierGate feature="X"><p>visible</p></TierGate>));
    expect(screen.getByText('visible')).toBeInTheDocument();
  });

  it('a Free user on a Premium-only route sees the Premium prompt', () => {
    render(withTier({ ADVANCED_AI_TUTOR: 'NONE' }, 'FREE', <TierRoute feature="ADVANCED_AI_TUTOR" requiredTier="PREMIUM"><p>tutor page</p></TierRoute>));
    expect(screen.queryByText('tutor page')).toBeNull();
    expect(screen.getByText('Premium feature')).toBeInTheDocument();
  });

  it('editing client state cannot be what grants access: unknown features default to locked', () => {
    render(withTier({}, 'PREMIUM', <TierRoute feature="ADVANCED_AI_TUTOR" requiredTier="PREMIUM"><p>tutor page</p></TierRoute>));
    // loading=false and no features reported -> NONE -> locked, whatever `tier` claims
    expect(screen.queryByText('tutor page')).toBeNull();
  });
});

describe('TierBlockedModal (backend refusals)', () => {
  const open = (detail) =>
    act(async () => {
      emitTierBlocked(detail);
    });

  it('USAGE_LIMIT_REACHED shows the quota and the next plan', async () => {
    render(<MemoryRouter><TierBlockedModal /></MemoryRouter>);
    await open({ success: false, code: 'USAGE_LIMIT_REACHED', usageKey: 'AI', used: 5, limit: 5, currentTier: 'FREE', requiredTier: 'PRO', resetsAt: '2026-10-05T18:30:00.000Z' });
    expect(screen.getByText('Limit reached')).toBeInTheDocument();
    expect(screen.getByText('AI questions today: 5 of 5 used.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upgrade to Pro' })).toBeInTheDocument();
  });

  it('a fair-use stop for a top plan offers no upgrade', async () => {
    render(<MemoryRouter><TierBlockedModal /></MemoryRouter>);
    await open({ success: false, code: 'USAGE_LIMIT_REACHED', usageKey: 'AI', fairUse: true, currentTier: 'PREMIUM', requiredTier: null });
    expect(screen.getByText(/fair-use limit/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('SUBSCRIPTION_EXPIRED says so', async () => {
    render(<MemoryRouter><TierBlockedModal /></MemoryRouter>);
    await open({ success: false, code: 'SUBSCRIPTION_EXPIRED', requiredTier: 'PRO', currentTier: 'FREE' });
    expect(screen.getByText('Subscription expired')).toBeInTheDocument();
  });

  it('renders in another language', async () => {
    await act(async () => {
      await loadAndActivateLanguage('hi');
    });
    render(<MemoryRouter><TierBlockedModal /></MemoryRouter>);
    await open({ success: false, code: 'TIER_UPGRADE_REQUIRED', requiredTier: 'PREMIUM', currentTier: 'PRO' });
    expect(screen.getByText('Premium फ़ीचर')).toBeInTheDocument();
    expect(i18n.language).toBe('hi');
  });
});

describe('isTierError', () => {
  it('only matches the structured tier codes, never generic errors', () => {
    expect(isTierError({ success: false, code: 'TIER_UPGRADE_REQUIRED' })).toBe(true);
    expect(isTierError({ success: false, code: 'UNAUTHORIZED' })).toBe(false);
    expect(isTierError({ message: 'Admin access required' })).toBe(false);
    expect(isTierError(undefined)).toBe(false);
  });
});

describe('quota-consuming requests', () => {
  it('flags only successful-spend endpoints, not reads', async () => {
    const { consumesQuota } = await import('../../../utils/tierErrors');
    expect(consumesQuota('post', '/attempts')).toBe(true);
    expect(consumesQuota('POST', '/exams/sessions')).toBe(true);
    expect(consumesQuota('get', '/recommendations/learning')).toBe(true);
    expect(consumesQuota('get', '/recommendations/learning?minutes=30')).toBe(true);
    expect(consumesQuota('post', '/recommendations/abc123/start')).toBe(false);
    expect(consumesQuota('get', '/recommendations/me')).toBe(false);
    expect(consumesQuota('get', '/attempts')).toBe(false);
  });
});