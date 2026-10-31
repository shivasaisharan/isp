import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Users, Award, ArrowLeft, Search, Eye, Filter, ArrowUpDown,
  CheckCircle2, AlertOctagon, Clock, ShieldAlert, Sparkles, FileText, ChevronRight
} from 'lucide-react';
import api from '../../services/api';

export default function HrApplicants() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [search, setSearch] = useState('');
  const [assessmentFilter, setAssessmentFilter] = useState('ALL');
  const [pipelineFilter, setPipelineFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('fit_desc'); // fit_desc, fit_asc, interview_desc, resume_desc
  const [loading, setLoading] = useState(true);

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

  const handleStageChange = async (appId, newStatus) => {
    try {
      await api.patch(`/applications/${appId}/status`, {
        status: newStatus,
        note: `HR updated pipeline stage to ${newStatus}`
      });
      await fetchApplicants();
    } catch (err) {
      alert("Failed to update status.");
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
      pipelineFilter === 'ALL' || a.status === pipelineFilter;

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
            {applicants.length} total candidate applications in pipeline • {applicants.filter(a => a.assessment_status === 'Completed').length} completed interview scorecards
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
            <option value="ALL">All Stages</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="interview_pending">Interview Pending</option>
            <option value="interview_completed">Interview Completed</option>
            <option value="hr_review">HR Review</option>
            <option value="selected">Selected</option>
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

                    {/* Interview Score (Distinguished from Overall Fit) */}
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

                    {/* Pipeline Status Select */}
                    <td className="p-4">
                      <select
                        value={app.status}
                        onChange={(e) => handleStageChange(app.id, e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-1 rounded text-xs focus:outline-none"
                      >
                        <option value="submitted">Submitted</option>
                        <option value="under_review">Under Review</option>
                        <option value="interview_pending">Interview Pending</option>
                        <option value="interview_completed">Interview Completed</option>
                        <option value="hr_review">HR Review</option>
                        <option value="selected">Selected</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>

                    {/* Enhanced Actions Column */}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* VIEW SCORE ACTION */}
                        <Link
                          to={`/hr/applications/${app.id}/scorecard`}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            app.assessment_status === 'Completed'
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Score</span>
                        </Link>

                        {/* TOP-5 INSPECT ACTION */}
                        <Link
                          to={`/hr/jobs/${jobId}/top-candidates`}
                          title="Inspect candidate ranking on Top-5 Board"
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-indigo-300 rounded-lg border border-slate-800 transition-colors"
                        >
                          <Award className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
