import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Lock, Mail, AlertCircle, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function CandidateLogin() {
  const [email, setEmail] = useState('alex.chen@example.com');
  const [password, setPassword] = useState('candidate123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginCandidate } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginCandidate(email, password);
      navigate('/candidate/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('candidate123');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            Smart<span className="text-brand-600">Recruit</span>
          </span>
        </Link>
        <h2 className="text-2xl font-extrabold text-slate-900">Candidate Portal Sign In</h2>
        <p className="mt-2 text-xs text-slate-600">
          Access your applications, AI mock interviews, and skill scorecards.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  placeholder="alex.chen@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-brand-600 text-white font-bold rounded-lg text-sm hover:bg-brand-700 shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In as Candidate'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs text-slate-500 font-medium mb-2 text-center">Quick Demo Candidate Accounts:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => fillDemo('alex.chen@example.com')}
                className="p-2 text-left bg-slate-50 hover:bg-slate-100 rounded border border-slate-200"
              >
                <span className="font-semibold block text-slate-800">Alex Chen</span>
                <span className="text-slate-500 text-[10px]">AI Engineer</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemo('elena.rostova@example.com')}
                className="p-2 text-left bg-slate-50 hover:bg-slate-100 rounded border border-slate-200"
              >
                <span className="font-semibold block text-slate-800">Elena Rostova</span>
                <span className="text-slate-500 text-[10px]">Full Stack Cloud</span>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-600">
            Don't have a candidate account?{' '}
            <Link to="/candidate/register" className="font-bold text-brand-600 hover:text-brand-700">
              Register now
            </Link>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link to="/hr/login" className="text-xs text-slate-500 hover:text-slate-800">
            Are you an HR Recruiter? Switch to HR Sign In →
          </Link>
        </div>
      </div>
    </div>
  );
}

