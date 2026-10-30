import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { ArrowDown, CheckCircle2, ShieldCheck, UserCheck, Bot, FileText, Award } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HowItWorksPage() {
  const steps = [
    {
      title: "1. Job Specification & Competency Definition",
      actor: "HR Recruiter",
      badge: "Recruiter Action",
      desc: "The hiring manager creates an opening under their organization tenancy, defining required skills, experience levels, and department requirements."
    },
    {
      title: "2. Candidate Application & Resume Parsing",
      actor: "Candidate Applicant",
      badge: "Candidate Action",
      desc: "Candidates apply with their PDF resume. Smart Recruit extracts technical competencies and calculates semantic similarity without human intervention delay."
    },
    {
      title: "3. Turn-by-Turn AI Mock Interview",
      actor: "Smart Recruit AI Engine",
      badge: "AI Assessment",
      desc: "Candidates enter the interactive interview room. The AI asks context-aware technical, architectural, and behavioral questions with voice & audio synthesis."
    },
    {
      title: "4. Multi-Dimensional Scorecard & Top-5 Board",
      actor: "Smart Recruit AI Engine",
      badge: "AI Recommendation",
      desc: "The engine scores answers across 5 dimensions (35% Tech, 25% Problem-solving, 20% Skills, 10% Comm, 10% Project) and recommends the top 5 eligible candidates."
    },
    {
      title: "5. Human Oversight & Final Hiring Decision",
      actor: "Authorized HR Recruiter",
      badge: "Exclusive HR Authority",
      desc: "HR reviews detailed scorecards, identified strengths, and interview transcripts. The recruiter records their decision with mandatory justification."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <span className="text-xs uppercase font-bold text-brand-600 tracking-wider">Recruitment Process</span>
          <h1 className="text-4xl font-extrabold text-slate-900 mt-2 tracking-tight">How Smart Recruit Operates</h1>
          <p className="mt-3 text-slate-600 text-sm max-w-2xl mx-auto">
            A transparent division of responsibility: AI evaluates and recommends; authorized HR professionals make final hiring determinations.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="space-y-8 relative">
          {steps.map((st, i) => (
            <div key={i} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm relative hover:border-brand-300 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-brand-50 text-brand-700 border border-brand-200">
                  {st.badge}
                </span>
                <span className="text-xs font-semibold text-slate-400">Step {i + 1} of 5</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{st.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{st.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center p-8 bg-brand-50 rounded-2xl border border-brand-200 text-slate-800">
          <h3 className="text-base font-bold text-slate-900 mb-2">Ready to see it in action?</h3>
          <p className="text-xs text-slate-600 mb-5 max-w-md mx-auto">
            Sign in as a candidate to test the turn-by-turn interview room, or sign in as HR to manage jobs and applicants.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/candidate/register" className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700">
              Candidate Experience
            </Link>
            <Link to="/hr/login" className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800">
              Recruiter Demo
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

