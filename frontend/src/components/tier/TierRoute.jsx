import { useTier } from '../../context/TierContext';
import UpgradePrompt from './UpgradePrompt';

/**
 * Route-level guard for pages that are wholly tied to one feature:
 *   <Route path="/x" element={<ProtectedRoute><Layout><TierRoute feature="ADVANCED_AI_TUTOR" requiredTier="PREMIUM"><X/></TierRoute></Layout></ProtectedRoute>} />
 * A Free user typing the URL sees the upgrade prompt instead of the page. This is a UX layer, not
 * security: every API the page calls is separately authorised server-side.
 */
const TierRoute = ({ feature, requiredTier = 'PRO', children }) => {
  const { access, tier, loading, features } = useTier();
  if (loading && Object.keys(features).length === 0) return <div className="center-screen">…</div>;
  if (access(feature) === 'NONE') {
    return (
      <div className="page-grid">
        <UpgradePrompt requiredTier={requiredTier} currentTier={tier} />
      </div>
    );
  }
  return children;
};

export default TierRoute;
