import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1 className="brand">PrepAI</h1>
        <p className="exam-tag">{user?.targetExam} Prep</p>
        <nav className="nav-menu">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/practice">Practice</NavLink>
          <NavLink to="/analytics">Analytics</NavLink>
        </nav>
        <button className="outline-btn" onClick={onLogout}>Logout</button>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
};

export default Layout;
