import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Award, ArrowRight, Lock, Mail, AlertCircle, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function HrLogin() {
  const [email, setEmail] = useState('hr@smartrecruit.io');
  const [password, setPassword] = useState('recruiter123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginHR } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginHR(email, password);
      navigate('/hr/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed. Please verify HR credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <Award className="w-5 h-5" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            Smart<span className="text-indigo-400">Recruit</span>
          </span>
        </Link>
        <h2 className="text-2xl font-extrabold text-white">HR Recruiter Portal Sign In</h2>
        <p className="mt-2 text-xs text-slate-400">
          Organization Tenancy • Top-5 Recommendation Board • Human Decision Authority
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 py-8 px-6 shadow-xl border border-slate-800 rounded-2xl sm:px-10">
          {error && (
            <div className="mb-4 p-3 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Recruiter Work Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="hr@smartrecruit.io"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-lg text-sm hover:bg-indigo-500 shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Verifying Recruiter Credentials...' : 'Sign In to HR Portal'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Seed demo HR info */}
          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400 mb-1">Pre-Seeded Demo Recruiter Account:</p>
            <p className="text-xs font-mono text-indigo-400">hr@smartrecruit.io • recruiter123</p>
          </div>

          <div className="mt-6 text-center text-xs text-slate-400">
            Need to onboard your organization?{' '}
            <Link to="/hr/register" className="font-bold text-indigo-400 hover:text-indigo-300">
              Register New Organization
            </Link>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link to="/candidate/login" className="text-xs text-slate-500 hover:text-slate-300">
            ← Switch to Candidate Portal Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

