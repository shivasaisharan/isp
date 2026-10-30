import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { Sparkles, Bot, Award, ShieldCheck, CheckCircle2, Cpu, EyeOff, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs uppercase font-bold text-brand-600 tracking-wider">Product Deep-Dive</span>
            <h1 className="text-4xl font-extrabold text-slate-900 mt-2 tracking-tight">Enterprise Recruitment Architecture</h1>
            <p className="mt-3 text-slate-600">
              Explore the core engineering innovations powering Smart Recruit's intelligent evaluation and ethical hiring engine.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* Module 1: Resume Parsing & Blind Screening */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
              <EyeOff className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">1. Resume Parsing & Blind Screening</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              Extracts structured candidate data from multi-page PDFs using high-fidelity text extraction.
              Provides built-in Blind Screening mode that tokenizes candidate names, contact details, and demographic markers into cryptographic aliases (e.g., Candidate #401).
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Automatic tech skill taxonomy extraction</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Semantic cosine similarity matching</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Objective prerequisite qualification coverage</li>
            </ul>
          </div>
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <span className="text-xs font-semibold text-slate-500 uppercase">Screening Inspector</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">Blind Mode Active</span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-xs text-slate-400 block">Candidate Identity</span>
                <span className="font-semibold text-slate-800">Candidate #4A9C (PII Masked)</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-xs text-slate-400 block">Identified Competencies</span>
                <span className="font-semibold text-slate-800">Python, FastAPI, Docker, PyTorch, Kubernetes</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-xs text-slate-400 block">Semantic Match Score</span>
                <span className="font-semibold text-brand-600">92.5% Alignment</span>
              </div>
            </div>
          </div>
        </div>

        {/* Module 2: Turn-by-Turn AI Interviews */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="order-2 md:order-1 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <span className="text-xs font-semibold text-slate-500 uppercase">Live Turn-by-Turn Engine</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-brand-50 text-brand-700">Multi-Modal Audio</span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-brand-50/50 rounded-lg border border-brand-100">
                <span className="text-xs text-brand-600 font-semibold block">Interviewer Question #2:</span>
                <span className="text-slate-800">"How do you handle database connection pooling and transaction rollbacks under concurrent traffic?"</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-xs text-slate-400 block">Evaluation Dimensions:</span>
                <span className="text-slate-700 text-xs">Technical (35%) • Problem-Solving (25%) • Skills Application (20%)</span>
              </div>
            </div>
          </div>
          <div className="order-1 md:order-2">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <Bot className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">2. Dynamic Turn-by-Turn AI Interviews</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              Conducts dynamic conversational interviews tailored to the specific role and candidate resume.
              Features Web Speech text-to-speech audio synthesis and voice-to-text recording, with instant graceful text fallbacks.
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Evidence-based rubric evaluation without score inflation</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Resumable sessions surviving network interruptions</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Technical, behavioral, and architecture questions</li>
            </ul>
          </div>
        </div>

        {/* Module 3: Top-5 Recommendations & HR-Only Decisions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <Award className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">3. Top-5 Rankings & Human Hiring Control</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              Calculates an explainable ranking for each opening: 30% resume match, 50% interview score, and 20% required skills coverage.
              Presents up to five top eligible candidates to HR recruiters, who exclusively hold final authority to select, reject, or issue offers.
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Never fabricates candidates if fewer than 5 apply</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Full applicant pool remains accessible for recruiter review</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Mandatory recruiter rationale logging for compliance</li>
            </ul>
          </div>
          <div className="p-6 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <span className="text-xs font-semibold text-slate-400 uppercase">HR Final Authority Panel</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-900 text-indigo-300">Human Oversight Active</span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-slate-800 rounded-lg">
                <span className="text-xs text-slate-400 block">AI Recommendation</span>
                <span className="font-semibold text-emerald-400">Rank #1 • Overall 91.8% Fit</span>
              </div>
              <div className="p-3 bg-slate-800 rounded-lg">
                <span className="text-xs text-slate-400 block">Recruiter Action Required</span>
                <span className="text-xs text-slate-300">AI cannot issue employment contracts. Recruiter must confirm decision.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

