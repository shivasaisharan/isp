import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { Check, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PricingPage() {
  const tiers = [
    {
      name: "Starter",
      price: "$0",
      period: "forever",
      desc: "For small teams and placement cells getting started with AI screening.",
      features: [
        "Up to 3 Active Job Postings",
        "50 AI Turn-by-Turn Interviews / mo",
        "PDF Resume Parsing & Skill Extraction",
        "Blind Screening Alias Masking",
        "Candidate Activity Timelines",
        "Standard Email & Community Support"
      ],
      cta: "Get Started Free",
      link: "/hr/register"
    },
    {
      name: "Professional",
      price: "$199",
      period: "per month",
      featured: true,
      desc: "For fast-growing companies and professional recruitment agencies.",
      features: [
        "Up to 25 Active Job Postings",
        "250 AI Turn-by-Turn Interviews / mo",
        "Explainable Top-5 Recommendation Board",
        "Multidimensional Radar Scorecards",
        "Multi-Seat Recruiter Team Tenancy",
        "Human Decision Override & Audit Logs",
        "Priority Support & API Access"
      ],
      cta: "Start 14-Day Trial",
      link: "/hr/register"
    },
    {
      name: "Enterprise",
      price: "$599",
      period: "per month",
      desc: "For high-volume talent acquisition organizations requiring strict compliance.",
      features: [
        "Unlimited Active Job Postings",
        "Unlimited AI Interviews & Evaluations",
        "Custom Rubric Weights & Scoring Configurations",
        "Dedicated Multi-Tenant Database Isolation",
        "SSO / SAML Enterprise Authentication",
        "SOC2 & Responsible AI Compliance Reports",
        "Dedicated Customer Success Manager"
      ],
      cta: "Contact Enterprise Sales",
      link: "/contact"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <span className="text-xs uppercase font-bold text-brand-600 tracking-wider">Subscription Tiers</span>
          <h1 className="text-4xl font-extrabold text-slate-900 mt-2 tracking-tight">Transparent Commercial Pricing</h1>
          <p className="mt-3 text-slate-600 text-sm max-w-2xl mx-auto">
            Choose the entitlement tier suited for your recruitment velocity. No fake payment processing.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((t, idx) => (
            <div
              key={idx}
              className={`p-8 rounded-2xl bg-white border flex flex-col justify-between ${
                t.featured ? 'border-brand-600 shadow-xl ring-2 ring-brand-600/20 relative' : 'border-slate-200 shadow-sm'
              }`}
            >
              {t.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold bg-brand-600 text-white uppercase tracking-wider">
                  Most Popular
                </span>
              )}
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">{t.name}</h3>
                <p className="text-xs text-slate-500 mb-6">{t.desc}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-slate-900">{t.price}</span>
                  <span className="text-xs text-slate-500">/{t.period}</span>
                </div>
                <div className="space-y-3 pt-6 border-t border-slate-100 mb-8">
                  {t.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-slate-700">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Link
                to={t.link}
                className={`w-full py-2.5 text-center text-xs font-bold rounded-xl transition-all ${
                  t.featured ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-md' : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}

