import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Award, ArrowLeft, ShieldCheck, CheckCircle2, AlertTriangle, Eye, CheckSquare, XCircle, Clock, ShieldAlert, Sparkles, X, Check
} from 'lucide-react';
import api from '../../services/api';

export default function HrTopCandidates() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Decision Modal State
  const [modalType, setModalType] = useState(null); // 'accept' | 'reject' | null
  const [activeCandidate, setActiveCandidate] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState({ type: '', text: '' });

  const fetchTopCandidates = async () => {
    try {
      const [jobRes, topRes] = await Promise.all([
        api.get(`/jobs/${jobId}`),
        api.get(`/rankings/job/${jobId}/top-candidates`)
      ]);
      setJob(jobRes.data);
      setCandidates(topRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopCandidates();
  }, [jobId]);

  // Open Accept Modal
  const handleOpenAccept = (cand) => {
    if (cand.status === 'accepted' || cand.status === 'selected') {
      alert("This candidate has already been accepted.");
      return;
    }
    if (cand.status === 'rejected') {
      alert("Cannot accept an already rejected candidate.");
      return;
    }
    setActiveCandidate(cand);
    setModalType('accept');
    setNotes(`Candidate demonstrates strong alignment with role competencies (${cand.overall_score}% overall fit). Recommended for formal offer.`);
    setFeedbackMsg({ type: '', text: '' });
  };

  // Open Reject Modal
  const handleOpenReject = (cand) => {
    if (cand.status === 'rejected') {
      alert("This candidate has already been rejected.");
      return;
    }
    if (cand.status === 'accepted' || cand.status === 'selected') {
      alert("Cannot reject an already accepted candidate.");
      return;
    }
    setActiveCandidate(cand);
    setModalType('reject');
    setNotes(`After thorough review of candidate profile and evaluation metrics (${cand.overall_score}% overall fit), team decided to proceed with other applicants.`);
    setFeedbackMsg({ type: '', text: '' });
  };

  // Close Modal
  const closeModal = () => {
    setModalType(null);
    setActiveCandidate(null);
    setNotes('');
    setFeedbackMsg({ type: '', text: '' });
  };

  // Confirm Final Hiring Decision
  const handleConfirmDecision = async (e) => {
    e.preventDefault();
    if (!notes.trim()) {
      alert("Please provide mandatory HR review notes before confirming.");
      return;
    }
    if (!activeCandidate) return;

    setSubmitting(true);
    const decisionVal = modalType === 'accept' ? 'ACCEPTED' : 'REJECTED';
    const newStatus = modalType === 'accept' ? 'accepted' : 'rejected';

    try {
      await api.post(`/hr/applications/${activeCandidate.application_id}/decision`, {
        decision: decisionVal,
        decision_notes: notes.trim()
      });

      // Update state immediately without requiring page refresh
      setCandidates(prev => prev.map(c => (
        c.application_id === activeCandidate.application_id ? { ...c, status: newStatus } : c
      )));

      setFeedbackMsg({
        type: 'success',
        text: `Candidate successfully marked as ${decisionVal}!`
      });

      setTimeout(() => {
        closeModal();
        fetchTopCandidates();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/hr/jobs" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Job Catalog
      </Link>

      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              AI Recommendation Board
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Max 5 Eligible Candidates
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{job?.title}</h1>
          <p className="mt-1 text-xs text-slate-400 max-w-xl">
            Ranked based on transparent composite model: 30% Resume Alignment + 50% Interview Evaluation + 20% Required Skills Coverage.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 max-w-xs">
          <p className="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            Human Authority Rule
          </p>
          <span>AI generates evidence and rankings. Only authorized HR recruiters can confirm final hiring outcomes.</span>
        </div>
      </div>

      {/* Candidate Cards Grid */}
      {candidates.length === 0 ? (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-sm">
          <Award className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="font-bold text-white text-base mb-1">No Evaluated Candidates Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Candidates must submit applications and complete AI interviews before being ranked on this board.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {candidates.map((cand) => (
            <div
              key={cand.application_id}
              className={`p-6 sm:p-8 rounded-2xl border transition-all ${
                cand.rank === 1
                  ? 'bg-gradient-to-b from-indigo-950/60 to-slate-950 border-indigo-500/50 shadow-lg shadow-indigo-950/30'
                  : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
                <div className="flex items-start gap-4">
                  {/* Rank Badge */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-lg shrink-0 ${
                    cand.rank === 1 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-slate-900 text-slate-300 border border-slate-800'
                  }`}>
                    #{cand.rank}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold text-white">{cand.candidate_name}</h2>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                        {cand.anonymized_alias}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Status: <span className="font-semibold text-slate-200 uppercase">{cand.status.replace('_', ' ')}</span></p>
                  </div>
                </div>

                {/* Score Breakdown Gauges */}
                <div className="flex items-center gap-6 sm:gap-8 text-center bg-slate-900/80 px-6 py-3 rounded-2xl border border-slate-800">
                  <div>
                    <span className="text-lg font-bold text-slate-200">{cand.resume_match_score}%</span>
                    <span className="text-[10px] text-slate-500 block font-medium">Resume (40%)</span>
                  </div>
                  <div className="h-8 w-px bg-slate-800"></div>
                  <div>
                    <span className="text-lg font-bold text-slate-200">{cand.interview_score !== null ? `${cand.interview_score}%` : 'Pending'}</span>
                    <span className="text-[10px] text-slate-500 block font-medium">Interview (40%)</span>
                  </div>
                  <div className="h-8 w-px bg-slate-800"></div>
                  <div>
                    <span className="text-lg font-bold text-slate-200">{cand.required_skills_score}%</span>
                    <span className="text-[10px] text-slate-500 block font-medium">Skills (20%)</span>
                  </div>
                  <div className="h-8 w-px bg-slate-800"></div>
                  <div>
                    <span className="text-2xl font-black text-emerald-400">{cand.overall_score}%</span>
                    <span className="text-[10px] text-emerald-300 block font-bold uppercase tracking-wider">Overall Fit</span>
                  </div>
                </div>
              </div>

              {/* Strengths & Observations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 border-b border-slate-800 text-xs">
                <div>
                  <h4 className="font-bold text-emerald-400 mb-2 uppercase tracking-wider">Demonstrated Strengths</h4>
                  <ul className="space-y-1.5 text-slate-300">
                    {cand.strengths.map((s, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-amber-400 mb-2 uppercase tracking-wider">Areas for Review</h4>
                  <ul className="space-y-1.5 text-slate-300">
                    {cand.areas_for_review.map((a, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Bottom Actions: View Report & Unified Human Hiring Decisions */}
              <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <span className="text-[11px] text-slate-500 max-w-md">
                  {cand.assessment_limitations}
                </span>

                <div className="flex items-center gap-3">
                  <Link
                    to={`/hr/applications/${cand.application_id}/scorecard`}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    View Full Scorecard
                  </Link>

                  {/* DYNAMIC DECISION CONTROLS (Rule: ACCEPTED -> SELECTED badge, REJECTED -> REJECTED badge, else Accept + Reject buttons) */}
                  {cand.status === 'accepted' || cand.status === 'selected' ? (
                    <span className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      SELECTED
                    </span>
                  ) : cand.status === 'rejected' ? (
                    <span className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1.5 shadow-sm uppercase tracking-wider">
                      <XCircle className="w-4 h-4 text-rose-400" />
                      REJECTED
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenAccept(cand)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenReject(cand)}
                        className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =========================================================================
          CONFIRMATION MODAL: ACCEPT / REJECT CANDIDATE
          ========================================================================= */}
      {modalType && activeCandidate && (
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
                  <span className="text-white font-bold">{activeCandidate.candidate_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Candidate ID</span>
                  <span className="text-indigo-300 font-mono text-[11px] font-semibold">{activeCandidate.anonymized_alias || activeCandidate.candidate_id?.slice(0, 8)}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Overall Fit</span>
                  <span className="text-sm font-extrabold text-emerald-400">{activeCandidate.overall_score || activeCandidate.overall_ranking_score}%</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Resume Match</span>
                  <span className="text-sm font-bold text-slate-200">{activeCandidate.resume_match_score}%</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Interview Score</span>
                  <span className="text-sm font-bold text-slate-200">{activeCandidate.interview_score !== null && activeCandidate.interview_score !== undefined ? `${activeCandidate.interview_score}%` : 'Pending'}</span>
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

