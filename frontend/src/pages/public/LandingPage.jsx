import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, ArrowRight, ShieldCheck, CheckCircle2, Bot, Award, BarChart3, Users,
  FileCheck, Cpu, Lock, HelpCircle, ChevronRight
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

export default function LandingPage() {
  const steps = [
    { num: '01', title: 'HR Creates Job Opening', desc: 'Recruiters define role requirements, experience levels, and prerequisite technical competencies.' },
    { num: '02', title: 'Candidates Apply & Upload Resume', desc: 'Secure PDF parsing with blind-screening PII de-identification to reduce unconscious bias.' },
    { num: '03', title: 'AI Turn-by-Turn Interview', desc: 'Context-aware interactive voice & text questions calibrated dynamically to candidate answers.' },
    { num: '04', title: 'AI Top-5 Recommendation', desc: 'Explainable composite ranking model based on 30% resume match, 50% interview, and 20% skills.' },
    { num: '05', title: 'HR Makes Final Hiring Decision', desc: 'HR recruiters exclusively retain authority to select candidates, record rationales, and issue offers.' },
  ];

  const features = [
    {
      icon: Sparkles,
      title: 'Automated Resume Parsing & Matching',
      desc: 'Parses PDF resumes, extracts competencies across tech taxonomies, and computes semantic alignment without keyword stuffing bias.'
    },
    {
      icon: Bot,
      title: 'Dynamic Turn-by-Turn AI Interviews',
      desc: 'Grounded in target job requirements with text-to-speech audio and voice recognition. Evaluates depth using evidence-based scoring.'
    },
    {
      icon: Award,
      title: 'Explainable Top-5 Candidate Ranking',
      desc: 'Recommends up to five top eligible candidates per job opening with transparent scoring breakdown and identified competencies.'
    },
    {
      icon: ShieldCheck,
      title: 'Human-in-the-Loop Hiring Authority',
      desc: 'AI recommends and assists; HR recruiters exclusively make final selection and rejection decisions with recorded rationales.'
    },
    {
      icon: Lock,
      title: 'Strict Multi-Tenant Isolation',
      desc: 'Independent candidate and recruiter portals. Complete data segregation across enterprise organizations and hiring pipelines.'
    },
    {
      icon: BarChart3,
      title: 'Comprehensive Recruitment Analytics',
      desc: 'Track candidate conversion funnels, time-in-stage metrics, and maintain immutable compliance audit logs for responsible AI.'
    }
  ];

  const faqs = [
    {
      q: 'Does Smart Recruit automatically hire or reject candidates?',
      a: 'No. AI acts strictly as an assessment and recommendation engine. Final hiring decisions are exclusively confirmed by authorized HR recruiters with logged rationales.'
    },
    {
      q: 'How does candidate blind screening work?',
      a: 'Smart Recruit can mask candidate names and demographic identifiers, assigning an anonymized alias (e.g. Candidate #401) to eliminate screening bias.'
    },
    {
      q: 'Can candidates review their past interviews and applications?',
      a: 'Yes. Candidates have a dedicated portal to view submitted applications, track stage timelines, review past interview reports, and inspect personal activity logs.'
    },
    {
      q: 'What scoring rubric is utilized during AI interviews?',
      a: 'Interviews evaluate five transparent dimensions: Technical Correctness (35%), Problem-Solving (25%), Skills Application (20%), Communication Clarity (10%), and Project Depth (10%).'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-32 bg-gradient-to-b from-white via-brand-50/30 to-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-200/80 text-brand-700 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            <span>Commercial-Grade AI Recruitment SaaS Platform</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight sm:leading-none mb-6">
            Intelligent Screening & AI Interviews with <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600">Exclusive Human Hiring Control</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Smart Recruit automates resume parsing, conducts turn-by-turn technical mock interviews,
            and delivers explainable Top-5 candidate recommendations—while keeping final hiring authority exclusively with HR.
          </p>

          {/* Dual Portal CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <Link
              to="/candidate/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 shadow-lg shadow-brand-500/25 transition-all text-sm"
            >
              Candidate Portal
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/hr/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 shadow-md transition-all text-sm"
            >
              HR Recruiter Portal
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
          </div>

          {/* Trust Guarantees */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-xs font-medium text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Multi-Tenant Tenancy</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-brand-600" />
              <span>No AI Autonomous Hiring</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-indigo-600" />
              <span>Explainable Rubric Scoring</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5-Step Workflow Section */}
      <section className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs uppercase tracking-wider font-bold text-brand-600 mb-2">Architected Workflow</h2>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">The 5-Step Continuous Hiring Pipeline</p>
            <p className="mt-3 text-slate-600 text-sm">
              Standardized, objective, and auditable candidate progression from opening creation to confirmed hire.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {steps.map((st) => (
              <div key={st.num} className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 relative flex flex-col justify-between hover:border-brand-300 transition-colors">
                <div>
                  <span className="text-3xl font-extrabold text-brand-600/30 mb-3 block">{st.num}</span>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{st.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{st.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs uppercase tracking-wider font-bold text-brand-600 mb-2">Core SaaS Features</h2>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">Designed for High-Volume, Fair Hiring</p>
            <p className="mt-3 text-slate-600 text-sm">
              Everything required to scale recruitment teams, eliminate screening bottlenecks, and improve candidate readiness.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="p-7 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-5">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-xs uppercase tracking-wider font-bold text-brand-600 mb-2">Questions & Answers</h2>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">Frequently Asked Questions</p>
          </div>

          <div className="space-y-6">
            {faqs.map((faq, idx) => (
              <div key={idx} className="p-6 rounded-xl bg-slate-50 border border-slate-200/80">
                <h3 className="text-base font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-brand-600 shrink-0" />
                  {faq.q}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed pl-6">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="py-16 bg-gradient-to-r from-brand-900 via-indigo-900 to-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Ready to Transform Your Recruitment Process?
          </h2>
          <p className="text-slate-300 max-w-xl mx-auto mb-8 text-sm">
            Join modern organizations utilizing Smart Recruit for standardized technical screening and ethical hiring decisions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/candidate/register"
              className="px-6 py-3 rounded-xl bg-white text-brand-900 font-bold hover:bg-slate-100 transition-all text-sm"
            >
              Sign Up as Candidate
            </Link>
            <Link
              to="/hr/register"
              className="px-6 py-3 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-500 transition-all text-sm border border-brand-400/30"
            >
              Onboard Organization (HR)
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

