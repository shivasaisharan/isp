import React, { useState } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { Mail, MessageSquare, Building2, Send, CheckCircle2 } from 'lucide-react';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    role: 'Recruitment Leader',
    message: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <span className="text-xs uppercase font-bold text-brand-600 tracking-wider">Contact & Inquiries</span>
          <h1 className="text-4xl font-extrabold text-slate-900 mt-2 tracking-tight">Connect with Smart Recruit</h1>
          <p className="mt-3 text-slate-600 text-sm max-w-2xl mx-auto">
            Schedule an enterprise architecture walkthrough or discuss deployment integrations.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-16 w-full">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          {submitted ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Inquiry Received</h3>
              <p className="text-sm text-slate-600 max-w-sm mx-auto mb-6">
                Thank you, {formData.name}. Our enterprise recruitment solutions team will connect with you at {formData.email}.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700"
              >
                Send Another Inquiry
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Your Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    placeholder="Sarah Jenkins"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Work Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    placeholder="sarah@company.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Organization / Agency</label>
                <input
                  type="text"
                  required
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  placeholder="Global Tech Solutions"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Message / Requirements</label>
                <textarea
                  rows={4}
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  placeholder="Tell us about your expected hiring volume and interview workflows..."
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl text-sm hover:bg-brand-700 shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Submit Inquiry
              </button>
            </form>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

