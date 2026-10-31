import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Award, ArrowLeft, ShieldCheck, CheckCircle2, AlertTriangle, Eye, CheckSquare, XCircle, Clock, ShieldAlert, Sparkles
} from 'lucide-react';
import api from '../../services/api';

export default function HrTopCandidates() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Decision Modal State
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [activeCandidate, setActiveCandidate] = useState(null);
  const [decisionType, setDecisionType] = useState('selected');
  const [rationale, setRationale] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

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

  const openDecisionModal = (candidate) => {
    setActiveCandidate(candidate);
    setDecisionType('selected');
    setRationale(`Candidate demonstrated strong competency in ${candidate.matched_skills.slice(0, 3).join(', ')}.`);
    setDecisionModalOpen(true);
    setSuccessMsg('');
  };

  const handleConfirmDecision = async (e) => {
    e.preventDefault();
    if (!rationale.trim()) {
      alert("Please enter a job-related rationale for the decision record.");
      return;
    }
    setSubmittingDecision(true);

    try {
      await api.post('/decisions', {
        application_id: activeCandidate.application_id,
        decision: decisionType,
        rationale: rationale
      });
      setSuccessMsg(`Decision confirmed: Candidate marked as ${decisionType.toUpperCase()}!`);
      setTimeout(() => {
        setDecisionModalOpen(false);
        fetchTopCandidates();
      }, 1500);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to submit hiring decision.");
    } finally {
      setSubmittingDecision(false);
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

              {/* Bottom Actions: View Report & Human Hiring Decision */}
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

                  <button
                    onClick={() => openDecisionModal(cand)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    Confirm Hiring Decision
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Human Hiring Decision Modal */}
      {decisionModalOpen && activeCandidate && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 rounded-2xl max-w-lg w-full p-6 sm:p-8 border border-slate-800 shadow-2xl text-slate-100 animate-fadeIn">
            <h3 className="text-lg font-bold text-white mb-1">Human Recruiter Hiring Decision</h3>
            <p className="text-xs text-slate-400 mb-6">
              Candidate: <span className="text-white font-semibold">{activeCandidate.candidate_name}</span> ({activeCandidate.anonymized_alias})
            </p>

            {successMsg && (
              <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleConfirmDecision} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Select Decision Outcome</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecisionType('selected')}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                      decisionType === 'selected' ? 'bg-emerald-600 text-white border-emerald-500 shadow-md' : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Select for Offer
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionType('on_hold')}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                      decisionType === 'on_hold' ? 'bg-amber-600 text-white border-amber-500 shadow-md' : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Put On Hold
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionType('rejected')}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                      decisionType === 'rejected' ? 'bg-rose-600 text-white border-rose-500 shadow-md' : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Reject Candidate
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Mandatory Recruiter Rationale (Audit Trail)
                </label>
                <textarea
                  rows={4}
                  required
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder="Record your objective justification for this decision (e.g. exceptional distributed system experience, cultural fit)..."
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDecisionModalOpen(false)}
                  className="px-4 py-2 border border-slate-700 text-xs font-bold text-slate-300 rounded-xl hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDecision}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
                >
                  {submittingDecision ? 'Recording Immutable Audit...' : 'Confirm Final Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

