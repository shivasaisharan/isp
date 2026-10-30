import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase, FileText, Bot, Clock, ArrowRight, CheckCircle2, AlertCircle, Sparkles, TrendingUp
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function CandidateDashboard() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [recentJobs, setRecentJobs] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [appsRes, jobsRes, resumesRes] = await Promise.all([
          api.get('/applications/candidate/all'),
          api.get('/jobs'),
          api.get('/candidate/resumes')
        ]);
        setApplications(appsRes.data);
        setRecentJobs(jobsRes.data.slice(0, 3));
        setResumes(resumesRes.data);
      } catch (err) {
        console.error("Dashboard data load error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  const completedInterviews = applications.filter(a => a.status === 'interview_completed' || a.status === 'hr_review' || a.status === 'selected');
  const pendingInterviews = applications.filter(a => a.status === 'interview_pending' || a.status === 'submitted');

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-brand-900 via-indigo-900 to-slate-900 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-brand-500/20 text-brand-300 border border-brand-400/20 mb-3 inline-block">
            Candidate Overview
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.full_name}!
          </h1>
          <p className="mt-1 text-sm text-slate-300 max-w-xl">
            Track your open applications, practice with the turn-by-turn AI interview room, and inspect your objective technical scorecards.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/candidate/jobs"
            className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
          >
            Browse Openings
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Applications Submitted</span>
            <FileText className="w-4 h-4 text-brand-600" />
          </div>
          <span className="text-2xl font-bold text-slate-900">{applications.length}</span>
          <span className="text-[11px] text-slate-500 block mt-1">All active & past roles</span>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Pending AI Interviews</span>
            <Bot className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl font-bold text-slate-900">{pendingInterviews.length}</span>
          <span className="text-[11px] text-slate-500 block mt-1">Ready to complete</span>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Completed Scorecards</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-2xl font-bold text-slate-900">{completedInterviews.length}</span>
          <span className="text-[11px] text-slate-500 block mt-1">Evaluated by rubric</span>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Uploaded Resumes</span>
            <Sparkles className="w-4 h-4 text-indigo-500" />
          </div>
          <span className="text-2xl font-bold text-slate-900">{resumes.length}</span>
          <span className="text-[11px] text-slate-500 block mt-1">Parsed & indexed</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Applications Tracker */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900">Recent Applications</h2>
              <Link to="/candidate/applications" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                View All Applications →
              </Link>
            </div>

            {applications.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                You haven't submitted any applications yet.
                <div className="mt-3">
                  <Link to="/candidate/jobs" className="text-xs font-bold text-brand-600 underline">
                    Explore active job catalog
                  </Link>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {applications.slice(0, 4).map((app) => (
                  <div key={app.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{app.job?.title || 'Engineering Role'}</h3>
                      <p className="text-xs text-slate-500">{app.job?.department} • Applied on {new Date(app.applied_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        app.status === 'selected' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        app.status === 'interview_completed' ? 'bg-brand-50 text-brand-700 border border-brand-200' :
                        app.status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {app.status.replace('_', ' ').toUpperCase()}
                      </span>
                      {app.status === 'submitted' || app.status === 'interview_pending' ? (
                        <Link
                          to={`/candidate/interviews`}
                          className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700"
                        >
                          Take AI Interview
                        </Link>
                      ) : (
                        <Link
                          to={`/candidate/applications`}
                          className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200"
                        >
                          View Details
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick AI Mock Interview Teaser */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-brand-50 to-indigo-50 border border-brand-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700 block mb-1">
                Turn-by-Turn Audio & Voice Practice
              </span>
              <h3 className="text-base font-bold text-slate-900">Prepare with Real-Time AI Interviews</h3>
              <p className="text-xs text-slate-600 max-w-md mt-1">
                Practice answering dynamic questions tailored to your resume with speech synthesis and voice recognition.
              </p>
            </div>
            <Link
              to="/candidate/interviews"
              className="px-4 py-2.5 bg-brand-600 text-white text-xs font-bold rounded-xl hover:bg-brand-700 shadow-sm transition-all shrink-0"
            >
              Enter Interview Room
            </Link>
          </div>
        </div>

        {/* Right Column: Recommended Openings */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">Explore Open Roles</h2>
              <Link to="/candidate/jobs" className="text-xs font-semibold text-brand-600">
                Browse All
              </Link>
            </div>

            <div className="space-y-4">
              {recentJobs.map((j) => (
                <div key={j.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/70 transition-colors">
                  <h3 className="text-sm font-bold text-slate-900">{j.title}</h3>
                  <p className="text-xs text-slate-500 mb-2">{j.department} • {j.location}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {j.required_skills?.slice(0, 3).map((sk, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 font-medium">
                        {sk}
                      </span>
                    ))}
                  </div>
                  <Link
                    to="/candidate/jobs"
                    className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                  >
                    Apply Now <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

