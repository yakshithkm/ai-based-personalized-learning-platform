import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';
import { onAttemptSubmitted } from '../utils/appEvents';
import { onTierBlocked, onUsageChanged } from '../utils/tierErrors';

const TierContext = createContext(null);

// Entitlements always come from GET /tier/me (the server resolves them from the database). The
// frontend holds no copy of the permission matrix, so changing tier rules never requires a UI change.
export const TierProvider = ({ children }) => {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);

  const isStudent = Boolean(user && !user.isAdmin);

  // /tier/me is cheap but sits behind the shared API rate limiter, so redundant calls are avoided:
  // a request already in flight is shared, and a normal refresh (mount, tab focus) is skipped when
  // the data is under 3 s old. Events that mean the numbers just changed pass { force: true }.
  const inflight = useRef(null);
  const lastFetchAt = useRef(0);
  const fetchedFor = useRef(null);
  const userKey = user?._id || null;

  const refresh = useCallback(async ({ force = false } = {}) => {
    if (!isStudent) return undefined;
    if (!force && fetchedFor.current === userKey) {
      if (inflight.current) return inflight.current;
      if (Date.now() - lastFetchAt.current < 3000) return undefined;
    }
    fetchedFor.current = userKey;
    lastFetchAt.current = Date.now();
    const run = api
      .get('/tier/me')
      .then(({ data }) => setState(data))
      .catch(() => {
        // Keep the last known state; the backend still enforces everything.
      })
      .finally(() => {
        if (inflight.current === run) inflight.current = null;
      });
    inflight.current = run;
    return run;
  }, [isStudent, userKey]);

  useEffect(() => {
    if (!isStudent) {
      setState(null);
      return undefined;
    }
    setLoading(true);
    refresh().finally(() => setLoading(false));
    // Usage changes whenever an attempt is submitted or a quota error comes back.
    const offAttempt = onAttemptSubmitted(() => refresh({ force: true }));
    const offBlocked = onTierBlocked(() => refresh({ force: true }));
    const offUsage = onUsageChanged(() => refresh({ force: true }));
    // Coming back to the tab after a while shows fresh numbers too (not on every focus change).
    const onVisible = () =>
      document.visibilityState === 'visible' && Date.now() - lastFetchAt.current > 30000 && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      offAttempt();
      offBlocked();
      offUsage();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isStudent, user?._id, refresh]);

  const value = useMemo(() => {
    const features = state?.features || {};
    return {
      // `user.tier` is already server-resolved at login; /tier/me then keeps it fresh.
      tier: state?.tier || user?.tier || null,
      isDemo: Boolean(state?.isDemo ?? user?.isDemo),
      subscription: state?.subscription || user?.subscription || null,
      limits: state?.limits || null,
      usage: state?.usage || null,
      features,
      paymentConfigured: Boolean(state?.paymentConfigured),
      loading,
      refresh,
      // 'FULL' | 'LIMITED' | 'NONE' (unknown / not loaded -> NONE so nothing is *shown* as open).
      access: (feature) => features[feature] || 'NONE',
      can: (feature) => (features[feature] || 'NONE') !== 'NONE',
    };
  }, [state, user, loading, refresh]);

  return <TierContext.Provider value={value}>{children}</TierContext.Provider>;
};

const FALLBACK = {
  tier: null,
  isDemo: false,
  subscription: null,
  limits: null,
  usage: null,
  features: {},
  paymentConfigured: false,
  loading: false,
  refresh: async () => {},
  access: () => 'FULL',
  can: () => true,
};

// Outside a provider (isolated component tests, public pages) the helpers are permissive; this only
// affects what is *rendered* - the backend refuses anything the user is not entitled to regardless.
export const useTier = () => useContext(TierContext) || FALLBACK;

export default TierContext;