import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { onAttemptSubmitted } from '../utils/appEvents';
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
    label: 'Exam Simulation',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 3h14l4 4v14H4V3zm2 2v14h14V8h-4V5H6zm2 6h8v2H8v-2zm0 4h8v2H8v-2zm0-8h5v2H8V7z" />
      </svg>
    ),
  },
  {
    to: '/weak-topics',
    label: 'Weak Topics',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42A6.92 6.92 0 0119 12a7 7 0 11-3.41-6.01l-1.46 1.46A5 5 0 1017 12a4.93 4.93 0 00-1.59-3.66l1.42-1.42A6.95 6.95 0 0118.83 12 7 7 0 015 12a6.92 6.92 0 012.59-5.41L6.17 5.17A9 9 0 1021 12a8.94 8.94 0 00-3.17-6.83z" />
      </svg>
    ),
  },
  {
    to: '/study-plan',
    label: 'Study Plan',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 2h10a1 1 0 011 1v18a1 1 0 01-1 1H7a1 1 0 01-1-1V3a1 1 0 011-1zm1 2v16h8V4H8zm1 3h6v2H9V7zm0 4h6v2H9v-2zm0 4h4v2H9v-2z" />
      </svg>
    ),
  },
  {
    to: '/mistake-bank',
    label: 'Mistake Bank',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
    ),
  },
  {
    to: '/flashcards',
    label: 'Flashcards',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 5h14v12H3V5zm2 2v8h10V7H5zm4 12h14V7h-2v10H9v2z" />
      </svg>
    ),
  },
  {
    to: '/achievements',
    label: 'Achievements',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 1l9 4v6c0 5.5-3.8 10.7-9 12-5.2-1.3-9-6.5-9-12V5l9-4zm-1 12l6-6-1.4-1.4L11 10.2 8.8 8 7.4 9.4 11 13z" />
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

const FlameIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2c2.5 3 4 5.7 4 8.2A4 4 0 0112 14a4 4 0 01-4-3.8C8 7.7 9.5 5 12 2zm0 20a7 7 0 01-7-7c0-1.9.9-3.4 2-4.7.1 1.6 1.1 2.7 2.3 2.7.9 0 1.4-.6 1.4-1.4 0-.6-.3-1-.6-1.5.9.2 1.9 1.4 1.9 3 0 .8-.3 1.4-.6 2 .9-.1 1.6-1 1.6-2.3 0-.9-.4-1.6-.8-2.3C15.3 10 17 12 17 15a5 5 0 01-5 7z" />
  </svg>
);

const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Localized fallback for the routed page area only — shown while a
// not-yet-loaded page chunk downloads. Keeping this inside Layout's own
// Suspense boundary (instead of relying on the top-level one in App.jsx)
// means the sidebar/header stay mounted and visible instead of the whole
// app flashing to a blank "Loading..." screen on first navigation to a
// route.
const PageContentFallback = () => (
  <div className="page-content-fallback" role="status" aria-live="polite">
    <span className="page-content-spinner" aria-hidden="true" />
    <span>Loading...</span>
  </div>
);

const CrownIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8zm2.7 12h12.6v2H5.7v-2z" />
  </svg>
);

