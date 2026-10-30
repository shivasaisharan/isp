import React from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, FileText, Bot, Clock, Bell, User, Settings, LogOut, Sparkles, Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

export default function CandidateLayout() {
  const { user, isCandidate, logout, loading } = useAuth();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!user) {
    navigate('/candidate/login');
    return null;
  }

  if (!isCandidate) {
    navigate('/hr/dashboard');
    return null;
  }

  const navItems = [
    { label: 'Dashboard', path: '/candidate/dashboard', icon: LayoutDashboard },
    { label: 'Explore Jobs', path: '/candidate/jobs', icon: Briefcase },
    { label: 'My Applications', path: '/candidate/applications', icon: FileText },
    { label: 'Resume & Analysis', path: '/candidate/resume', icon: Sparkles },
    { label: 'AI Mock Interviews', path: '/candidate/interviews', icon: Bot },
    { label: 'Activity History', path: '/candidate/activity', icon: Clock },
    { label: 'Notifications', path: '/candidate/notifications', icon: Bell, badge: unreadCount },
    { label: 'My Profile', path: '/candidate/profile', icon: User },
    { label: 'Privacy & Settings', path: '/candidate/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/candidate/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-md shadow-brand-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">Smart<span className="text-brand-600">Recruit</span></h1>
            <span className="text-xs font-medium text-slate-500">Candidate Portal</span>
          </div>
        </div>

        {/* User Card */}
        <div className="p-4 mx-3 my-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm">
            {user.full_name?.split(' ').map(n => n[0]).join('') || 'C'}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-slate-900 truncate">{user.full_name}</p>
            <p className="text-xs text-slate-500 truncate">{user.candidate_profile?.anonymized_alias || 'Candidate'}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-brand-600 text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active Candidate Session
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/candidate/notifications" className="relative p-2 text-slate-500 hover:text-slate-700">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
              )}
            </Link>
            <div className="h-4 w-px bg-slate-200"></div>
            <Link to="/candidate/profile" className="flex items-center gap-2 text-sm text-slate-700 hover:text-brand-600">
              <span className="font-medium">{user.full_name}</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

