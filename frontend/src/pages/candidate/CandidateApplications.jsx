import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Bot, ArrowRight, CheckCircle2, Clock, XCircle, ChevronRight } from 'lucide-react';
import api from '../../services/api';

export default function CandidateApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const res = await api.get('/applications/candidate/all');
        setApplications(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchApplications();
  }, []);

  const stages = [
    { key: 'submitted', label: 'Submitted' },
    { key: 'under_review', label: 'Under Review' },
    { key: 'interview_pending', label: 'Interview Pending' },
    { key: 'interview_completed', label: 'Interview Completed' },
    { key: 'hr_review', label: 'HR Review' },
    { key: 'selected', label: 'Selected' },
  ];

  const getStageIndex = (status) => {
    if (status === 'rejected') return -1;
    return stages.findIndex(s => s.key === status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Application History & Progress</h1>
        <p className="text-xs text-slate-500 mt-1">Revisit previous applications, track stage timelines, and access assessment scorecards.</p>
      </div>

      {applications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-900 mb-1">No Applications Recorded</h3>
          <p className="text-xs text-slate-500 mb-4">You have not submitted applications to any open positions yet.</p>
          <Link to="/candidate/jobs" className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700">
            Browse Job Catalog
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {applications.map((app) => {
            const currentStageIdx = getStageIndex(app.status);
            const isRejected = app.status === 'rejected';

            return (
              <div key={app.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">{app.job?.organization_name || 'Employer'}</span>
                    <h2 className="text-lg font-bold text-slate-900">{app.job?.title}</h2>
                    <p className="text-xs text-slate-500">{app.job?.department} • Applied {new Date(app.applied_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      app.status === 'selected' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      app.status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                      app.status === 'interview_completed' ? 'bg-brand-50 text-brand-700 border border-brand-200' :
                      'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {app.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Progress Stepper Timeline */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Application Stage Timeline</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    {stages.map((st, idx) => {
                      const completed = currentStageIdx >= idx;
                      const isCurrent = currentStageIdx === idx;

                      return (
                        <div
                          key={st.key}
                          className={`p-2.5 rounded-xl border text-center transition-all ${
                            isRejected
                              ? 'bg-slate-50 border-slate-200 text-slate-400'
                              : completed
                              ? isCurrent
                                ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold'
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}
                        >
                          <span className="text-[10px] block font-bold">Step {idx + 1}</span>
                          <span className="text-xs font-medium block truncate">{st.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  {isRejected && (
                    <div className="mt-3 p-3 bg-rose-50 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>This application was concluded after HR review. Thank you for your interest.</span>
                    </div>
                  )}
                </div>

                {/* Match Metrics & Actions */}
                <div className="p-4 rounded-xl bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-6 text-xs">
                    <div>
                      <span className="text-slate-400 block">Resume Match</span>
                      <span className="font-bold text-slate-800">{app.resume_match_score}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Skills Coverage</span>
                      <span className="font-bold text-slate-800">{app.skills_match_score}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Overall Ranking</span>
                      <span className="font-bold text-brand-600">{app.overall_ranking_score}%</span>
                    </div>
                  </div>

                  <div>
                    {app.status === 'submitted' || app.status === 'interview_pending' ? (
                      <Link
                        to="/candidate/interviews"
                        className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 shadow-sm flex items-center gap-1.5"
                      >
                        <Bot className="w-4 h-4" />
                        Take AI Interview
                      </Link>
                    ) : (
                      <Link
                        to="/candidate/interviews"
                        className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg text-xs font-bold hover:bg-slate-300 flex items-center gap-1.5"
                      >
                        View AI Interview Status
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

