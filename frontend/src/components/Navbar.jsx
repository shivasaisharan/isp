import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, ShieldCheck, Briefcase, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, isCandidate, isHR } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Smart<span className="text-brand-600">Recruit</span>
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200/50">
              AI SaaS
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/features" className={`text-sm font-medium transition-colors ${isActive('/features') ? 'text-brand-600' : 'text-slate-600 hover:text-slate-900'}`}>
              Features
            </Link>
            <Link to="/how-it-works" className={`text-sm font-medium transition-colors ${isActive('/how-it-works') ? 'text-brand-600' : 'text-slate-600 hover:text-slate-900'}`}>
              How It Works
            </Link>
            <Link to="/solutions" className={`text-sm font-medium transition-colors ${isActive('/solutions') ? 'text-brand-600' : 'text-slate-600 hover:text-slate-900'}`}>
              Solutions
            </Link>
            <Link to="/pricing" className={`text-sm font-medium transition-colors ${isActive('/pricing') ? 'text-brand-600' : 'text-slate-600 hover:text-slate-900'}`}>
              Pricing
            </Link>
            <Link to="/about" className={`text-sm font-medium transition-colors ${isActive('/about') ? 'text-brand-600' : 'text-slate-600 hover:text-slate-900'}`}>
              About
            </Link>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {user ? (
              <Link
                to={isCandidate ? "/candidate/dashboard" : "/hr/dashboard"}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 shadow-sm transition-all"
              >
                Go to {isCandidate ? "Candidate Portal" : "HR Portal"}
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/candidate/login"
                  className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-brand-600 transition-colors"
                >
                  Candidate Sign In
                </Link>
                <Link
                  to="/hr/login"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-all shadow-sm"
                >
                  <Briefcase className="w-4 h-4 text-brand-400" />
                  HR Recruiter Portal
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

