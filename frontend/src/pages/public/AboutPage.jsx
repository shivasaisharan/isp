import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { ShieldCheck, Scale, Users, HeartHandshake, Award } from 'lucide-react';

export default function AboutPage() {
  const pillars = [
    { title: "Bias Elimination", desc: "Cryptographic blind screening masks names and demographic identifiers to anchor evaluation purely on verified engineering competencies." },
    { title: "Explainable Rubrics", desc: "Transparent weights across 5 dimensions: Technical Correctness (35%), Problem Solving (25%), Skills (20%), Communication (10%), Project (10%)." },
    { title: "Human Oversight", desc: "AI is strictly an assessment and recommendation engine. Authorized HR personnel exclusively make final employment choices." },
    { title: "Candidate Empowerment", desc: "Candidates receive actionable skill gap analysis and retain full historical visibility over their submitted applications and interview scorecards." },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <span className="text-xs uppercase font-bold text-brand-600 tracking-wider">Company & Mission</span>
          <h1 className="text-4xl font-extrabold text-slate-900 mt-2 tracking-tight">Ethical AI for Fairer Hiring</h1>
          <p className="mt-3 text-slate-600 text-sm max-w-2xl mx-auto">
            Smart Recruit is engineered around the core conviction that AI should empower, standardize, and accelerate technical recruitment—never replace human empathy and final judgment.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {pillars.map((p, idx) => (
            <div key={idx} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-2">{p.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}

