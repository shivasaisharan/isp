import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Users, Award, ArrowLeft, Search, CheckCircle2, Bot, ArrowRight, Eye } from 'lucide-react';
import api from '../../services/api';

export default function HrApplicants() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [search, setSearch] = useState('');
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
        note: `HR updated status to ${newStatus}`
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

  const filteredApplicants = applicants.filter(a =>
    a.candidate_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.anonymized_alias?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Link to="/hr/jobs" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Job Catalog
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-bold text-indigo-400">Applicant Pool</span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{job?.title}</h1>
          <p className="text-xs text-slate-400 mt-1">{applicants.length} total applicant records in pipeline</p>
        </div>
        <Link
          to={`/hr/jobs/${jobId}/top-candidates`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all shrink-0"
        >
          <Award className="w-4 h-4" />
          View Top-5 Candidate Board
        </Link>
      </div>

      {/* Applicant Table Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter applicants by name or blind-screening alias..."
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        {filteredApplicants.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No applicants found matching your query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/50">
                  <th className="p-4">Candidate / Blind Alias</th>
                  <th className="p-4">Resume Match</th>
                  <th className="p-4">Skills Coverage</th>
                  <th className="p-4">Overall Fit</th>
                  <th className="p-4">Pipeline Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredApplicants.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-4">
                      <span className="font-bold text-white block">{app.candidate_name}</span>
                      <span className="text-[10px] text-slate-400">{app.anonymized_alias}</span>
                    </td>
                    <td className="p-4 font-semibold text-slate-300">
                      {app.resume_match_score}%
                    </td>
                    <td className="p-4 font-semibold text-slate-300">
                      {app.skills_match_score}%
                    </td>
                    <td className="p-4">
                      <span className="font-extrabold text-indigo-400 text-sm">{app.overall_ranking_score}%</span>
                    </td>
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
                    <td className="p-4 text-right">
                      <Link
                        to={`/hr/jobs/${jobId}/top-candidates`}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Award className="w-3 h-3" />
                        Inspect in Top-5
                      </Link>
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

