import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase, Users, Bot, CheckSquare, TrendingUp, PlusCircle, ArrowRight, Award, ShieldAlert
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function HrDashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [metricRes, jobsRes] = await Promise.all([
          api.get('/analytics/metrics'),
          api.get('/jobs/organization/all')
        ]);
        setMetrics(metricRes.data);
        setJobs(jobsRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {user.organization?.name || 'Recruitment HQ'}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
              {user.organization?.plan?.toUpperCase()} PLAN
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Recruitment Command Center
          </h1>
          <p className="mt-1 text-sm text-slate-400 max-w-xl">
            Monitor applicant conversion rates, inspect AI turn-by-turn evaluations, and review Top-5 candidate recommendations.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/hr/jobs/create"
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            Create Job Opening
          </Link>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">Active Openings</span>
            <Briefcase className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-2xl font-bold text-white">{metrics?.active_jobs || 0}</span>
          <span className="text-[11px] text-slate-500 block mt-1">Total {metrics?.total_jobs || 0} listed</span>
        </div>

        <div className="p-5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">Total Applications</span>
            <Users className="w-4 h-4 text-brand-400" />
          </div>
          <span className="text-2xl font-bold text-white">{metrics?.total_applications || 0}</span>
          <span className="text-[11px] text-slate-500 block mt-1">Across all openings</span>
        </div>

        <div className="p-5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">AI Interviews Completed</span>
            <Bot className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold text-white">{metrics?.interviews_completed || 0}</span>
          <span className="text-[11px] text-slate-500 block mt-1">Evaluated by rubric</span>
        </div>

        <div className="p-5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">HR Hired / Selected</span>
            <CheckSquare className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-2xl font-bold text-white">{metrics?.selected_candidates || 0}</span>
          <span className="text-[11px] text-slate-500 block mt-1">Human confirmed offers</span>
        </div>
      </div>

      {/* Main Grid: Pipeline Funnel Chart & Quick Openings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pipeline Chart */}
        <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-base font-bold text-white mb-1">Recruitment Funnel Stage Distribution</h2>
          <p className="text-xs text-slate-400 mb-6">Real-time candidate progression through the 5-step recruitment pipeline.</p>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics?.pipeline_stages || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="stage" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Openings with Top-5 Links */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">Active Openings</h2>
              <Link to="/hr/jobs" className="text-xs text-indigo-400 font-semibold">
                Manage All →
              </Link>
            </div>

            <div className="space-y-3">
              {jobs.slice(0, 3).map((job) => (
                <div key={job.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-100">{job.title}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                      {job.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{job.applicants_count || 0} candidates in pool</p>
                  <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                    <Link
                      to={`/hr/jobs/${job.id}/applicants`}
                      className="text-xs text-slate-300 hover:text-white"
                    >
                      View Pool
                    </Link>
                    <Link
                      to={`/hr/jobs/${job.id}/top-candidates`}
                      className="px-2.5 py-1 bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded text-xs font-bold hover:bg-indigo-600/50 flex items-center gap-1"
                    >
                      <Award className="w-3 h-3" />
                      Top-5 Board
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center gap-2 text-xs text-amber-400/90">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>AI never makes autonomous hiring decisions. Review candidates and log your rationales.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

