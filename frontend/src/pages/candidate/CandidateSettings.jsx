import React, { useState } from 'react';
import { Shield, Download, Trash2, CheckCircle2, Lock } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function CandidateSettings() {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const handleExportData = async () => {
    setExporting(true);
    try {
      const res = await api.get('/candidate/privacy/export');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Privacy & Account Settings</h1>
        <p className="text-xs text-slate-500 mt-1">Manage personal data access, blind screening preferences, and compliance exports.</p>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Lock className="w-4 h-4 text-brand-600" />
          Authenticated Candidate Credentials
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block mb-0.5">Full Name</span>
            <span className="font-bold text-slate-900">{user?.full_name}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block mb-0.5">Email Address</span>
            <span className="font-bold text-slate-900">{user?.email}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block mb-0.5">Role Permission</span>
            <span className="font-bold text-slate-900 uppercase">{user?.role}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block mb-0.5">Blind Screening Alias</span>
            <span className="font-bold text-emerald-600">{user?.candidate_profile?.anonymized_alias || 'Candidate #401'}</span>
          </div>
        </div>
      </div>

      {/* Data Export Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-600" />
          Personal Data Export & Portability
        </h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          In compliance with modern privacy regulations, you can download a complete structured JSON copy of all personal profile information, uploaded resumes, and recorded interview scorecards.
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={handleExportData}
            disabled={exporting}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Generating JSON Export...' : 'Request Personal Data Export'}
          </button>
          {downloadUrl && (
            <a
              href={downloadUrl}
              download="smart_recruit_candidate_data.json"
              className="text-xs font-bold text-brand-600 underline flex items-center gap-1"
            >
              Download Ready File (JSON)
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

