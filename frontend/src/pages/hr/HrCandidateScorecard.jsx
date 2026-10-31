import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer
} from 'recharts';
import {
  ArrowLeft, Award, CheckCircle2, AlertTriangle, AlertOctagon,
  ShieldCheck, ShieldAlert, Clock, User, Briefcase, FileText,
  ChevronDown, ChevronUp, Lock, CheckSquare, MessageSquare, Sparkles, AlertCircle
} from 'lucide-react';
import api from '../../services/api';

export default function HrCandidateScorecard() {
  const { applicationId, candidateId } = useParams();
  const navigate = useNavigate();

  const [scorecard, setScorecard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Expandable Questions state (all open by default)
  const [expandedQuestions, setExpandedQuestions] = useState({});

  // HR Decision Modal State
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decisionType, setDecisionType] = useState('selected');
  const [rationale, setRationale] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionSuccess, setDecisionSuccess] = useState('');

  const fetchScorecard = async () => {
    try {
      setLoading(true);
      // Support fetching by applicationId or candidateId
      const endpoint = applicationId
        ? `/applications/${applicationId}/scorecard`
        : `/applications/${candidateId}/scorecard`;
      const res = await api.get(endpoint);
      setScorecard(res.data);

      // Initialize all questions as expanded
      if (res.data.question_evaluations) {
        const initExpanded = {};
        res.data.question_evaluations.forEach((_, idx) => {
          initExpanded[idx] = true;
        });
        setExpandedQuestions(initExpanded);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load candidate evaluation scorecard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScorecard();
  }, [applicationId, candidateId]);

  const toggleQuestion = (index) => {
    setExpandedQuestions(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    if (!rationale.trim()) {
      alert("Please provide a mandatory job-related decision rationale.");
      return;
    }
    setSubmittingDecision(true);
    try {
      await api.post('/decisions', {
        application_id: scorecard.application.id,
        decision: decisionType,
        rationale: rationale
      });
      setDecisionSuccess(`Hiring decision recorded: Candidate marked as ${decisionType.toUpperCase()}!`);
      setTimeout(() => {
        setDecisionModalOpen(false);
        fetchScorecard();
      }, 1200);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to record decision.');
    } finally {
      setSubmittingDecision(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-400"></div>
        <p className="text-xs text-slate-400 animate-pulse font-medium">Loading official evaluation scorecard...</p>
      </div>
    );
  }

  if (error || !scorecard) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Scorecard Unavailable</h2>
        <p className="text-xs text-slate-400">{error || 'Could not locate candidate assessment records.'}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-300 rounded-xl hover:text-white"
        >
          Return to Previous Page
        </button>
      </div>
    );
  }

  const { candidate, application, assessment_meta, scores, dimensions, question_evaluations, strengths, weaknesses, ai_quality_warnings, security_audit, hiring_decision } = scorecard;

  // Radar Chart data
  const radarData = dimensions.map(d => ({
    subject: `${d.name} (${d.weight_pct}%)`,
    score: d.raw_score,
    fullMark: 100
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Top Back Action */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Applicant Pool
        </button>

        <span className="text-[11px] px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">
          Rubric v{assessment_meta.rubric_version} • Scoring Formula v{assessment_meta.scoring_formula_version}
        </span>
      </div>

      {/* =========================================================================
          SECTION A: CANDIDATE & APPLICATION HEADER
          ========================================================================= */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950/70 to-slate-950 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Confidential Recruiter Assessment
            </span>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
              assessment_meta.assessment_status === 'Completed'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : assessment_meta.assessment_status.includes('Flagged')
                ? 'bg-red-500/20 text-red-300 border-red-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}>
              {assessment_meta.assessment_status}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {candidate.name}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span className="font-mono text-indigo-400">{candidate.anonymized_alias}</span>
            <span>•</span>
            <span>Applied for <strong className="text-slate-200">{application.job_title}</strong> ({application.department})</span>
            <span>•</span>
            <span>Application ID: <span className="font-mono">{application.id.slice(0, 8)}</span></span>
          </div>
        </div>

        {/* Dual Scores Display: Interview Score VS Overall Fit Score */}
        <div className="flex items-center gap-6 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shrink-0">
          <div className="text-center pr-4 border-r border-slate-800">
            <span className="text-3xl font-black text-white">
              {scores.interview_score !== null ? `${scores.interview_score}%` : 'N/A'}
            </span>
            <span className="text-[10px] block text-indigo-400 font-bold uppercase tracking-wider mt-0.5">
              Interview Assessment
            </span>
            <span className="text-[9px] text-slate-500 block">5 Dimensions (0-100)</span>
          </div>

          <div className="text-center">
            <span className="text-3xl font-black text-emerald-400">
              {scores.overall_candidate_fit}%
            </span>
            <span className="text-[10px] block text-emerald-300 font-bold uppercase tracking-wider mt-0.5">
              Overall Candidate Fit
            </span>
            <span className="text-[9px] text-slate-500 block">40% Res + 40% Int + 20% Skl</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION B: OFFICIAL INTERVIEW EVALUATION SCORECARD & RADAR
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-7 flex flex-col justify-between shadow-sm">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              5-Dimensional Competency Radar
            </h3>
            <p className="text-[11px] text-slate-500">
              Evaluated against role rubric criteria. Matches the official candidate scorecard.
            </p>
          </div>

          <div className="h-72 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" tick={{ fontSize: 9 }} />
                <Radar name="Performance" dataKey="score" stroke="#818cf8" fill="#6366f1" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-900 pt-3">
            <span>Scale: 0% to 100% per dimension</span>
            <span>Rubric Version: {assessment_meta.rubric_version}</span>
          </div>
        </div>

        {/* Composite Fit Formula & Breakdown Card */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Overall Candidate Fit Composition
              </h3>
            </div>
            <p className="text-[11px] text-slate-500">
              Formula: (Resume Match × 0.40) + (Interview Assessment × 0.40) + (Verified Skills × 0.20)
            </p>
          </div>

          {/* 3 Core Components */}
          <div className="space-y-3.5">
            {/* Resume Match */}
            <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300">Resume Match (40% Weight)</span>
                <span className="font-bold text-slate-100">{scores.resume_match_score}% × 0.40 = <strong className="text-emerald-400">{scores.formula_breakdown.resume_component}%</strong></span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${scores.resume_match_score}%` }}></div>
              </div>
            </div>

            {/* Interview Assessment */}
            <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300">Interview Assessment (40% Weight)</span>
                <span className="font-bold text-slate-100">{scores.interview_score ?? 0}% × 0.40 = <strong className="text-indigo-400">{scores.formula_breakdown.interview_component}%</strong></span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div className="bg-indigo-400 h-2 rounded-full" style={{ width: `${scores.interview_score ?? 0}%` }}></div>
              </div>
            </div>

            {/* Verified Skills */}
            <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300">Verified Skills Coverage (20% Weight)</span>
                <span className="font-bold text-slate-100">{scores.skills_match_score}% × 0.20 = <strong className="text-purple-400">{scores.formula_breakdown.skills_component}%</strong></span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${scores.skills_match_score}%` }}></div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300">Total Authoritative Fit:</span>
            <span className="text-base font-extrabold text-emerald-400">{scores.overall_candidate_fit}%</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION C: FIVE-DIMENSION COMPETENCY BREAKDOWN
          ========================================================================= */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400">
            Section C • Five-Dimensional Competency Ratings
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Distinguishing individual dimension scores (0-100%) from weighted contributions to the overall interview score.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dimensions.map((dim, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
              <div className="flex justify-between items-baseline">
                <div>
                  <h4 className="font-bold text-white text-xs">{dim.name}</h4>
                  <span className="text-[10px] text-slate-500">Weight: {dim.weight_pct}%</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-indigo-300">{dim.raw_score}%</span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    Contrib: +{dim.weighted_score}%
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full"
                  style={{ width: `${dim.raw_score}%` }}
                ></div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {dim.explanation}
              </p>
              <div className="text-[10px] text-indigo-300/80 bg-indigo-950/30 p-2 rounded-lg border border-indigo-900/40">
                Evidence: {dim.evidence}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* =========================================================================
          SECTION D: QUESTION-WISE EVALUATION & ORIGINAL TRANSCRIPTS
          ========================================================================= */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400">
              Section D • Question-Wise Evaluation & Full Transcripts
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Chronological turn-by-turn interview transcripts, AI evaluations, expected concepts, and scores.
            </p>
          </div>
          <span className="text-xs text-slate-400 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
            {question_evaluations.length} Questions Evaluated
          </span>
        </div>

        {question_evaluations.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/50 rounded-2xl">
            Candidate has not yet completed the interactive interview session.
          </div>
        ) : (
          <div className="space-y-4">
            {question_evaluations.map((q, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden transition-all"
              >
                {/* Expandable Accordion Header */}
                <div
                  onClick={() => toggleQuestion(idx)}
                  className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-900/90 transition-colors select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0">
                      Q{q.question_index}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          {q.category}
                        </span>
                        <span className="text-xs font-semibold text-white line-clamp-1">
                          {q.question_text}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-xs font-extrabold text-indigo-400">
                      Score: {q.score}%
                    </span>
                    {expandedQuestions[idx] ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Question Details */}
                {expandedQuestions[idx] && (
                  <div className="p-5 border-t border-slate-800/80 space-y-4 text-xs bg-slate-950/40">
                    {/* Full Question Text */}
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200">
                      <strong className="text-indigo-400 block text-[11px] uppercase mb-1">Interview Question:</strong>
                      <p className="italic">{q.question_text}</p>
                    </div>

                    {/* Candidate's Original Answer Transcript */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                          Candidate Original Answer Transcript:
                        </span>
                        <span className="font-mono text-slate-500">{q.word_count} words recorded</span>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800/90 text-slate-100 leading-relaxed font-sans">
                        "{q.candidate_answer}"
                      </div>
                    </div>

                    {/* AI Feedback & Explanation */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-900/40 space-y-1">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                          AI Evaluator Feedback:
                        </span>
                        <p className="text-slate-300 text-[11px] leading-relaxed">
                          {q.feedback}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Target Core Competencies Evaluated:
                        </span>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {q.expected_concepts.map((c, i) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =========================================================================
          SECTIONS E, F, G: STRENGTHS, WEAKNESSES & AI WARNINGS
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identified Strengths */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Section E • Identified Candidate Strengths
            </h3>
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            {strengths?.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold shrink-0">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Areas for Improvement */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Section F • Areas for Growth & Skill Gaps
            </h3>
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            {weaknesses?.map((w, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-500 font-bold shrink-0">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Section G: AI Assessment Quality Warnings */}
      {ai_quality_warnings && ai_quality_warnings.length > 0 && (
        <div className="p-6 rounded-3xl bg-amber-950/20 border border-amber-800/50 space-y-3 text-xs">
          <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider">
            <AlertOctagon className="w-4 h-4" />
            <span>Section G • AI Assessment Quality & Proctoring Warnings</span>
          </div>
          <p className="text-[11px] text-amber-200/80">
            The system highlights anomalies such as brief responses, high lexical repetition, or proctoring interruptions for human scrutiny.
          </p>
          <div className="space-y-2 pt-1">
            {ai_quality_warnings.map((warn, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-950/60 border border-amber-900/40 text-amber-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{warn}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proctoring Security Audit Box */}
      {security_audit && (
        <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              {security_audit.flagged_for_review ? (
                <ShieldAlert className="w-4 h-4 text-red-400" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              )}
              <h3 className="font-bold text-white text-xs">Full-Screen Examination Proctoring Log</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold border bg-slate-900 border-slate-700 text-slate-300">
              {security_audit.violation_count} / {security_audit.max_violations} Recorded Strikes
            </span>
          </div>

          {security_audit.violations && security_audit.violations.length > 0 ? (
            <div className="space-y-2 pt-1">
              {security_audit.violations.map((v, i) => (
                <div key={i} className="flex items-start justify-between p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-[11px]">
                  <div>
                    <span className="font-bold text-red-400">Strike #{v.violation_number}: </span>
                    <span className="text-slate-200">{v.description}</span>
                  </div>
                  <span className="text-slate-500 font-mono text-[10px] shrink-0 ml-4">
                    {new Date(v.occurred_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-xs flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              No security interruptions recorded. Candidate complied with browser full-screen requirements throughout.
            </p>
          )}
        </div>
      )}

      {/* =========================================================================
          SECTION H: RECRUITER DECISION PANEL
          ========================================================================= */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-indigo-900/50 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Human Authorization</span>
            <h3 className="text-lg font-bold text-white">Record Final Recruiter Hiring Decision</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Smart Recruit Directive: AI recommends and scores. The authorized human recruiter holds final hiring authority.
            </p>
          </div>

          <button
            onClick={() => setDecisionModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all flex items-center gap-2 shrink-0"
          >
            <CheckSquare className="w-4 h-4" />
            {hiring_decision ? 'Update Hiring Decision' : 'Submit Hiring Decision'}
          </button>
        </div>

        {hiring_decision && (
          <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/60 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold">Active Recruiter Decision:</span>
              <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                hiring_decision.decision === 'selected' ? 'bg-emerald-500/20 text-emerald-300' :
                hiring_decision.decision === 'rejected' ? 'bg-red-500/20 text-red-300' :
                'bg-amber-500/20 text-amber-300'
              }`}>
                {hiring_decision.decision}
              </span>
              <span className="text-slate-500 font-mono text-[10px]">
                ({new Date(hiring_decision.decided_at).toLocaleDateString()})
              </span>
            </div>
            <p className="text-slate-200 italic pt-1">"{hiring_decision.rationale}"</p>
          </div>
        )}
      </div>

      {/* Recruiter Decision Modal */}
      {decisionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-slate-800 shadow-2xl text-slate-100 animate-fadeIn">
            <h3 className="text-lg font-bold text-white mb-1">Human Recruiter Hiring Decision</h3>
            <p className="text-xs text-slate-400 mb-6">
              Candidate: <span className="text-white font-semibold">{candidate.name}</span> ({candidate.anonymized_alias})
            </p>

            {decisionSuccess && (
              <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{decisionSuccess}</span>
              </div>
            )}

            <form onSubmit={handleDecisionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Decision Outcome</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecisionType('selected')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      decisionType === 'selected'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Select
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionType('on_hold')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      decisionType === 'on_hold'
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Next Round / Hold
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionType('rejected')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      decisionType === 'rejected'
                        ? 'bg-red-600 text-white border-red-500 shadow-md'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Reject
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Mandatory Recruiter Rationale & Notes <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={4}
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder="Explain the job-related justification for this hiring decision..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDecisionModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-400 rounded-xl text-xs font-semibold hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDecision}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  {submittingDecision ? 'Submitting...' : 'Confirm Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