const toneToClass = (tone) => {
  if (tone === 'danger') return 'notification-danger';
  if (tone === 'warning') return 'notification-warning';
  if (tone === 'success') return 'notification-success';
  return 'notification-info';
};

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [streak, setStreak] = useState(0);
  const [subjectTopics, setSubjectTopics] = useState([]);
  const [sidebarHasMoreBelow, setSidebarHasMoreBelow] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const sidebarRef = useRef(null);

  useEffect(() => {
    const onClickAway = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
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

  // Sidebar "more below" hint: only show a scroll cue when the nav list
  // actually overflows its visible height AND hasn't been scrolled all
  // the way down yet — a real signal, not a decorative always-on icon.
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return undefined;

    const updateHint = () => {
      const hasOverflow = el.scrollHeight > el.clientHeight + 4;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
      setSidebarHasMoreBelow(hasOverflow && !atBottom);
    };

    updateHint();
    el.addEventListener('scroll', updateHint, { passive: true });
    window.addEventListener('resize', updateHint);

    // Menu length is fixed at runtime, but fonts/images can still shift
    // layout height after mount, so also recheck shortly after paint.
    const raf = requestAnimationFrame(updateHint);

    return () => {
      el.removeEventListener('scroll', updateHint);
      window.removeEventListener('resize', updateHint);
      cancelAnimationFrame(raf);
    };
  }, [sidebarOpen]);

  // Global Ctrl/Cmd+K shortcut to focus the header search, matching the
  // "Ctrl + K" hint shown next to the search field.
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadHeaderData = async () => {
      try {
        const [analyticsRes, subjectsRes] = await Promise.all([
          api.get('/analytics/me'),
          api.get('/questions/subjects-topics'),
        ]);
        if (cancelled) return;
        setNotifications(analyticsRes?.data?.notifications || []);
        setStreak(analyticsRes?.data?.habit?.currentStreak || 0);
        setSubjectTopics(subjectsRes?.data?.subjects || []);
      } catch (error) {
        // Header chrome degrades gracefully — an empty streak/notification
        // state is a fine fallback if analytics hasn't loaded yet.
      }
    };
    loadHeaderData();

    // Re-run the same fetch whenever any page reports that an attempt was
    // just submitted, so the streak pill updates immediately on a first
    // solve today instead of waiting for the next full page load.
    const unsubscribe = onAttemptSubmitted(() => {
      loadHeaderData();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const onLogout = () => {
    logout();
    navigate('/login');
  };

  const searchSuggestions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];
    const results = [];
    subjectTopics.forEach((entry) => {
      if (entry.subject?.toLowerCase().includes(query)) {
        results.push({ label: entry.subject, kind: 'Subject', topic: `${entry.subject}` });
      }
      (entry.topics || []).forEach((topic) => {
        if (topic?.toLowerCase().includes(query)) {
          results.push({ label: topic, kind: entry.subject, topic: `${entry.subject} - ${topic}` });
        }
      });
    });
    return results.slice(0, 8);
  }, [searchTerm, subjectTopics]);

  const goToSuggestion = (suggestion) => {
    setSearchOpen(false);
    setSearchTerm('');
    navigate(`/practice?topic=${encodeURIComponent(suggestion.topic)}`);
  };

  const onSearchSubmit = (event) => {
    event.preventDefault();
    if (searchSuggestions.length > 0) {
      goToSuggestion(searchSuggestions[0]);
      return;
    }
    const query = searchTerm.trim();
    if (query) {
      setSearchOpen(false);
      navigate(`/practice?search=${encodeURIComponent(query)}`);
    }
  };

  const visibleMenuItems = user?.isAdmin ? [...menuItems, adminMenuItem] : menuItems;
  const initials = (user?.name || 'U').charAt(0).toUpperCase();

  return (
    <div className="app-shell">
      <div className="app-aurora" aria-hidden="true" />

      {sidebarOpen && (
        <div className="header-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} ref={sidebarRef}>
        <div className="brand-wrap">
          <BrandLogo className="sidebar-brand" to="/dashboard" />
          <p className="sidebar-subtitle">AI-Powered Learning</p>
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
          <span className="user-avatar">{initials}</span>
          <div className="user-block-info">
            <p className="user-name">{user?.name}</p>
            <p className="user-email sidebar-user-exam">{user?.targetExam} Aspirant</p>
          </div>
          <span className="user-block-chevron"><ChevronIcon /></span>
        </button>

        <nav className="nav-menu">
          {visibleMenuItems.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setSidebarOpen(false)}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <span className="upgrade-card-icon"><CrownIcon /></span>
            <strong>Unlock Your Potential</strong>
            <p>Get unlimited access to AI insights, mocks &amp; more.</p>
            <a className="solid-btn upgrade-cta" href="/#pricing-section">
              Upgrade to Pro
              <ChevronIcon />
            </a>
          </div>

          <button className="outline-btn sidebar-logout" onClick={onLogout}>
            Logout
          </button>
        </div>

        {sidebarHasMoreBelow && (
          <span className="sidebar-scroll-hint" aria-hidden="true">
            <ChevronIcon />
          </span>
        )}
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

        <div className="header-search-wrap" ref={searchRef}>
          <form className="header-search" role="search" onSubmit={onSearchSubmit}>
            <SearchIcon />
            <input
              ref={searchInputRef}
              type="search"
              name="q"
              placeholder="Search topics, questions, subjects..."
              aria-label="Search"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
            />
            <kbd className="search-kbd">Ctrl + K</kbd>
          </form>

          {searchOpen && searchSuggestions.length > 0 && (
            <div className="header-dropdown search-dropdown" role="listbox">
              {searchSuggestions.map((suggestion) => (
                <button
                  type="button"
                  key={`${suggestion.kind}-${suggestion.label}`}
                  className="header-dropdown-item search-suggestion-item"
                  onClick={() => goToSuggestion(suggestion)}
                >
                  <span>{suggestion.label}</span>
                  <small>{suggestion.kind}</small>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="header-actions">
          <span className="streak-pill" title={`${streak} day ${streak === 1 ? 'streak' : 'streaks'}`}>
            <FlameIcon />
            {streak} day {streak === 1 ? 'streak' : 'streaks'}
          </span>

          <div className="header-profile" ref={notifRef}>
            <button
              type="button"
              className="icon-btn header-notif-btn"
              aria-label="Notifications"
              onClick={() => setNotifOpen((open) => !open)}
            >
              <BellIcon />
              {notifications.length > 0 && <span className="badge-dot notif-count">{notifications.length}</span>}
            </button>

            {notifOpen && (
              <div className="header-dropdown" role="menu">
                <div className="header-dropdown-head">
                  <strong>Notifications</strong>
                </div>
                {notifications.length ? (
                  notifications.map((note) => (
                    <div key={note.type} className={`header-dropdown-item notification-item ${toneToClass(note.tone)}`}>
                      <span>
                        <strong className="notification-title">{note.title}</strong>
                        <br />
                        {note.text}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="header-dropdown-item notification-item">
                    <span>You&apos;re all caught up — nothing needs your attention right now.</span>
                  </div>
                )}
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
              <span className="user-avatar">{initials}</span>
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
        <div className="page-transition" key={location.pathname}>
          <Suspense fallback={<PageContentFallback />}>{children}</Suspense>
        </div>
        <Footer variant="minimal" />
      </main>
    </div>
  );
};

export default Layout;