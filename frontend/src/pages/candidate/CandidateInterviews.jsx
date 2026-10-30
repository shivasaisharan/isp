import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bot, Play, CheckCircle2, Clock, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import api from '../../services/api';

export default function CandidateInterviews() {
  const [applications, setApplications] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchInterviewData = async () => {
      try {
        const [appsRes, reportsRes] = await Promise.all([
          api.get('/applications/candidate/all'),
          api.get('/reports/candidate/all')
        ]);
        setApplications(appsRes.data);
        setReports(reportsRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchInterviewData();
  }, []);

  const handleStartInterview = async (applicationId) => {
    try {
      const res = await api.post('/interviews/start', {
        application_id: applicationId,
        duration_minutes: 15
      });
      navigate(`/candidate/interviews/${res.data.id}`);
    } catch (err) {
      alert(err.response?.data?.detail || "Could not start interview session.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  const activeApps = applications.filter(a => a.status === 'submitted' || a.status === 'interview_pending');

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">AI Turn-by-Turn Interview Lobby</h1>
        <p className="text-xs text-slate-500 mt-1">
          Take scheduled technical and behavioral interviews calibrated to target job requirements.
        </p>
      </div>

      {/* Active Interview Opportunities */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Bot className="w-5 h-5 text-brand-600" />
          Pending Application Interviews
        </h2>

        {activeApps.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            No pending interviews for your active applications.
            <div className="mt-2">
              <Link to="/candidate/jobs" className="text-brand-600 font-bold underline">
                Browse jobs to apply and trigger an interview session
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {activeApps.map((app) => (
              <div key={app.id} className="p-5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{app.job?.title}</h3>
                  <p className="text-xs text-slate-500">{app.job?.department} • 5 Context-Calibrated Questions</p>
                  <span className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                    Ready to start • 15 Minute Session
                  </span>
                </div>
                <button
                  onClick={() => handleStartInterview(app.id)}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 shadow-sm flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  Launch Interview Room
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Interviews & Historical Reports */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          Completed Interview Scorecards
        </h2>

        {reports.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">No completed scorecards available yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {reports.map((r) => (
              <div key={r.id} className="py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{r.job_title}</h3>
                  <p className="text-xs text-slate-500">Evaluated on {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-base font-extrabold text-brand-600">{r.overall_score}%</span>
                    <span className="text-[10px] text-slate-400 block font-medium">Overall Fit</span>
                  </div>
                  <Link
                    to={`/candidate/results/${r.id}`}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1"
                  >
                    View Scorecard <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

