import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MapPin,
  Briefcase,
  DollarSign,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  AlertCircle,
  UploadCloud,
  FileText,
  Loader2,
  LogIn,
  Plus,
  X,
  Calendar,
  HardDrive
} from 'lucide-react';
import api from '../../services/api';

export default function CandidateJobs() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [jobs, setJobs] = useState([]);
  const [appliedJobIds, setAppliedJobIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [applyingJob, setApplyingJob] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [authExpired, setAuthExpired] = useState(false);
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
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppliedJobs = async () => {
    try {
      const res = await api.get('/applications/candidate/all');
      if (Array.isArray(res.data)) {
        const idSet = new Set(res.data.map((app) => app.job_id));
        setAppliedJobIds(idSet);
      }
    } catch (err) {
      // User might not be logged in or guest, ignore
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchAppliedJobs();
  }, [department]);

  const openApplyModal = async (job) => {
    setApplyingJob(job);
    setStatusMessage(null);
    setUploadError('');
    setAuthExpired(false);
    setLoadingResumes(true);

    try {
      const res = await api.get('/candidate/resumes');
      const resumeList = Array.isArray(res.data) ? res.data : [];
      setResumes(resumeList);
      if (resumeList.length > 0) {
        setSelectedResumeId(resumeList[0].id || resumeList[0].resume_id);
      } else {
        setSelectedResumeId('');
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setAuthExpired(true);
      } else {
        setStatusMessage({
          type: 'error',
          text: err.response?.data?.detail || 'Failed to load resumes. Please check your connection.'
        });
      }
    } finally {
      setLoadingResumes(false);
    }
  };

  const handleInlineUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Please select a valid PDF resume file (.pdf).');
      return;
    }

    setUploadingResume(true);
    setUploadError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploadRes = await api.post('/candidate/resumes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Refresh candidate resumes
      const listRes = await api.get('/candidate/resumes');
      const updatedList = Array.isArray(listRes.data) ? listRes.data : [];
      setResumes(updatedList);

      const newId = uploadRes.data?.id || (updatedList.length > 0 ? updatedList[0].id : '');
      setSelectedResumeId(newId);

      setStatusMessage({
        type: 'success',
        text: `Resume "${file.name}" uploaded and attached successfully!`
      });
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      if (err.response?.status === 401) {
        setAuthExpired(true);
      } else {
        setUploadError(err.response?.data?.detail || 'Failed to upload resume file.');
      }
    } finally {
      setUploadingResume(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleApply = async () => {
    if (!applyingJob) return;
    if (!selectedResumeId) {
      setStatusMessage({
        type: 'error',
        text: 'Please select or upload a resume before submitting your application.'
      });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      await api.post('/applications', {
        job_id: applyingJob.id,
        resume_file_id: selectedResumeId
      });

      setAppliedJobIds((prev) => new Set([...prev, applyingJob.id]));
      setStatusMessage({
        type: 'success',
        text: `Application submitted successfully for ${applyingJob.title}!`
      });

      setTimeout(() => {
        setApplyingJob(null);
      }, 1800);
    } catch (err) {
      if (err.response?.status === 401) {
        setAuthExpired(true);
      } else {
        setStatusMessage({
          type: 'error',
          text: err.response?.data?.detail || 'Application submission failed. Please try again.'
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'PDF Document';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(0)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return 'Recently';
    try {
      return new Date(isoStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Explore Open Positions</h1>
        <p className="text-xs text-slate-500 mt-1">Browse active technical roles and apply with verified resume alignment.</p>
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
          {jobs.map((job) => {
            const isApplied = appliedJobIds.has(job.id);
            return (
              <div
                key={job.id}
                className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:border-brand-300 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                        {job.organization_name || 'Smart Recruit Organization'}
                      </span>
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
                  {isApplied ? (
                    <span className="px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Applied
                    </span>
                  ) : (
                    <button
                      onClick={() => openApplyModal(job)}
                      className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 shadow-sm transition-all flex items-center gap-1.5"
                    >
                      Apply with Resume
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hidden File Input for Resume Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleInlineUpload}
        accept=".pdf"
        className="hidden"
      />

      {/* Enhanced Apply Modal */}
      {applyingJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn relative max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">Application Submission</span>
                <h3 className="text-lg font-extrabold text-slate-900">{applyingJob.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {applyingJob.organization_name || 'Organization'} • {applyingJob.location}
                </p>
              </div>
              <button
                onClick={() => setApplyingJob(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto py-4 flex-1 space-y-4">
              
              {/* Auth Expiration Alert */}
              {authExpired && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Your session has expired. Please sign in again.</span>
                  </div>
                  <p className="text-amber-700 leading-relaxed">
                    Authentication credentials are required to submit job applications and link your resume securely.
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={() => navigate('/candidate/login')}
                      className="px-4 py-1.5 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 shadow-sm transition-all flex items-center gap-1.5 text-xs inline-flex"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      Sign In Now
                    </button>
                  </div>
                </div>
              )}

              {/* Status Message */}
              {statusMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="font-medium">{statusMessage.text}</span>
                </div>
              )}

              {/* Upload Error */}
              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Resume Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-brand-600" />
                    Select Resume to Attach
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingResume}
                    className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-brand-50 transition-colors disabled:opacity-50"
                  >
                    {uploadingResume ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        Upload New Resume
                      </>
                    )}
                  </button>
                </div>

                {loadingResumes ? (
                  <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                    <span className="text-xs">Loading your saved resumes...</span>
                  </div>
                ) : resumes.length === 0 ? (
                  /* Empty state when candidate has no resumes */
                  <div className="p-6 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 mb-1">
                      No resume uploaded yet. Please upload your resume before applying.
                    </h4>
                    <p className="text-[11px] text-slate-500 max-w-xs mb-4">
                      A verified PDF resume is required for automated skill matching and responsible hiring compliance.
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingResume}
                      className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 shadow-sm transition-all flex items-center gap-1.5"
                    >
                      {uploadingResume ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Uploading PDF...
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-3.5 h-3.5" />
                          Upload Resume (PDF)
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  /* Resumes list with cards & radio selection */
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {resumes.map((resume) => {
                      const resId = resume.id || resume.resume_id;
                      const isSelected = selectedResumeId === resId;

                      return (
                        <div
                          key={resId}
                          onClick={() => setSelectedResumeId(resId)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'border-brand-500 bg-brand-50/40 ring-2 ring-brand-400/20 shadow-sm'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="radio"
                              name="selectedResume"
                              checked={isSelected}
                              onChange={() => setSelectedResumeId(resId)}
                              className="w-4 h-4 text-brand-600 focus:ring-brand-500 border-slate-300 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-slate-900 truncate">
                                  {resume.file_name}
                                </p>
                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  {resume.file_type || 'PDF'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                                <span className="flex items-center gap-1">
                                  <HardDrive className="w-3 h-3 text-slate-400" />
                                  {formatFileSize(resume.file_size)}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  {formatDate(resume.uploaded_at)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            {resume.status || 'Active'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Notice */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 leading-relaxed flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                <span>
                  Our responsible AI engine will anonymously analyze your selected resume against the role requirements for skills matching and blind evaluation.
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setApplyingJob(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={submitting || !selectedResumeId || authExpired}
                className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Submitting Application...
                  </>
                ) : (
                  'Confirm & Apply'
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
