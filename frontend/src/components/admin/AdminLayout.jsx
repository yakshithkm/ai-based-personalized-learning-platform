import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../BrandLogo';

const NAV_ITEMS = [
  {
    to: '/admin',
    label: 'Dashboard',
    end: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-10h8V3h-8v8z" />
      </svg>
    ),
  },
  {
    to: '/admin/students',
    label: 'Students',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.42 0-9 2.24-9 5v3h18v-3c0-2.76-4.58-5-9-5z" />
      </svg>
    ),
  },
  {
    to: '/admin/questions',
    label: 'Question Bank',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h16v14H4V4zm2 2v10h12V6H6zm3 3h6v2H9V9zm0 4h6v2H9v-2z" />
      </svg>
    ),
  },
  {
    to: '/admin/subjects',
    label: 'Subjects',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 5h8v6H3V5zm10 0h8v14h-8V5zM3 13h8v6H3v-6z" />
      </svg>
    ),
  },
  {
    to: '/admin/topics',
    label: 'Topics',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2l9 5-9 5-9-5 9-5zm0 8.5l6.5-3.6V13c0 3.5-2.9 6.6-6.5 7.6C8.4 19.6 5.5 16.5 5.5 13V6.9L12 10.5z" />
      </svg>
    ),
  },
  {
    to: '/admin/exams',
    label: 'Exams',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 2h8a1 1 0 0 1 1 1v1h1a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h1V3a1 1 0 0 1 1-1zm0 3H7v15h10V5h-1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V5zm1-1v1h6V4H9zm-.5 6h7v1.5h-7V10zm0 3h7v1.5h-7V13zm0 3h4.5v1.5H8.5V16z" />
      </svg>
    ),
  },
  {
    to: '/admin/analytics',
    label: 'Analytics',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 9h3v10H5V9zm5-4h3v14h-3V5zm5 7h3v7h-3v-7z" />
      </svg>
    ),
  },
];

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z" />
  </svg>
);

const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M10 17v-2H3v-6h7V7l5 5-5 5zM10 2h9a1 1 0 011 1v18a1 1 0 01-1 1h-9v-2h8V4h-8V2z" />
  </svg>
);

const AdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const onLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className={`admin-shell ${sidebarOpen ? 'admin-sidebar-open' : ''}`}>
      <button
        type="button"
        className="admin-mobile-toggle"
        onClick={() => setSidebarOpen((prev) => !prev)}
        aria-label={sidebarOpen ? 'Close admin menu' : 'Open admin menu'}
      >
        {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
      </button>

      {sidebarOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <BrandLogo to="/admin" text="TutorMind" />
          <span className="admin-badge">Admin</span>
        </div>

        <nav className="admin-nav" aria-label="Admin navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-profile-card">
            <div className="admin-avatar" aria-hidden="true">
              {(user?.name || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="admin-profile-meta">
              <strong>{user?.name || 'Admin'}</strong>
              <span>{user?.email}</span>
            </div>
          </div>
          <button type="button" className="admin-logout-btn" onClick={onLogout}>
            <LogoutIcon />
            Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
};

export default AdminLayout;