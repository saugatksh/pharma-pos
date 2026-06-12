import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

const navItems = {
  superadmin: [
    { to: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', exact: true },
    { to: '/pharmacies', label: 'Pharmacies', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { to: '/audit-logs-sa', label: 'Audit Logs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ],
  admin: [
    { to: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', exact: true },
    { to: '/sales', label: 'POS / Sales', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { to: '/medicines', label: 'Medicines', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
    { to: '/inventory', label: 'Inventory', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { to: '/purchases', label: 'Purchases', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
    { to: '/suppliers', label: 'Suppliers', icon: 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z' },
    { to: '/returns', label: 'Returns', icon: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6' },
    { to: '/reports', label: 'Reports', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { to: '/users', label: 'Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { to: '/audit-logs', label: 'Audit Logs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { to: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ],
  staff: [
    { to: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', exact: true },
    { to: '/sales', label: 'POS / Sales', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { to: '/medicines', label: 'Medicines', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
    { to: '/inventory', label: 'Inventory', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  ]
};

const roleConfig = {
  superadmin: { color: 'from-purple-600 to-purple-700', badge: 'bg-purple-500', label: 'Super Admin' },
  admin: { color: 'from-emerald-600 to-green-700', badge: 'bg-emerald-500', label: 'Admin' },
  staff: { color: 'from-blue-600 to-blue-700', badge: 'bg-blue-500', label: 'Staff' },
};

function NavIcon({ path }) {
  return (
    <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      {path.split(' M').map((seg, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={i === 0 ? seg : 'M' + seg} />
      ))}
    </svg>
  );
}

// Animated Dark/Light toggle button
function ThemeToggleBtn({ darkMode, onClick, collapsed }) {
  const [animating, setAnimating] = React.useState(false);

  const handleClick = () => {
    setAnimating(true);
    setTimeout(() => setAnimating(false), 600);
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{
        position: 'relative',
        overflow: 'hidden',
        animation: animating ? (darkMode ? 'rippleOut 0.6s ease' : 'rippleOutDark 0.6s ease') : 'none',
      }}
      className={`w-full flex items-center rounded-xl text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-all mb-1
        ${collapsed ? 'justify-center py-3 px-0 h-11' : 'gap-3 px-3 py-2.5'}`}
    >
      <span style={{
        display: 'inline-block',
        animation: animating ? (darkMode ? 'sunSpin 0.55s ease' : 'moonBounce 0.5s ease') : 'none',
        fontSize: '16px',
        lineHeight: 1,
      }}>
        {darkMode ? '☀️' : '🌙'}
      </span>
      {!collapsed && (
        <span style={{ transition: 'opacity 0.2s' }}>
          {darkMode ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
}

// Chevron icons
function ChevronLeft() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
    </svg>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile overlay
  const [collapsed, setCollapsed] = useState(false); // desktop collapse
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const confirmLogout = async () => {
    setLogoutConfirm(false);
    await logout();
    toast.success('Signed out successfully');
    navigate('/login');
  };

  const items = navItems[user?.role] || [];
  const rc = roleConfig[user?.role] || roleConfig.staff;
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const sidebarBg = darkMode
    ? 'linear-gradient(180deg, #020617 0%, #0f172a 100%)'
    : 'linear-gradient(180deg, #0f172a 0%, #111827 100%)';

  const headerBg = darkMode ? '#1e293b' : '#ffffff';
  const headerBorder = darkMode ? '1px solid #334155' : '1px solid #e2e8f0';
  const pageBg = darkMode ? '#0f172a' : '#f8fafc';

  return (
    <div className="flex h-screen" style={{ background: pageBg, overflow:"hidden" }}>
      <style>{`
        @keyframes slideIn { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
        .nav-item { transition: all 0.15s ease; }
        .nav-item:hover { transform: translateX(2px); }
        .sidebar-anim { animation: slideIn 0.3s ease; }
        .modal-overlay { animation: fadeIn 0.2s ease; }
        .modal-box { animation: scaleIn 0.2s ease; }
        .logout-btn:hover { background: rgba(239,68,68,0.15) !important; color: #f87171 !important; }
        .nav-tooltip { position: absolute; left: calc(100% + 8px); top: 50%; transform: translateY(-50%);
          background: #1e293b; color: white; font-size: 12px; font-weight: 600; padding: 4px 10px;
          border-radius: 8px; white-space: nowrap; pointer-events: none; opacity: 0;
          transition: opacity 0.15s; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .collapsed-nav-item:hover .nav-tooltip { opacity: 1; }
        .sidebar-transition { transition: width 0.25s cubic-bezier(0.4,0,0.2,1); }
      `}</style>

      {/* ── SIDEBAR ── */}
      <aside
        className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 flex flex-col
          sidebar-transition overflow-hidden
          ${collapsed ? 'lg:w-[68px]' : 'lg:w-64'}
          w-64
        `}
        style={{ background: sidebarBg, borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo */}
          <div className={`flex items-center px-4 py-4 flex-shrink-0 ${collapsed ? 'justify-center' : 'gap-3'}`}
            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', minHeight: 64 }}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden ${user?.pharmacyLogo ? '' : `bg-gradient-to-br ${rc.color} shadow-lg`}`}>
              {user?.pharmacyLogo ? (
                <img src={user.pharmacyLogo} alt="Logo" className="w-full h-full object-contain" onError={e => { e.target.style.display='none'; e.target.parentNode.classList.add(`bg-gradient-to-br`, rc.color.split(' ')[0], rc.color.split(' ')[1]); }} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="7" y="1" width="4" height="16" rx="2" fill="white" fillOpacity="0.9"/>
                  <rect x="1" y="7" width="16" height="4" rx="2" fill="white" fillOpacity="0.9"/>
                </svg>
              )}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="font-bold text-white text-sm tracking-tight">PharmaPOS</div>
                <div className="pharmacy-name text-xs text-slate-400 truncate">{user?.pharmacyName || 'System Admin'}</div>
              </div>
            )}
          </div>

          {/* Role badge */}
          {!collapsed && (
            <div className="px-4 pt-3 pb-1 flex-shrink-0">
              <span className={`role-badge inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${rc.badge} text-white`}>
                <span className="w-1.5 h-1.5 rounded-full bg-white opacity-80 inline-block" />
                {rc.label}
              </span>
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-0.5">
            {items.map(item => (
              <div key={item.to} className={`relative ${collapsed ? 'collapsed-nav-item' : ''}`}>
                <NavLink
                  to={item.to}
                  end={item.exact}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `nav-item flex items-center rounded-xl text-sm font-medium transition-all
                    ${collapsed ? 'justify-center px-0 py-3 mx-auto w-11 h-11' : 'gap-3 px-3 py-2.5'}
                    ${isActive
                      ? `bg-gradient-to-r ${rc.color} text-white shadow-lg`
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <NavIcon path={item.icon} />
                  {!collapsed && <span className="nav-label truncate">{item.label}</span>}
                </NavLink>
                {collapsed && <div className="nav-tooltip">{item.label}</div>}
              </div>
            ))}
          </nav>

          {/* Dark mode toggle + collapse */}
          <div className="px-2 py-2 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Dark/Light toggle */}
            <button
              onClick={toggleDarkMode}
              className={`w-full flex items-center rounded-xl text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-all mb-1
                ${collapsed ? 'justify-center py-3 px-0 h-11' : 'gap-3 px-3 py-2.5'}`}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              <span style={{ fontSize: '16px', lineHeight: 1, display: 'block' }}>{darkMode ? '☀️' : '🌙'}</span>
              {!collapsed && <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
            </button>

            {/* Collapse toggle (desktop only) */}
            <button
              onClick={() => setCollapsed(c => !c)}
              className={`hidden lg:flex w-full items-center rounded-xl text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-all
                ${collapsed ? 'justify-center py-3 px-0 h-11' : 'gap-3 px-3 py-2.5'}`}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight /> : <ChevronLeft />}
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>

          {/* User section */}
          <div className="px-2 pb-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {!collapsed ? (
              <div className="px-2 py-2 mt-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${rc.color} flex items-center justify-center text-xs font-bold text-white shadow flex-shrink-0`}>
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="user-name text-sm font-medium text-white truncate">{user?.name}</div>
                    <div className="text-xs text-slate-500 truncate">{user?.username || user?.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => setLogoutConfirm(true)}
                  className="logout-btn w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-400 transition-all duration-150"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="relative collapsed-nav-item mt-2">
                <button
                  onClick={() => setLogoutConfirm(true)}
                  className="logout-btn w-11 h-11 mx-auto flex items-center justify-center rounded-xl text-slate-400 transition-all"
                  title="Sign Out"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
                <div className="nav-tooltip">Sign Out</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="modal-overlay fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0" style={{overflow:"visible"}}>
        {/* Top bar */}
        <header className="px-4 lg:px-6 py-3 flex items-center gap-4 flex-shrink-0"
          style={{ background: headerBg, borderBottom: headerBorder, boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.06)' }}>
          {/* Mobile menu button */}
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex-1" />

          {/* Currency badge */}
          {user?.role !== 'superadmin' && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
              style={{ background: darkMode ? '#334155' : '#f1f5f9', color: 'var(--text-secondary)' }}>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {user?.pharmacyCurrency || 'NPR'}
            </div>
          )}

          {/* Dark mode toggle in header */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-xl transition-all"
            style={{ background: darkMode ? '#334155' : '#f1f5f9', color: 'var(--text-secondary)' }}
            title={darkMode ? 'Light Mode' : 'Dark Mode'}
          >
            <span style={{ fontSize: '16px', lineHeight: 1, display: 'block' }}>{darkMode ? '☀️' : '🌙'}</span>
          </button>

          {/* User */}
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${rc.color} flex items-center justify-center text-xs font-bold text-white shadow-sm`}>
              {initials}
            </div>
            <div className="hidden sm:block text-right">
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user?.name}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{rc.label}</div>
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6" style={{ background: pageBg }}>
          <Outlet />
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      {logoutConfirm && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="modal-box rounded-2xl shadow-2xl w-full max-w-sm p-6" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-50 mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-center mb-1" style={{ color: 'var(--text-primary)' }}>Sign Out</h3>
            <p className="text-sm text-center mb-6" style={{ color: 'var(--text-secondary)' }}>Are you sure you want to sign out of PharmaPOS?</p>
            <div className="flex gap-3">
              <button onClick={() => setLogoutConfirm(false)} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
              <button onClick={confirmLogout} className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors">Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}