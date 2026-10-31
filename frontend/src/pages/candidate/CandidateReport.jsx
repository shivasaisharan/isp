import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer
} from 'recharts';
import { Award, CheckCircle2, AlertTriangle, ArrowLeft, Bot, Sparkles, BookOpen } from 'lucide-react';
import api from '../../services/api';

export default function CandidateReport() {
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-slate-500">Report not found.</p>
        <Link to="/candidate/dashboard" className="text-xs font-bold text-brand-600 mt-2 inline-block">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const radarData = [
    { subject: 'Technical Depth (35%)', score: report.technical_rating, fullMark: 100 },
    { subject: 'Problem Solving (25%)', score: report.problem_solving_rating, fullMark: 100 },
    { subject: 'Job Skills (20%)', score: report.skills_rating, fullMark: 100 },
    { subject: 'Communication (10%)', score: report.communication_rating, fullMark: 100 },
    { subject: 'Project Depth (10%)', score: report.project_rating, fullMark: 100 },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <Link to="/candidate/applications" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to My Applications
      </Link>

      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-brand-900 via-indigo-900 to-slate-900 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-brand-500/20 text-brand-300 border border-brand-400/20 mb-2 inline-block">
            Official Interview Evaluation Scorecard
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">{report.job_title}</h1>
          <p className="text-xs text-slate-300 mt-1">Evaluated on {new Date(report.created_at).toLocaleDateString()} • Rubric v{report.rubric_version}</p>
        </div>
        <div className="text-right">
          <span className="text-4xl font-extrabold text-white">{report.overall_score}%</span>
          <span className="text-[11px] block text-brand-300 font-semibold uppercase tracking-wider">Interview Assessment Score</span>
        </div>
      </div>

      {/* Radar Chart & Key Dimensions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">5-Dimensional Competency Radar</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar name="Performance" dataKey="score" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <span className="text-[10px] text-slate-400 text-center block">Scored against documented rubric criteria</span>
        </div>

        {/* Dimension Scores Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Dimension Ratings Breakdown</h3>
          {radarData.map((d, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-700">{d.subject}</span>
                <span className="text-brand-600 font-bold">{d.score}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-brand-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${d.score}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-3 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Key Candidate Strengths
          </h3>
          <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
            {report.strengths?.map((st, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">•</span>
                <span>{st}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Areas for Growth
          </h3>
          <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
            {report.weaknesses?.map((w, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Feedback & Recommendations */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-brand-600" />
          Actionable Development Suggestions
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
          {report.suggestions_for_improvement}
        </p>
      </div>
    </div>
  );
}

