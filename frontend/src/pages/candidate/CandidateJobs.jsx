import React, { useState, useEffect } from 'react';
import { Search, MapPin, Briefcase, DollarSign, CheckCircle2, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import api from '../../services/api';

export default function CandidateJobs() {
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(true);
  const [applyingJob, setApplyingJob] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/jobs', {
        params: { search: search || undefined, department: department || undefined }
      });
      setJobs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [department]);

  const openApplyModal = async (job) => {
    setApplyingJob(job);
    setStatusMessage(null);
    try {
      const res = await api.get('/candidate/resumes');
      setResumes(res.data);
      if (res.data.length > 0) {
        setSelectedResumeId(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApply = async () => {
    if (!applyingJob) return;
    setSubmitting(true);
    setStatusMessage(null);
    try {
      await api.post('/applications', {
        job_id: applyingJob.id,
        resume_file_id: selectedResumeId || undefined
      });
      setStatusMessage({ type: 'success', text: `Application submitted for ${applyingJob.title}!` });
      setTimeout(() => {
        setApplyingJob(null);
      }, 1500);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.detail || 'Application submission failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Explore Open Positions</h1>
        <p className="text-xs text-slate-500 mt-1">Browse active technical roles and apply with automatic resume parsing.</p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchJobs(); }}
            placeholder="Search by job title or keyword..."
            className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
        </div>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none"
        >
          <option value="">All Departments</option>
          <option value="Engineering">Engineering</option>
          <option value="Product">Product</option>
          <option value="Data">Data & AI</option>
        </select>
        <button
          onClick={fetchJobs}
          className="px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 shadow-sm transition-all"
        >
          Search
        </button>
      </div>

      {/* Job Cards List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <p className="text-sm text-slate-500">No matching jobs found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {jobs.map((job) => (
            <div key={job.id} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:border-brand-300 transition-colors">
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">{job.organization_name}</span>
                    <h2 className="text-lg font-bold text-slate-900">{job.title}</h2>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                    {job.experience_level}
                  </span>
                </div>

                <div className="flex flex-wrap gap-y-1 gap-x-4 text-xs text-slate-500 mb-4">
                  <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {job.department}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>
                  {job.salary_range && <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> {job.salary_range}</span>}
                </div>

                <p className="text-xs text-slate-600 line-clamp-3 mb-4 leading-relaxed">{job.description}</p>

                <div className="flex flex-wrap gap-1.5 mb-6">
                  {job.required_skills?.map((sk, idx) => (
                    <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-200 font-medium">
                      {sk}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">{job.applicants_count || 0} applicants</span>
                <button
                  onClick={() => openApplyModal(job)}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 shadow-sm transition-all flex items-center gap-1.5"
                >
                  Apply with Resume
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Apply Modal */}
      {applyingJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Apply for {applyingJob.title}</h3>
            <p className="text-xs text-slate-500 mb-4">{applyingJob.organization_name} • {applyingJob.location}</p>

            {statusMessage && (
              <div className={`p-3 rounded-lg text-xs mb-4 flex items-center gap-2 ${
                statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Resume to Attach</label>
                {resumes.length === 0 ? (
                  <p className="text-xs text-amber-600">No resumes found. Your profile information will be used.</p>
                ) : (
                  <select
                    value={selectedResumeId}
                    onChange={(e) => setSelectedResumeId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none"
                  >
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>{r.file_name} ({r.anonymized_alias})</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setApplyingJob(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={submitting}
                className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 shadow-sm disabled:opacity-50"
              >
                {submitting ? 'Submitting Application...' : 'Confirm & Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

