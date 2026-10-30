import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Briefcase, Award, Users, Trash2, Edit3, ArrowRight } from 'lucide-react';
import api from '../../services/api';

export default function HrJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      const res = await api.get('/jobs/organization/all');
      setJobs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleDelete = async (jobId) => {
    if (!window.confirm("Are you sure you want to delete this job opening?")) return;
    try {
      await api.delete(`/jobs/${jobId}`);
      await fetchJobs();
    } catch (err) {
      alert("Failed to delete job.");
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Job Catalog Management</h1>
          <p className="text-xs text-slate-400 mt-1">Manage active openings, define required skills, and access candidate boards.</p>
        </div>
        <Link
          to="/hr/jobs/create"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          Create New Job Opening
        </Link>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {jobs.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No job openings listed under your organization tenant.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {jobs.map((job) => (
              <div key={job.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-900/60 transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-bold text-white">{job.title}</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase">
                      {job.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {job.department} • {job.experience_level} • {job.location} • {job.salary_range}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {job.required_skills?.map((sk, idx) => (
                      <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 font-medium">
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to={`/hr/jobs/${job.id}/applicants`}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{job.applicants_count || 0} Applicants</span>
                  </Link>

                  <Link
                    to={`/hr/jobs/${job.id}/top-candidates`}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Top-5 Board</span>
                  </Link>

                  <button
                    onClick={() => handleDelete(job.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                    title="Delete Job"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

