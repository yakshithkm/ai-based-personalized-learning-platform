import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from './BrandLogo';

const menuItems = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-10h8V3h-8v8z" />
      </svg>
    ),
  },
  {
    to: '/practice',
    label: 'Practice',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h16v14H4V4zm2 2v10h12V6H6zm3 14h6v2H9z" />
      </svg>
    ),
  },
  {
    to: '/analytics',
    label: 'Analytics',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 9h3v10H5V9zm5-4h3v14h-3V5zm5 7h3v7h-3v-7z" />
      </svg>
    ),
  },
  {
    to: '/exam-simulation',
    label: 'Exam Sim',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 3h14l4 4v14H4V3zm2 2v14h14V8h-4V5H6zm2 6h8v2H8v-2zm0 4h8v2H8v-2zm0-8h5v2H8V7z" />
      </svg>
    ),
  },
  {
    to: '/admin-analytics',
    label: 'Admin',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 1l9 4v6c0 5.5-3.8 10.7-9 12-5.2-1.3-9-6.5-9-12V5l9-4zm-1 12l6-6-1.4-1.4L11 10.2 8.8 8 7.4 9.4 11 13z" />
      </svg>
    ),
  },
];

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
        <div className="brand-wrap">
          <BrandLogo className="sidebar-brand" to="/" />
          <p className="exam-tag">{user?.targetExam} Prep</p>
        </div>

        <div className="user-block">
          <span className="user-avatar">{(user?.name || 'U').charAt(0).toUpperCase()}</span>
          <div>
            <p className="user-name">{user?.name}</p>
            <p className="user-email">{user?.email}</p>
          </div>
        </div>

        <nav className="nav-menu">
          {menuItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button className="outline-btn" onClick={onLogout}>
          Logout
        </button>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
};

export default Layout;
