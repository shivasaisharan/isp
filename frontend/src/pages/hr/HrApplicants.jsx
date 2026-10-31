import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Users, Award, ArrowLeft, Search, Eye, Filter, ArrowUpDown,
  CheckCircle2, XCircle, AlertOctagon, Clock, ShieldAlert, Sparkles, FileText, Check, X
} from 'lucide-react';
import api from '../../services/api';

export default function HrApplicants() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [search, setSearch] = useState('');
  const [assessmentFilter, setAssessmentFilter] = useState('ALL');
  const [pipelineFilter, setPipelineFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('fit_desc');
  const [loading, setLoading] = useState(true);

  // Decision Modal States
  const [modalType, setModalType] = useState(null); // 'accept' | 'reject' | null
  const [activeApp, setActiveApp] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState({ type: '', text: '' });

  const fetchApplicants = async () => {
    try {
      const [jobRes, appsRes] = await Promise.all([
        api.get(`/jobs/${jobId}`),
        api.get(`/applications/job/${jobId}/applicants`)
      ]);
      setJob(jobRes.data);
      setApplicants(appsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicants();
  }, [jobId]);

  // Open Accept Modal
  const handleOpenAccept = (app) => {
    if (app.status === 'accepted' || app.status === 'selected') {
      alert("This candidate has already been accepted.");
      return;
    }
    setActiveApp(app);
    setModalType('accept');
    setNotes(`Candidate demonstrates strong alignment with role competencies (${app.overall_ranking_score}% overall fit). Recommended for formal offer.`);
    setFeedbackMsg({ type: '', text: '' });
  };

  // Open Reject Modal
  const handleOpenReject = (app) => {
    if (app.status === 'rejected') {
      alert("This candidate has already been rejected.");
      return;
    }
    setActiveApp(app);
    setModalType('reject');
    setNotes(`After thorough review of candidate profile and evaluation metrics (${app.overall_ranking_score}% overall fit), team decided to proceed with other applicants.`);
    setFeedbackMsg({ type: '', text: '' });
  };

  // Close Modal
  const closeModal = () => {
    setModalType(null);
    setActiveApp(null);
    setNotes('');
    setFeedbackMsg({ type: '', text: '' });
  };

  // Submit Final Hiring Decision
  const handleConfirmDecision = async (e) => {
    e.preventDefault();
    if (!notes.trim()) {
      alert("Please provide mandatory HR review notes before confirming.");
      return;
    }
    if (!activeApp) return;

    setSubmitting(true);
    const decisionVal = modalType === 'accept' ? 'ACCEPTED' : 'REJECTED';
    const newStatus = modalType === 'accept' ? 'accepted' : 'rejected';

    try {
      await api.post(`/hr/applications/${activeApp.id}/decision`, {
        decision: decisionVal,
        decision_notes: notes.trim()
      });

      // Update state immediately without requiring page refresh
      setApplicants(prev => prev.map(a => (
        a.id === activeApp.id ? { ...a, status: newStatus } : a
      )));

      setFeedbackMsg({
        type: 'success',
        text: `Candidate successfully marked as ${decisionVal}!`
      });

      setTimeout(() => {
        closeModal();
        fetchApplicants();
      }, 1000);
    } catch (err) {
      console.error(err);
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.detail || "Failed to record hiring decision. Please try again."
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Read-only Status Badge Renderer
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'submitted':
      case 'applied':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Applied
          </span>
        );
      case 'under_review':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-800/80 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span> Resume Under Review
          </span>
        );
      case 'assessment_eligible':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-950/60 text-cyan-300 border border-cyan-800/80 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> Assessment Eligible
          </span>
        );
      case 'interview_pending':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/80 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Interview Pending
          </span>
        );
      case 'interview_in_progress':
      case 'in_progress':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-950/60 text-purple-300 border border-purple-800/80 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span> Interview In Progress
          </span>
        );
      case 'interview_completed':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950/60 text-blue-300 border border-blue-800/80 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Interview Completed
          </span>
        );
      case 'hr_review':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-950/60 text-orange-300 border border-orange-800/80 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span> HR Review
          </span>
        );
      case 'next_round':
      case 'on_hold':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-950/60 text-teal-300 border border-teal-800/80 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span> Next Round
          </span>
        );
      case 'accepted':
      case 'selected':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Accepted
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-rose-400" /> Rejected
          </span>
        );
      case 'withdrawn':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-900 text-slate-500 border border-slate-800 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span> Withdrawn
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-900 text-slate-300 border border-slate-800">
            {status ? status.replace('_', ' ') : 'Unknown'}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
      </div>
    );
  }

  // Filter & Search
  let filtered = applicants.filter(a => {
    const matchesSearch =
      a.candidate_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.anonymized_alias?.toLowerCase().includes(search.toLowerCase());

    const matchesAssessment =
      assessmentFilter === 'ALL' ||
      (assessmentFilter === 'COMPLETED' && a.assessment_status === 'Completed') ||
      (assessmentFilter === 'PENDING' && (a.assessment_status === 'Assessment Pending' || a.assessment_status === 'Interview In Progress')) ||
      (assessmentFilter === 'FLAGGED' && a.assessment_status === 'Terminated (Flagged)') ||
      (assessmentFilter === 'NOT_STARTED' && a.assessment_status === 'Interview Not Started');

    const matchesPipeline =
      pipelineFilter === 'ALL' ||
      a.status === pipelineFilter ||
      (pipelineFilter === 'accepted' && (a.status === 'accepted' || a.status === 'selected'));

    return matchesSearch && matchesAssessment && matchesPipeline;
  });

  // Sorting
  filtered.sort((a, b) => {
    if (sortBy === 'fit_desc') return (b.overall_ranking_score || 0) - (a.overall_ranking_score || 0);
    if (sortBy === 'fit_asc') return (a.overall_ranking_score || 0) - (b.overall_ranking_score || 0);
    if (sortBy === 'interview_desc') return (b.interview_score ?? -1) - (a.interview_score ?? -1);
    if (sortBy === 'resume_desc') return (b.resume_match_score || 0) - (a.resume_match_score || 0);
    return 0;
  });

  return (
    <div className="space-y-6">
      <Link to="/hr/jobs" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Job Catalog
      </Link>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase font-bold text-indigo-400">Applicant Pool</span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              Formula: (Resume 40%) + (Interview 40%) + (Skills 20%)
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{job?.title}</h1>
          <p className="text-xs text-slate-400 mt-1">
            {applicants.length} total candidate applications in pipeline • {applicants.filter(a => a.status === 'accepted' || a.status === 'selected').length} accepted • {applicants.filter(a => a.status === 'rejected').length} rejected
          </p>
        </div>

        <Link
          to={`/hr/jobs/${jobId}/top-candidates`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all shrink-0"
        >
          <Award className="w-4 h-4" />
          View Top-5 Candidate Board
        </Link>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        {/* Search */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl md:col-span-1">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate or alias..."
            className="w-full bg-transparent text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        {/* Assessment Status Filter */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
          <Filter className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <select
            value={assessmentFilter}
            onChange={(e) => setAssessmentFilter(e.target.value)}
            className="w-full bg-transparent text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Assessments</option>
            <option value="COMPLETED">Completed Scorecards</option>
            <option value="PENDING">Assessment Pending / In Progress</option>
            <option value="FLAGGED">Terminated / Flagged for Review</option>
            <option value="NOT_STARTED">Interview Not Started</option>
          </select>
        </div>

        {/* Pipeline Stage Filter */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
          <span className="text-slate-500 text-[11px] font-semibold shrink-0">Stage:</span>
          <select
            value={pipelineFilter}
            onChange={(e) => setPipelineFilter(e.target.value)}
            className="w-full bg-transparent text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Pipeline Stages</option>
            <option value="submitted">Applied</option>
            <option value="under_review">Resume Under Review</option>
            <option value="interview_pending">Interview Pending</option>
            <option value="interview_completed">Interview Completed</option>
            <option value="hr_review">HR Review</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Sort Order */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
          <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full bg-transparent text-slate-200 focus:outline-none"
          >
            <option value="fit_desc">Highest Overall Fit</option>
            <option value="fit_asc">Lowest Overall Fit</option>
            <option value="interview_desc">Highest Interview Score</option>
            <option value="resume_desc">Highest Resume Match</option>
          </select>
        </div>
      </div>

      {/* Applicant Table Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No applicants found matching the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/50">
                  <th className="p-4">Candidate / Blind Alias</th>
                  <th className="p-4">Resume Match (40%)</th>
                  <th className="p-4">Interview Score (40%)</th>
                  <th className="p-4">Skills Coverage (20%)</th>
                  <th className="p-4">Overall Fit</th>
                  <th className="p-4">Pipeline Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-900/40 transition-colors">
                    {/* Candidate */}
                    <td className="p-4">
                      <span className="font-bold text-white block">{app.candidate_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{app.anonymized_alias}</span>
                    </td>

                    {/* Resume Match */}
                    <td className="p-4 font-semibold text-slate-300">
                      {app.resume_match_score}%
                    </td>

                    {/* Interview Score */}
                    <td className="p-4">
                      {app.interview_score !== null && app.interview_score !== undefined ? (
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                            app.interview_score >= 70 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                            app.interview_score >= 50 ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                            'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {app.interview_score}%
                          </span>
                          {app.assessment_status === 'Terminated (Flagged)' && (
                            <span title="Flagged for security review" className="text-red-400">
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className={`text-[11px] px-2 py-0.5 rounded border inline-block ${
                          app.assessment_status === 'Interview In Progress' ? 'bg-indigo-950/40 border-indigo-800/60 text-indigo-300' :
                          app.assessment_status === 'Assessment Pending' ? 'bg-amber-950/40 border-amber-800/60 text-amber-300' :
                          app.assessment_status === 'Terminated (Flagged)' ? 'bg-red-950/40 border-red-800/60 text-red-300' :
                          'bg-slate-900 border-slate-800 text-slate-400'
                        }`}>
                          {app.assessment_status || 'Interview Not Started'}
                        </span>
                      )}
                    </td>

                    {/* Skills Coverage */}
                    <td className="p-4 font-semibold text-slate-300">
                      {app.skills_match_score}%
                    </td>

                    {/* Overall Fit Score */}
                    <td className="p-4">
                      <div className="flex items-baseline gap-1">
                        <span className="font-extrabold text-indigo-400 text-sm">{app.overall_ranking_score}%</span>
                        <span className="text-[10px] text-slate-500 font-mono">Fit</span>
                      </div>
                    </td>

                    {/* READ-ONLY PIPELINE STATUS BADGE (NO DROPDOWN) */}
                    <td className="p-4">
                      {renderStatusBadge(app.status)}
                    </td>

                    {/* ACTIONS: VIEW SCORE + EXACTLY TWO HIRING DECISIONS (ACCEPT | REJECT) */}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* VIEW SCORE LINK */}
                        <Link
                          to={`/hr/applications/${app.id}/scorecard`}
                          title="View complete evaluation scorecard"
                          className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="hidden sm:inline">Score</span>
                        </Link>

                        {/* ACCEPT BUTTON (GREEN) */}
                        <button
                          onClick={() => handleOpenAccept(app)}
                          disabled={app.status === 'accepted' || app.status === 'selected'}
                          title={app.status === 'accepted' || app.status === 'selected' ? 'Candidate already accepted' : 'Accept candidate for position'}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-sm ${
                            app.status === 'accepted' || app.status === 'selected'
                              ? 'bg-emerald-950/50 text-emerald-600 border border-emerald-900/40 cursor-not-allowed opacity-60'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Accept</span>
                        </button>

                        {/* REJECT BUTTON (RED) */}
                        <button
                          onClick={() => handleOpenReject(app)}
                          disabled={app.status === 'rejected'}
                          title={app.status === 'rejected' ? 'Candidate already rejected' : 'Reject candidate application'}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-sm ${
                            app.status === 'rejected'
                              ? 'bg-rose-950/50 text-rose-600 border border-rose-900/40 cursor-not-allowed opacity-60'
                              : 'bg-rose-600 hover:bg-rose-500 text-white active:scale-95'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          CONFIRMATION MODAL: ACCEPT / REJECT CANDIDATE
          ========================================================================= */}
      {modalType && activeApp && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`bg-slate-950 rounded-3xl max-w-lg w-full p-6 sm:p-8 border shadow-2xl text-slate-100 animate-fadeIn space-y-4 ${
            modalType === 'accept' ? 'border-emerald-500/40' : 'border-rose-500/40'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl border ${
                modalType === 'accept'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              }`}>
                {modalType === 'accept' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <XCircle className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {modalType === 'accept' ? 'Confirm Candidate Selection' : 'Confirm Candidate Rejection'}
                </h3>
                <p className="text-xs text-slate-400">Position: {job?.title}</p>
              </div>
            </div>

            {/* Candidate & Scores Summary Card */}
            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Candidate</span>
                  <span className="text-white font-bold">{activeApp.candidate_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Candidate ID</span>
                  <span className="text-indigo-300 font-mono text-[11px] font-semibold">{activeApp.anonymized_alias || activeApp.candidate_id?.slice(0, 8)}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Overall Fit</span>
                  <span className="text-sm font-extrabold text-emerald-400">{activeApp.overall_ranking_score || activeApp.overall_score || 0}%</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Resume Match</span>
                  <span className="text-sm font-bold text-slate-200">{activeApp.resume_match_score || 0}%</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Interview Score</span>
                  <span className="text-sm font-bold text-slate-200">{activeApp.interview_score !== null && activeApp.interview_score !== undefined ? `${activeApp.interview_score}%` : 'Pending'}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {modalType === 'accept'
                ? `Confirming this decision will update the application status to ACCEPTED across all HR dashboards, record an immutable audit trail, and notify the candidate.`
                : `Confirming this decision will update the application status to REJECTED across all HR dashboards, record your justification in the compliance audit trail, and notify the candidate.`
              }
            </p>

            {feedbackMsg.text && (
              <div className={`p-3 text-xs rounded-xl border ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-800 text-rose-300'
              }`}>
                {feedbackMsg.text}
              </div>
            )}

            <form onSubmit={handleConfirmDecision} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                  {modalType === 'accept' ? 'Decision Notes' : 'Rejection Reason'} <span className={modalType === 'accept' ? 'text-emerald-400' : 'text-rose-400'}>*</span>
                </label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    modalType === 'accept'
                      ? "Enter official hiring rationale and offer considerations..."
                      : "Enter objective justification for not advancing this candidate..."
                  }
                  className={`w-full bg-slate-900 border rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none ${
                    modalType === 'accept' ? 'border-slate-800 focus:border-emerald-500' : 'border-slate-800 focus:border-rose-500'
                  }`}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 ${
                    modalType === 'accept'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {modalType === 'accept' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  {submitting
                    ? 'Processing Decision...'
                    : modalType === 'accept'
                    ? 'Confirm Acceptance'
                    : 'Confirm Rejection'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
