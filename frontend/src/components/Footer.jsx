import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ShieldCheck, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          {/* Brand Info */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                Smart<span className="text-brand-400">Recruit</span>
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm mb-4">
              Next-generation AI recruitment SaaS empowering talent teams with automated screening,
              turn-by-turn AI interviews, transparent candidate scoring, and strictly human-controlled hiring decisions.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Responsible AI Governance & Multi-Tenant Isolation</span>
            </div>
          </div>

          {/* Product links */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Platform</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/features" className="hover:text-white transition-colors">Resume Analysis</Link></li>
              <li><Link to="/features" className="hover:text-white transition-colors">AI Interview Engine</Link></li>
              <li><Link to="/features" className="hover:text-white transition-colors">Top-5 Ranking Board</Link></li>
              <li><Link to="/how-it-works" className="hover:text-white transition-colors">5-Step Workflow</Link></li>
              <li><Link to="/pricing" className="hover:text-white transition-colors">Pricing & Plans</Link></li>
            </ul>
          </div>

          {/* Portals */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Portals</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/candidate/login" className="hover:text-white transition-colors">Candidate Sign In</Link></li>
              <li><Link to="/candidate/register" className="hover:text-white transition-colors">Candidate Registration</Link></li>
              <li><Link to="/hr/login" className="hover:text-white transition-colors">HR Recruiter Sign In</Link></li>
              <li><Link to="/hr/register" className="hover:text-white transition-colors">HR Organization Onboarding</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Request Enterprise Demo</Link></li>
            </ul>
          </div>

          {/* Compliance & Legal */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Governance</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/privacy" className="hover:text-white transition-colors">Data Privacy & Retention</Link></li>
              <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/about" className="hover:text-white transition-colors">Responsible AI Ethics</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Support & Security</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© {new Date().getFullYear()} Smart Recruit SaaS Platform. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Engineered for fair, consistent, and explainable hiring.
          </p>
        </div>
      </div>
    </footer>
  );
}

