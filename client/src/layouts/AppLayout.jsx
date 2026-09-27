import { Suspense, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageLoader from '../components/PageLoader';

const NAV_ITEMS = {
  candidate: [
    { to: '/candidate/dashboard', label: 'Dashboard' },
    { to: '/candidate/profile', label: 'Profile' },
    { to: '/candidate/resume', label: 'Resume' },
    { to: '/candidate/assessment', label: 'Assessment' },
    { to: '/candidate/interview', label: 'AI Interview' },
    { to: '/candidate/progress', label: 'Progress' },
    { to: '/candidate/connections', label: 'Connections' },
    { to: '/candidate/notifications', label: 'Notifications' },
    { to: '/candidate/settings', label: 'Settings' },
  ],
  recruiter: [
    { to: '/recruiter/dashboard', label: 'Dashboard' },
    { to: '/recruiter/candidates', label: 'Candidates' },
    { to: '/recruiter/connections', label: 'Connections' },
    { to: '/recruiter/notifications', label: 'Notifications' },
    { to: '/recruiter/company', label: 'Company' },
    { to: '/recruiter/profile', label: 'Profile' },
    { to: '/recruiter/settings', label: 'Settings' },
  ],
  admin: [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/questions', label: 'Questions' },
    { to: '/admin/assessments', label: 'Assessments' },
    { to: '/admin/companies', label: 'Companies' },
  ],
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = NAV_ITEMS[user.role] || [];

  return (
    <div className="app-shell">
      <div className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)} />
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="dot" /> Hirevion
        </div>
        <nav className="sidebar-nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="btn btn-secondary btn-sm" onClick={logout}>
          Log out
        </button>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button className="topbar-menu-btn" onClick={() => setMobileOpen((o) => !o)} aria-label="Toggle menu">
            ☰
          </button>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
              {user.role}
            </span>
            <span>{user.email}</span>
          </div>
        </header>
        <main className="content-area">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
