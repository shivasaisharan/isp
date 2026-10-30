import React, { useState, useEffect } from 'react';
import { BarChart3, ShieldCheck, Activity, Users, CheckCircle2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import api from '../../services/api';

export default function HrAnalytics() {
  const [metrics, setMetrics] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [mRes, aRes] = await Promise.all([
          api.get('/analytics/metrics'),
          api.get('/analytics/audit-logs')
        ]);
        setMetrics(mRes.data);
        setAuditLogs(aRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
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
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Recruitment Analytics & Compliance</h1>
        <p className="text-xs text-slate-400 mt-1">Pipeline throughput, average resume alignment, and immutable ethics audit log.</p>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-xl bg-slate-950 border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase block mb-1">Average Candidate Alignment</span>
          <span className="text-3xl font-extrabold text-indigo-400">{metrics?.average_resume_match || 0}%</span>
          <span className="text-[11px] text-slate-500 block mt-1">Semantic match across candidate pool</span>
        </div>

        <div className="p-5 rounded-xl bg-slate-950 border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase block mb-1">Interviews Conducted</span>
          <span className="text-3xl font-extrabold text-emerald-400">{metrics?.interviews_completed || 0}</span>
          <span className="text-[11px] text-slate-500 block mt-1">Turn-by-turn evaluations complete</span>
        </div>

        <div className="p-5 rounded-xl bg-slate-950 border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase block mb-1">Final Selection Rate</span>
          <span className="text-3xl font-extrabold text-white">
            {metrics?.total_applications > 0 ? Math.round((metrics.selected_candidates / metrics.total_applications) * 100) : 0}%
          </span>
          <span className="text-[11px] text-slate-500 block mt-1">Candidate offers confirmed by HR</span>
        </div>
      </div>

      {/* Stage Distribution Chart */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-base font-bold text-white mb-4">Pipeline Stage Funnel</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics?.pipeline_stages || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="stage" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', fontSize: '12px' }} />
              <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Compliance Audit Trail */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Immutable Responsible AI Compliance Audit Trail
          </h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
            Audit Active
          </span>
        </div>

        <div className="space-y-3">
          {auditLogs.map((log) => (
            <div key={log.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-bold text-indigo-300 block">{log.action}</span>
                <span className="text-slate-400">Actor: {log.actor_role.toUpperCase()} • {JSON.stringify(log.details)}</span>
              </div>
              <span className="text-[10px] text-slate-500 shrink-0">
                {new Date(log.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

