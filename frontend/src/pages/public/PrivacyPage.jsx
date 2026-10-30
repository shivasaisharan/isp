import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-sm space-y-6 text-sm text-slate-700 leading-relaxed">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Privacy Policy & Data Retention</h1>
          <p className="text-xs text-slate-500">Effective Date: October 2026 • Version 2.0</p>
          
          <h2 className="text-lg font-bold text-slate-900 pt-4">1. Information We Collect</h2>
          <p>
            Smart Recruit processes candidate account information, uploaded resumes, parsed technical competencies, and turn-by-turn interview transcripts.
            For recruiters, we process organization membership records, role authorizations, and audit actions.
          </p>

          <h2 className="text-lg font-bold text-slate-900 pt-4">2. Blind Screening & PII Anonymization</h2>
          <p>
            When blind screening is active, applicant names and demographic contact details are masked into randomized identifiers (e.g. Candidate #401).
            Recruiters evaluate candidates grounded strictly on demonstrable skills and rubric performance.
          </p>

          <h2 className="text-lg font-bold text-slate-900 pt-4">3. Data Retention & Erasure</h2>
          <p>
            Candidates may request an export of their personal data or account erasure directly from the Candidate Settings panel.
            Resumes and interview transcripts are retained only for active application evaluations.
          </p>

          <h2 className="text-lg font-bold text-slate-900 pt-4">4. Tenant Isolation</h2>
          <p>
            All candidate records, interview scorecards, and hiring deliberations are isolated by organization tenant.
            HR personnel from Organization A cannot access applicant files or job records of Organization B.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}

