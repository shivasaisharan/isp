import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-sm space-y-6 text-sm text-slate-700 leading-relaxed">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Terms of Service</h1>
          <p className="text-xs text-slate-500">Effective Date: October 2026 • Version 2.0</p>
          
          <h2 className="text-lg font-bold text-slate-900 pt-4">1. Acceptance of Terms</h2>
          <p>
            By accessing or using the Smart Recruit SaaS platform, organizations and applicants agree to be bound by these Terms of Service.
          </p>

          <h2 className="text-lg font-bold text-slate-900 pt-4">2. Role of Artificial Intelligence</h2>
          <p>
            Smart Recruit's AI engine serves solely as an assessment, question generation, and ranking recommendation tool.
            The AI does not hold legal hiring authority. All official employment offers, selections, or rejections must be confirmed by human recruiters.
          </p>

          <h2 className="text-lg font-bold text-slate-900 pt-4">3. Fair & Truthful Submissions</h2>
          <p>
            Candidates certify that submitted resumes, technical credentials, and interview answers reflect authentic personal experience.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}

