import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { PLAN_QUERY_PARAM, isPaidPlan, normalizePlan, withPlan } from '../utils/planSelection';

const ProtectedRoute = ({ children, requireAdmin = false, redirectTo = '/login' }) => {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (loading) {
    return <div className="center-screen">{t('common.loading')}</div>;
  }

  if (!user) {
    // A logged-out visit to /plans?plan=PRO (pricing button, bookmark, refresh) must not lose the
    // selection: carry it to the login screen, which sends the user back here after sign-in.
    // The value is validated; it is a navigation hint only, never an entitlement.
    const plan = normalizePlan(new URLSearchParams(location.search).get(PLAN_QUERY_PARAM));
    const target = redirectTo === '/login' && location.pathname === '/plans' && isPaidPlan(plan) ? withPlan('/login', plan) : redirectTo;
    return <Navigate to={target} replace />;
  }

  if (requireAdmin && !user.isAdmin) {
    return <Navigate to={redirectTo === '/admin/login' ? '/admin/login' : '/dashboard'} replace />;
  }

  // Reverse guard: an admin session has no business inside the student app
  // (no real practice history, targetExam, etc. - see the /login endpoint fix
  // that stops admins from getting a student session in the first place). This
  // catches the remaining path where an admin, already correctly signed in at
  // /admin/login, manually navigates to a student URL like /dashboard.
  if (!requireAdmin && user.isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return children;
};

export default ProtectedRoute;