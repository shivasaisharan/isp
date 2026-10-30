import React, { useState, useEffect } from 'react';
import { UploadCloud, FileText, CheckCircle2, Sparkles, AlertCircle, ArrowRight, Trash2 } from 'lucide-react';
import api from '../../services/api';

export default function CandidateResume() {
  const [resumes, setResumes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchResumes = async () => {
    try {
      const [resumesRes, jobsRes] = await Promise.all([
        api.get('/candidate/resumes'),
        api.get('/jobs')
      ]);
      setResumes(resumesRes.data);
      setJobs(jobsRes.data);
      if (jobsRes.data.length > 0) {
        setSelectedJobId(jobsRes.data[0].id);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setError("Your active session does not have Candidate permissions. Please click 'Sign Out' at the bottom-left and log in with your Candidate account.");
      } else {
        console.error(err);
      }
    }
  };

  useEffect(() => {
    fetchResumes();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid PDF resume file.');
      return;
    }

    setError('');
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post('/candidate/resumes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await fetchResumes();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload and parse resume.');
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async (resumeId) => {
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const res = await api.post(`/candidate/resumes/${resumeId}/analyze?job_id=${selectedJobId}`);
      setAnalysisResult(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteResume = async (resumeId, fileName) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"? This will permanently remove the resume file.`)) {
      return;
    }
    setDeletingId(resumeId);
    setError('');
    setSuccessMsg('');
    try {
      await api.delete(`/candidate/resumes/${resumeId}`);
      if (analysisResult) {
        setAnalysisResult(null);
      }
      setSuccessMsg(`"${fileName}" was successfully removed.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      await fetchResumes();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete resume.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Resume Management & AI Alignment</h1>
        <p className="text-xs text-slate-500 mt-1">Upload PDF resumes, view extracted skills, and test alignment against job requirements.</p>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Upload Box */}
      <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-brand-500 transition-colors">
        <UploadCloud className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-900 mb-1">Upload New PDF Resume</h3>
        <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
          Our NLP parsing engine extracts technical skills and indexes your credentials for instant matching.
        </p>
        <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 cursor-pointer shadow-sm transition-all">
          <FileText className="w-4 h-4" />
          <span>{uploading ? 'Parsing PDF Text & Skills...' : 'Select PDF Resume'}</span>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Uploaded Resumes List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-base font-bold text-slate-900 mb-4">Saved Resume Files</h2>
        {resumes.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No resumes uploaded yet.</p>
        ) : (
          <div className="space-y-4">
            {resumes.map((r) => (
              <div key={r.id} className="p-5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-brand-600" />
                    <span className="text-sm font-bold text-slate-900">{r.file_name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                      {r.anonymized_alias}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">
                    Uploaded on {new Date(r.uploaded_at).toLocaleDateString()} • {(r.file_size / 1024).toFixed(0)} KB
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {r.extracted_skills?.map((sk, idx) => (
                      <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 font-medium">
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none"
                  >
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>{j.title}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAnalyze(r.id)}
                    disabled={analyzing || deletingId === r.id}
                    className="px-3.5 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {analyzing ? 'Analyzing...' : 'Test Fit'}
                  </button>

                  <button
                    onClick={() => handleDeleteResume(r.id, r.file_name)}
                    disabled={deletingId === r.id || analyzing}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200 disabled:opacity-40"
                    title="Delete this resume"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analysis Result Card */}
      {analysisResult && (
        <div className="bg-white rounded-2xl border border-brand-200 shadow-md p-6 animate-fadeIn">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
            <div>
              <span className="text-xs uppercase font-bold text-brand-600">Semantic Alignment Assessment</span>
              <h3 className="text-lg font-bold text-slate-900">Target Role: {analysisResult.target_job}</h3>
            </div>
            <div className="text-right">
              <span className="text-3xl font-extrabold text-brand-600">{analysisResult.analysis.match_score}%</span>
              <span className="text-[11px] block font-semibold text-slate-500">{analysisResult.analysis.fit_status}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Matched Competencies</h4>
              <div className="flex flex-wrap gap-1.5">
                {analysisResult.analysis.matched_skills.map((s, i) => (
                  <span key={i} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs rounded-lg font-medium">
                    ✓ {s}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Identified Skill Gaps</h4>
              <div className="flex flex-wrap gap-1.5">
                {analysisResult.analysis.missing_skills.length === 0 ? (
                  <span className="text-xs text-emerald-600 font-medium">Zero prerequisite skill gaps found!</span>
                ) : (
                  analysisResult.analysis.missing_skills.map((s, i) => (
                    <span key={i} className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs rounded-lg font-medium">
                      • {s}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 text-xs space-y-2 text-slate-700">
            {analysisResult.analysis.strengths?.map((st, i) => (
              <p key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{st}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

