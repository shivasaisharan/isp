import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, FileText, Bot, Sparkles, User, Bell } from 'lucide-react';
import api from '../../services/api';

export default function CandidateActivity() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await api.get('/activity');
        setActivities(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, []);

  const getEventIcon = (type) => {
    switch (type) {
      case 'account_created': return User;
      case 'profile_updated': return User;
      case 'resume_uploaded': return FileText;
      case 'resume_analyzed': return Sparkles;
      case 'application_submitted': return FileText;
      case 'interview_started': return Bot;
      case 'interview_completed': return CheckCircle2;
      default: return Clock;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Candidate Activity Timeline</h1>
        <p className="text-xs text-slate-500 mt-1">
          Chronological record of your previous interactions, applications, and assessment events.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        {activities.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8">No recorded activity events yet.</p>
        ) : (
          <div className="relative border-l border-slate-200 ml-4 space-y-8 pl-6">
            {activities.map((act) => {
              const Icon = getEventIcon(act.event_type);
              return (
                <div key={act.id} className="relative group">
                  {/* Timeline bullet */}
                  <div className="absolute -left-[35px] top-1 w-6 h-6 rounded-full bg-brand-50 border-2 border-brand-600 flex items-center justify-center text-brand-600">
                    <Icon className="w-3 h-3" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        {act.event_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(act.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{act.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

