import React, { useState, useEffect } from 'react';
import { CheckSquare, XCircle, Clock, ShieldCheck, User } from 'lucide-react';
import api from '../../services/api';

export default function HrDecisions() {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDecisions = async () => {
      try {
        const res = await api.get('/decisions');
        setDecisions(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDecisions();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Confirmed Hiring Decisions</h1>
        <p className="text-xs text-slate-400 mt-1">
          Immutable audit record of all selections, holds, and rejections executed by authorized HR personnel.
        </p>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {decisions.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No finalized hiring decisions recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {decisions.map((d) => (
              <div key={d.id} className="p-6 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${
                      d.decision === 'selected' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                      d.decision === 'rejected' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                      'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      {d.decision}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      Application Reference: {d.application_id.substring(0, 8)}...
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Decided on {new Date(d.decided_at).toLocaleString()}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/80 text-xs">
                  <span className="text-slate-400 font-bold block mb-1">Human Rationale Logged:</span>
                  <p className="text-slate-200 leading-relaxed">"{d.rationale}"</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

