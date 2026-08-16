import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from './BrandLogo';
import Footer from './Footer';

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
    to: '/profile',
    label: 'Profile',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.4 0-9 2.2-9 5v2h18v-2c0-2.8-4.6-5-9-5z" />
      </svg>
    ),
  },
];

// Only ever shown to admins — added conditionally in the component body,
// since clicking it as a non-admin previously bounced silently to "/"
// (ProtectedRoute's requireAdmin guard) and looked like a broken link.
const adminMenuItem = {
  to: '/admin-analytics',
  label: 'Admin',
  icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 1l9 4v6c0 5.5-3.8 10.7-9 12-5.2-1.3-9-6.5-9-12V5l9-4zm-1 12l6-6-1.4-1.4L11 10.2 8.8 8 7.4 9.4 11 13z" />
    </svg>
  ),
};

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 10-.7.7l.27.28v.79l5 5L20.49 19l-5-5zm-6 0a4.5 4.5 0 110-9 4.5 4.5 0 010 9z" />
  </svg>
);

const BellIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 22a2.2 2.2 0 002.2-2.2h-4.4A2.2 2.2 0 0012 22zm7-6.2V11c0-3.4-1.8-6.2-5-7V3a2 2 0 10-4 0v1c-3.2.8-5 3.6-5 7v4.8L3 17.6V19h18v-1.4l-2-1.8z" />
  </svg>
);

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
  </svg>
);

const notifications = [
  { id: 1, tone: 'warning', text: 'Your daily goal resets in 3 hours — 4 questions left.' },
  { id: 2, tone: 'success', text: 'New weak-topic drill unlocked for Organic Chemistry.' },
  { id: 3, tone: 'info', text: 'Mock test results from your last attempt are ready to review.' },
];

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    const onClickAway = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const onLogout = () => {
    logout();
    navigate('/login');
  };

  const onSearchSubmit = (event) => {
    event.preventDefault();
    const query = new FormData(event.target).get('q');
    if (query) {
      navigate(`/practice?search=${encodeURIComponent(query)}`);
    }
  };

  const visibleMenuItems = user?.isAdmin ? [...menuItems, adminMenuItem] : menuItems;

  return (
    <div className="app-shell">
      <div className="app-aurora" aria-hidden="true" />

      {sidebarOpen && (
        <div className="header-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand-wrap">
          <BrandLogo className="sidebar-brand" to="/" />
          <p className="nav-badge">{user?.targetExam} Prep</p>
        </div>

        <button
          type="button"
          className="user-block user-block-link"
          onClick={() => {
            setSidebarOpen(false);
            navigate('/profile');
          }}
          aria-label="View profile"
        >
          <span className="user-avatar">{(user?.name || 'U').charAt(0).toUpperCase()}</span>
          <div>
            <p className="user-name">{user?.name}</p>
            <p className="user-email">{user?.email}</p>
          </div>
        </button>

        <nav className="nav-menu">
          {visibleMenuItems.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setSidebarOpen(false)}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button className="outline-btn" onClick={onLogout}>
          Logout
        </button>
      </aside>

      <header className={`app-header ${headerScrolled ? 'scrolled' : ''}`}>
        <button
          type="button"
          className="header-menu-btn"
          aria-label="Toggle navigation menu"
          onClick={() => setSidebarOpen((open) => !open)}
        >
          <MenuIcon />
        </button>

        <form className="header-search" role="search" onSubmit={onSearchSubmit}>
          <SearchIcon />
          <input type="search" name="q" placeholder="Search topics, questions, subjects..." aria-label="Search" />
        </form>

        <div className="header-actions">
          <div className="header-profile" ref={notifRef}>
            <button
              type="button"
              className="icon-btn header-notif-btn"
              aria-label="Notifications"
              onClick={() => setNotifOpen((open) => !open)}
            >
              <BellIcon />
              {notifications.length > 0 && <span className="badge-dot" />}
            </button>

            {notifOpen && (
              <div className="header-dropdown" role="menu">
                <div className="header-dropdown-head">
                  <strong>Notifications</strong>
                </div>
                {notifications.map((note) => (
                  <div key={note.id} className={`header-dropdown-item notification-item notification-${note.tone}`}>
                    <span>{note.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="header-profile" ref={profileRef}>
            <button
              type="button"
              className="header-profile-trigger"
              onClick={() => setProfileOpen((open) => !open)}
              aria-label="Open profile menu"
            >
              <span className="user-avatar">{(user?.name || 'U').charAt(0).toUpperCase()}</span>
            </button>

            {profileOpen && (
              <div className="header-dropdown" role="menu">
                <div className="header-dropdown-head">
                  <p className="user-name">{user?.name}</p>
                  <p className="user-email">{user?.email}</p>
                </div>
                <button
                  type="button"
                  className="header-dropdown-item"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate('/profile');
                  }}
                >
                  View Profile
                </button>
                <button
                  type="button"
                  className="header-dropdown-item"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate('/dashboard');
                  }}
                >
                  Dashboard
                </button>
                <button type="button" className="header-dropdown-item danger" onClick={onLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="main-content">
        {children}
        <Footer variant="minimal" />
      </main>
    </div>
  );
};

export default Layout;