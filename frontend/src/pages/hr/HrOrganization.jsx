import React, { useState, useEffect } from 'react';
import { Building2, Users, Shield, CreditCard, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';

export default function HrOrganization() {
  const [org, setOrg] = useState(null);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrgData = async () => {
      try {
        const [orgRes, teamRes] = await Promise.all([
          api.get('/organization/details'),
          api.get('/organization/team')
        ]);
        setOrg(orgRes.data);
        setTeam(teamRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrgData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Organization Tenancy & Entitlements</h1>
        <p className="text-xs text-slate-400 mt-1">Multi-tenant isolation, recruiter seats, and subscription allowances.</p>
      </div>

      {/* Tenancy Overview Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-extrabold flex items-center justify-center text-lg shadow-md">
              {org?.name?.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{org?.name}</h2>
              <span className="text-xs text-slate-400">Tenant Slug: {org?.slug} • Plan: {org?.plan?.toUpperCase()}</span>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 w-fit">
            Active Enterprise Tenant
          </span>
        </div>

        {/* Entitlements Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-slate-400 block mb-1">Active Job Postings Allowance</span>
            <span className="text-2xl font-bold text-white">{org?.active_jobs_limit} Openings</span>
            <span className="text-[10px] text-slate-500 block mt-1">Enforced by SaaS entitlement service</span>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-slate-400 block mb-1">Monthly AI Interview Quota</span>
            <span className="text-2xl font-bold text-indigo-400">{org?.monthly_interview_allowance} Sessions / mo</span>
            <span className="text-[10px] text-slate-500 block mt-1">Refreshes monthly with rollover</span>
          </div>
        </div>
      </div>

      {/* Recruiter Team Seats */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            Recruiter Team Members
          </h2>
          <span className="text-xs text-slate-400">{team.length} Provisioned Seats</span>
        </div>

        <div className="divide-y divide-slate-800">
          {team.map((member) => (
            <div key={member.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">{member.full_name}</p>
                <p className="text-xs text-slate-400">{member.email}</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-indigo-300 uppercase">
                {member.role}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

