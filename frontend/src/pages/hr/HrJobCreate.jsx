import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Briefcase, ArrowLeft, Save, Plus, AlertCircle } from 'lucide-react';
import api from '../../services/api';

export default function HrJobCreate() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    department: 'Engineering',
    experience_level: 'Mid-Level',
    location: 'Remote / Hybrid',
    employment_type: 'Full-Time',
    salary_range: '$110,000 - $140,000',
    description: '',
    required_skills: ['Python', 'Docker', 'FastAPI'],
    preferred_skills: ['Kubernetes', 'AWS'],
    status: 'published'
  });
  const [newSkill, setNewSkill] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addSkill = () => {
    if (newSkill.trim() && !formData.required_skills.includes(newSkill.trim())) {
      setFormData({
        ...formData,
        required_skills: [...formData.required_skills, newSkill.trim()]
      });
      setNewSkill('');
    }
  };

  const removeSkill = (skToRemove) => {
    setFormData({
      ...formData,
      required_skills: formData.required_skills.filter(s => s !== skToRemove)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description) {
      setError("Please fill in role title and comprehensive description.");
      return;
    }
    setError('');
    setLoading(true);

    try {
      await api.post('/jobs', formData);
      navigate('/hr/jobs');
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create job opening.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Link to="/hr/jobs" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Job Catalog
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Post New Job Opening</h1>
        <p className="text-xs text-slate-400 mt-1">Define role specifications, required skills, and qualification thresholds.</p>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
        {error && (
          <div className="mb-6 p-3 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Job Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="e.g. Senior Machine Learning & Systems Architect"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Department</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none"
              >
                <option value="Engineering">Engineering</option>
                <option value="Product">Product</option>
                <option value="Data & AI">Data & AI</option>
                <option value="Security">Security & DevOps</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Experience Level</label>
              <select
                value={formData.experience_level}
                onChange={(e) => setFormData({ ...formData, experience_level: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none"
              >
                <option value="Entry">Entry-Level</option>
                <option value="Mid-Level">Mid-Level</option>
                <option value="Senior">Senior</option>
                <option value="Lead">Lead / Architect</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Location Scope</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none"
                placeholder="Remote / Hybrid"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Target Compensation Range</label>
              <input
                type="text"
                value={formData.salary_range}
                onChange={(e) => setFormData({ ...formData, salary_range: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none"
                placeholder="$120,000 - $160,000"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none"
              >
                <option value="published">Published (Accepting Candidates)</option>
                <option value="draft">Save as Draft</option>
              </select>
            </div>
          </div>

          {/* Required Skills Management */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
              Required Technical Competencies (Weighted 20% in Ranking)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); }}}
                className="flex-1 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Add prerequisite technology (e.g. Python, Docker, PyTorch)..."
              />
              <button
                type="button"
                onClick={addSkill}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-500"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-slate-900 border border-slate-800">
              {formData.required_skills.map((sk, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-indigo-950 text-indigo-300 border border-indigo-800"
                >
                  {sk}
                  <button
                    type="button"
                    onClick={() => removeSkill(sk)}
                    className="text-indigo-400 hover:text-indigo-200 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Role Description & Responsibilities</label>
            <textarea
              rows={6}
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
              placeholder="Outline engineering scope, responsibilities, architecture challenges, and team expectations..."
            />
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
            <Link
              to="/hr/jobs"
              className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-bold text-slate-300 hover:bg-slate-900"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 shadow-md transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Publishing Opening...' : 'Publish Job Opening'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

