import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { Building2, Users2, Rocket, GraduationCap, CheckCircle2 } from 'lucide-react';

export default function SolutionsPage() {
  const solutions = [
    {
      icon: Building2,
      title: "Enterprise Talent Teams",
      desc: "Standardize multi-team technical screening across thousands of applicants. Maintain ISO and responsible AI compliance with immutable audit logging."
    },
    {
      icon: Users2,
      title: "Recruitment Agencies",
      desc: "Deliver pre-vetted candidate shortlists to client companies with evidence-based scorecards, objective skill gap summaries, and turn-by-turn transcripts."
    },
    {
      icon: Rocket,
      title: "Startups & Growth Businesses",
      desc: "Hire senior engineers quickly without burning dozens of engineering team hours on initial exploratory technical screening calls."
    },
    {
      icon: GraduationCap,
      title: "University Placement Cells",
      desc: "Provide students with realistic mock interview practice sessions, instant multidimensional rubric feedback, and targeted curriculum improvement areas."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <span className="text-xs uppercase font-bold text-brand-600 tracking-wider">Use Cases</span>
          <h1 className="text-4xl font-extrabold text-slate-900 mt-2 tracking-tight">Tailored Hiring Solutions</h1>
          <p className="mt-3 text-slate-600 text-sm max-w-2xl mx-auto">
            From university placement prep to global enterprise recruitment pipelines.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {solutions.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-5">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      <Footer />
    </div>
  );
}

