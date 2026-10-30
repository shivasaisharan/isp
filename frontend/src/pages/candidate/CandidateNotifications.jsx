import React from 'react';
import { Bell, Check, CheckCheck, ArrowRight } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { Link } from 'react-router-dom';

export default function CandidateNotifications() {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Notification Center</h1>
          <p className="text-xs text-slate-500 mt-1">Application status updates, interview availability, and HR outcomes.</p>
        </div>
        {notifications.length > 0 && (
          <button
            onClick={markAllAsRead}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark All as Read
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {notifications.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            No notifications found.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-5 flex items-start justify-between gap-4 transition-colors ${
                n.is_read ? 'bg-white' : 'bg-brand-50/40'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">{n.title}</h3>
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-brand-600"></span>
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                <span className="text-[10px] text-slate-400 block pt-1">
                  {new Date(n.created_at).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {n.link && (
                  <Link
                    to={n.link}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-brand-600 text-xs font-bold flex items-center gap-1"
                  >
                    View <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
                {!n.is_read && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-600"
                    title="Mark as Read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

