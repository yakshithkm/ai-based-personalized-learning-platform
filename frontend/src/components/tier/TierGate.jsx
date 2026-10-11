import { useTier } from '../../context/TierContext';
import UpgradePrompt from './UpgradePrompt';

/**
 * Renders `children` only when the server-reported entitlements include `feature`; otherwise the
 * upgrade prompt (or `fallback`). This is presentation only - the endpoints behind `children` are
 * independently protected on the backend, so removing this gate would expose nothing.
 *   <TierGate feature="ADVANCED_ANALYTICS" requiredTier="PRO"> ... </TierGate>
 * `allowLimited` (default true) treats 'LIMITED' as open (the backend caps what is served).
 */
const TierGate = ({ feature, requiredTier = 'PRO', allowLimited = true, fallback, variant = 'card', children }) => {
  const { access, tier, loading, features } = useTier();
  const loaded = Object.keys(features).length > 0;
  if (loading && !loaded) return null; // avoid flashing a lock before entitlements arrive
  const level = access(feature);
  const open = level === 'FULL' || (allowLimited && level === 'LIMITED');
  if (open) return children;
  return fallback !== undefined ? fallback : <UpgradePrompt requiredTier={requiredTier} currentTier={tier} variant={variant} />;
};

export default TierGate;
