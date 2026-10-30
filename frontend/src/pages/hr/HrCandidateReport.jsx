import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer
} from 'recharts';
import { Award, ArrowLeft, ShieldAlert, ShieldCheck, CheckCircle2, AlertTriangle, Lock, Clock, AlertOctagon } from 'lucide-react';
import api from '../../services/api';

export default function HrCandidateReport() {
  const { reportId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await api.get(`/reports/${reportId}`);
        setReport(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [reportId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p>Report not found.</p>
        <Link to="/hr/jobs" className="text-xs font-bold text-indigo-400 mt-2 inline-block">Return to Job Catalog</Link>
      </div>
    );
  }

  const radarData = [
    { subject: 'Technical Depth (35%)', score: report.technical_rating },
    { subject: 'Problem Solving (25%)', score: report.problem_solving_rating },
    { subject: 'Job Skills (20%)', score: report.skills_rating },
    { subject: 'Communication (10%)', score: report.communication_rating },
    { subject: 'Project Depth (10%)', score: report.project_rating },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <Link to="/hr/jobs" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Jobs
      </Link>

      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-2 inline-block">
            Confidential Recruiter Scorecard
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{report.candidate_name}</h1>
          <p className="text-xs text-slate-400 mt-1">{report.anonymized_alias} • Evaluated for {report.job_title}</p>
        </div>
        <div className="text-right">
          <span className="text-4xl font-extrabold text-indigo-400">{report.overall_score}%</span>
          <span className="text-[11px] block text-slate-400 font-semibold uppercase tracking-wider">Interview Rating</span>
        </div>
      </div>

      {/* Confidential Recruiter Notes Box */}
      {report.recruiter_confidential_notes && (
        <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-xs space-y-1.5 text-amber-200">
          <div className="flex items-center gap-2 font-bold text-amber-400 uppercase tracking-wider">
            <Lock className="w-4 h-4" />
            <span>Confidential Recruiter Assessment Notes</span>
          </div>
          <p className="leading-relaxed text-amber-100">{report.recruiter_confidential_notes}</p>
        </div>
      )}

      {/* Proctoring & Security Audit */}
      {report.security_audit && (
        <div className={`p-6 rounded-2xl border text-xs space-y-4 ${
          report.security_audit.flagged_for_review
            ? 'bg-red-950/30 border-red-800/60'
            : report.security_audit.violation_count > 0
            ? 'bg-amber-950/30 border-amber-800/60'
            : 'bg-emerald-950/30 border-emerald-800/60'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
            <div className="flex items-center gap-2.5">
              {report.security_audit.flagged_for_review ? (
                <div className="p-2 rounded-xl bg-red-500/20 text-red-400">
                  <AlertOctagon className="w-5 h-5" />
                </div>
              ) : report.security_audit.violation_count > 0 ? (
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Secure Full-Screen Proctoring Audit
                  {report.security_audit.flagged_for_review && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-red-500/30 text-red-300 border border-red-500/40">
                      Flagged for HR Review
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Three-Strike Policy Enforcement: System terminates and flags for recruiter inspection without automatic rejection.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-semibold">Total Violations:</span>
              <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                report.security_audit.violation_count >= 3
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : report.security_audit.violation_count > 0
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                {report.security_audit.violation_count} / {report.security_audit.max_violations || 3} Strikes
              </span>
            </div>
          </div>

          {report.security_audit.termination_reason && (
            <div className="p-3 rounded-xl bg-red-900/30 border border-red-800/40 text-red-200 text-xs">
              <strong>Termination Reason:</strong> {report.security_audit.termination_reason}
            </div>
          )}

          {report.security_audit.violations && report.security_audit.violations.length > 0 ? (
            <div className="space-y-2 pt-1">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Chronological Violation Timeline</h4>
              <div className="space-y-2">
                {report.security_audit.violations.map((v, i) => (
                  <div key={i} className="flex items-start justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-red-400">Strike #{v.violation_number}</span>
                        <span className="text-slate-400 font-medium">({v.violation_type.replace('_', ' ')})</span>
                      </div>
                      <p className="text-slate-300 text-[11px]">{v.description}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono shrink-0 ml-4">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(v.occurred_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Candidate maintained full-screen compliance throughout the entire assessment.
            </p>
          )}
        </div>
      )}

      {/* Competency Radar & Dimension Scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">5-Dimensional Competency Radar</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" />
                <Radar name="Performance" dataKey="score" stroke="#818cf8" fill="#6366f1" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Dimension Ratings</h3>
          {radarData.map((d, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-300">{d.subject}</span>
                <span className="text-indigo-400 font-bold">{d.score}%</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className="bg-indigo-500 h-2 rounded-full"
                  style={{ width: `${d.score}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
          <h3 className="font-bold text-emerald-400 uppercase tracking-wider mb-3">Identified Strengths</h3>
          <ul className="space-y-1.5 text-slate-300">
            {report.strengths?.map((st, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>{st}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
          <h3 className="font-bold text-amber-400 uppercase tracking-wider mb-3">Skill Gaps & Notes</h3>
          <ul className="space-y-1.5 text-slate-300">
            {report.weaknesses?.map((w, i) => (
              <li key={i} className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

