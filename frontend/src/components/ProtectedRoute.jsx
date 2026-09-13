import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requireAdmin = false, redirectTo = '/login' }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="center-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to={redirectTo} replace />;
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
