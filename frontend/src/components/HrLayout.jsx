import React from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, PlusCircle, CheckSquare, BarChart3, Building2, Bell, LogOut, ShieldAlert, Award
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

export default function HrLayout() {
  const { user, isHR, logout, loading } = useAuth();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-400"></div>
      </div>
    );
  }

  if (!user) {
    navigate('/hr/login');
    return null;
  }

  if (!isHR) {
    navigate('/candidate/dashboard');
    return null;
  }

  const navItems = [
    { label: 'Recruitment Overview', path: '/hr/dashboard', icon: LayoutDashboard },
    { label: 'Job Postings', path: '/hr/jobs', icon: Briefcase },
    { label: 'Create New Job', path: '/hr/jobs/create', icon: PlusCircle },
    { label: 'Hiring Decisions', path: '/hr/decisions', icon: CheckSquare },
    { label: 'Analytics & Audit', path: '/hr/analytics', icon: BarChart3 },
    { label: 'Organization Tenancy', path: '/hr/organization', icon: Building2 },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/hr/login');
  };

  const orgName = user.organization?.name || 'Talent Acquisition Team';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row">
      {/* Dark Enterprise Sidebar */}
      <aside className="w-full md:w-64 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Smart<span className="text-indigo-400">Recruit</span></h1>
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50">
              HR Enterprise
            </span>
          </div>
        </div>

        {/* Organization Tenancy Badge */}
        <div className="p-4 mx-3 my-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-800/60 font-bold flex items-center justify-center text-sm">
            {orgName.substring(0, 2).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Tenant</p>
            <p className="text-sm font-semibold text-slate-100 truncate">{orgName}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path || (item.path !== '/hr/dashboard' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Responsible AI Notice */}
        <div className="p-4 mx-3 mb-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>Final hiring authority is legally restricted to human recruiters.</span>
        </div>

        {/* Logout */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-950/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out HR Session</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-900">
        <header className="h-16 bg-slate-950/80 backdrop-blur border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800/80">
              HR Recruiter Management Mode
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-200">{user.full_name}</p>
              <p className="text-xs text-slate-400">Recruiter Admin</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-indigo-400/20">
              {user.full_name?.split(' ').map(n => n[0]).join('') || 'HR'}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

