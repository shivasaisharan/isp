import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  ShieldCheck,
  Activity,
  Users,
  CheckCircle2,
  Award,
  Briefcase,
  Bot,
  FileText,
  AlertTriangle,
  Search,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Building2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  Code,
  Copy,
  Check,
  ArrowRight,
  X,
  XCircle,
  Tag
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import api from '../../services/api';

const AUDIT_CATEGORIES = [
  { id: 'all', label: 'All Events', countKey: 'total_audit_events' },
  { id: 'hiring', label: 'Hiring Decisions', countKey: 'hiring_decisions' },
  { id: 'application', label: 'Candidate Applications', countKey: 'candidate_applications' },
  { id: 'interview', label: 'Interview Events', countKey: 'interview_events' },
  { id: 'resume', label: 'Resume Events', countKey: 'resume_events' },
  { id: 'security', label: 'Security Events', countKey: 'security_events' },
  { id: 'job', label: 'Job Management', countKey: 'job_management_events' },
];

export default function HrAnalytics() {
  const [metrics, setMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  // Audit Trail State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditSummary, setAuditSummary] = useState({
    total_audit_events: 0,
    hiring_decisions: 0,
    candidate_applications: 0,
    interview_events: 0,
    resume_events: 0,
    security_events: 0,
    job_management_events: 0
  });
  const [loadingAudits, setLoadingAudits] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Pagination & Filters
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedReviewer, setSelectedReviewer] = useState('all');
  const [selectedEventType, setSelectedEventType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  // Reviewers list for dropdown
  const [reviewers, setReviewers] = useState([]);

  // Card Expand / Modal State
  const [expandedCards, setExpandedCards] = useState({});
  const [modalAudit, setModalAudit] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Fetch Pipeline & Overview Metrics
  const fetchOverviewMetrics = async () => {
    try {
      const res = await api.get('/analytics/metrics');
      setMetrics(res.data);
    } catch (err) {
      console.error('Failed to fetch analytics metrics:', err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  // Fetch Reviewers for filter
  const fetchReviewers = async () => {
    try {
      const res = await api.get('/hr/reviewers');
      setReviewers(res.data || []);
    } catch (err) {
      console.error('Failed to fetch HR reviewers:', err);
    }
  };

  // Fetch Audit Summary Counts
  const fetchAuditSummary = useCallback(async () => {
    try {
      const res = await api.get('/hr/audit-trail/summary');
      if (res.data) {
        setAuditSummary(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch audit summary:', err);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch Audit Trail with Filters
  const fetchAuditTrail = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadingAudits(true);

    try {
      const params = {
        page,
        page_size: pageSize,
        sort_order: sortOrder
      };

      if (activeCategory !== 'all') {
        params.category = activeCategory;
      }
      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }
      if (selectedReviewer !== 'all') {
        params.reviewer_id = selectedReviewer;
      }
      if (selectedEventType !== 'all') {
        params.event_type = selectedEventType;
      }
      if (startDate) {
        params.start_date = new Date(startDate).toISOString();
      }
      if (endDate) {
        const endD = new Date(endDate);
        endD.setHours(23, 59, 59, 999);
        params.end_date = endD.toISOString();
      }

      const res = await api.get('/hr/audit-trail', { params });
      if (res.data) {
        setAuditLogs(res.data.items || []);
        setTotalCount(res.data.total || 0);
        setTotalPages(res.data.total_pages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch audit trail:', err);
    } finally {
      setLoadingAudits(false);
      setRefreshing(false);
    }
  }, [activeCategory, debouncedSearch, selectedReviewer, selectedEventType, startDate, endDate, sortOrder, page]);

  useEffect(() => {
    fetchOverviewMetrics();
    fetchReviewers();
  }, []);

  useEffect(() => {
    fetchAuditSummary();
  }, [fetchAuditSummary]);

  useEffect(() => {
    fetchAuditTrail();
  }, [fetchAuditTrail]);

  const handleRefresh = async () => {
    await Promise.all([fetchOverviewMetrics(), fetchAuditSummary(), fetchAuditTrail(true)]);
  };

  const handleResetFilters = () => {
    setActiveCategory('all');
    setSearchTerm('');
    setSelectedReviewer('all');
    setSelectedEventType('all');
    setStartDate('');
    setEndDate('');
    setSortOrder('desc');
    setPage(1);
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const res = await api.get('/hr/audit-trail/export', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `compliance_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error('Failed to export audit trail CSV:', err);
    } finally {
      setExporting(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getEventVisuals = (log) => {
    const act = (log.action || '').toLowerCase();
    const cat = (log.category || '').toLowerCase();

    if (act === 'candidate_accepted' || act.includes('accept')) {
      return {
        icon: Award,
        bg: 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80',
        cardBorder: 'border-l-4 border-l-emerald-500',
        badge: 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
      };
    }
    if (act === 'candidate_rejected' || act.includes('reject')) {
      return {
        icon: XCircle,
        bg: 'bg-rose-950/80 text-rose-400 border border-rose-800/80',
        cardBorder: 'border-l-4 border-l-rose-500',
        badge: 'bg-rose-950/80 text-rose-300 border border-rose-800'
      };
    }
    if (cat === 'hiring') {
      return {
        icon: Award,
        bg: 'bg-indigo-950/80 text-indigo-400 border border-indigo-800/80',
        cardBorder: 'border-l-4 border-l-indigo-500',
        badge: 'bg-indigo-950/80 text-indigo-300 border border-indigo-800'
      };
    }
    if (cat === 'interview') {
      return {
        icon: Bot,
        bg: 'bg-teal-950/80 text-teal-400 border border-teal-800/80',
        cardBorder: 'border-l-4 border-l-teal-500',
        badge: 'bg-teal-950/80 text-teal-300 border border-teal-800'
      };
    }
    if (cat === 'application') {
      return {
        icon: Briefcase,
        bg: 'bg-sky-950/80 text-sky-400 border border-sky-800/80',
        cardBorder: 'border-l-4 border-l-sky-500',
        badge: 'bg-sky-950/80 text-sky-300 border border-sky-800'
      };
    }
    if (cat === 'resume') {
      return {
        icon: FileText,
        bg: 'bg-purple-950/80 text-purple-400 border border-purple-800/80',
        cardBorder: 'border-l-4 border-l-purple-500',
        badge: 'bg-purple-950/80 text-purple-300 border border-purple-800'
      };
    }
    if (cat === 'security') {
      return {
        icon: AlertTriangle,
        bg: 'bg-amber-950/80 text-amber-400 border border-amber-800/80',
        cardBorder: 'border-l-4 border-l-amber-500',
        badge: 'bg-amber-950/80 text-amber-300 border border-amber-800'
      };
    }
    return {
      icon: Activity,
      bg: 'bg-slate-800 text-slate-300 border border-slate-700',
      cardBorder: 'border-l-4 border-l-slate-600',
      badge: 'bg-slate-800 text-slate-300 border border-slate-700'
    };
  };

  const formatTimestamp = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const getRelativeTime = (isoString) => {
    if (!isoString) return '';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 30) return `${diffDays}d ago`;
      return '';
    } catch {
      return '';
    }
  };

  const hasActiveFilters =
    activeCategory !== 'all' ||
    searchTerm.trim() !== '' ||
    selectedReviewer !== 'all' ||
    selectedEventType !== 'all' ||
    startDate !== '' ||
    endDate !== '' ||
    sortOrder !== 'desc';

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          Recruitment Analytics & Compliance
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Pipeline throughput, candidate alignment metrics, and immutable enterprise AI ethics audit trail.
        </p>
      </div>

      {/* Overview Stat Cards */}
      {loadingMetrics ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 rounded-xl bg-slate-950 border border-slate-800 animate-pulse h-28"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Average Candidate Alignment
            </span>
            <span className="text-3xl font-extrabold text-indigo-400">
              {metrics?.average_resume_match || 0}%
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">
              Semantic match across candidate pool
            </span>
          </div>

          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Interviews Conducted
            </span>
            <span className="text-3xl font-extrabold text-emerald-400">
              {metrics?.interviews_completed || 0}
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">
              Turn-by-turn evaluations complete
            </span>
          </div>

          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Final Selection Rate
            </span>
            <span className="text-3xl font-extrabold text-white">
              {metrics?.total_applications > 0
                ? Math.round((metrics.selected_candidates / metrics.total_applications) * 100)
                : 0}%
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">
              Candidate offers confirmed by HR
            </span>
          </div>
        </div>
      )}

      {/* Stage Distribution Chart */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-base font-bold text-white mb-4">Pipeline Stage Funnel</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics?.pipeline_stages || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="stage" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  color: '#f8fafc',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* REDESIGNED ENTERPRISE IMMUTABLE RESPONSIBLE AI COMPLIANCE AUDIT TRAIL     */}
      {/* ========================================================================= */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Immutable Responsible AI Compliance Audit Trail
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 pl-10.5">
              Tamper-proof chronological record of human recruiter decisions, candidate milestones, AI evaluations, and system governance events.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Audit Active • Immutability Enforced
            </span>

            <button
              onClick={handleRefresh}
              disabled={refreshing || loadingAudits}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              title="Refresh audit records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={exporting || loadingAudits}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-sm disabled:opacity-50"
              title="Download official compliance audit log in CSV format"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exporting ? 'Exporting...' : 'Export Audit CSV'}</span>
            </button>
          </div>
        </div>

        {/* 6 Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Total Events</span>
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <span className="text-xl font-black text-white">{auditSummary.total_audit_events}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Audit records</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Hiring Decisions</span>
              <Award className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-xl font-black text-emerald-400">{auditSummary.hiring_decisions}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Offer confirmations</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Applications</span>
              <Briefcase className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <span className="text-xl font-black text-sky-400">{auditSummary.candidate_applications}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Applied & status updates</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider">AI Interviews</span>
              <Bot className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <span className="text-xl font-black text-teal-400">{auditSummary.interview_events}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Session executions</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Resume Events</span>
              <FileText className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <span className="text-xl font-black text-purple-400">{auditSummary.resume_events}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">CV parsing & updates</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Security Events</span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-xl font-black text-amber-400">{auditSummary.security_events}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Proctor alerts</span>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3.5">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {AUDIT_CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              const countVal = cat.countKey ? auditSummary[cat.countKey] : null;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700/80 hover:text-white'
                  }`}
                >
                  <span>{cat.label}</span>
                  {countVal !== null && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      {countVal}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Secondary Filter Row: Search, Reviewer, Dates, Sort */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-2 border-t border-slate-800/80">
            {/* Search Input */}
            <div className="relative md:col-span-4">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search candidate, job, reviewer, or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8.5 pr-7 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs font-semibold"
                >
                  ×
                </button>
              )}
            </div>

            {/* HR Reviewer Dropdown */}
            <div className="md:col-span-3">
              <select
                value={selectedReviewer}
                onChange={(e) => {
                  setSelectedReviewer(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All HR Reviewers</option>
                {reviewers.map((rev) => (
                  <option key={rev.id} value={rev.id}>
                    {rev.full_name} – {rev.designation || rev.role}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Inputs */}
            <div className="flex items-center gap-1.5 md:col-span-3">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                title="Start Date"
              />
              <span className="text-xs text-slate-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                title="End Date"
              />
            </div>

            {/* Sort & Reset */}
            <div className="flex items-center gap-2 md:col-span-2 justify-end">
              <select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>

              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="px-2 py-1.5 text-xs text-slate-400 hover:text-rose-400 rounded-lg whitespace-nowrap transition-colors"
                  title="Clear all filters"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Audit Event Cards List */}
        {loadingAudits ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
            <p className="text-xs text-slate-400">Resolving compliance audit events with database relationships...</p>
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="text-center py-16 px-4 bg-slate-900/40 rounded-xl border border-slate-800/80">
            <ShieldCheck className="w-10 h-10 mx-auto text-slate-600 mb-3" />
            <h3 className="text-sm font-bold text-white">No compliance audit records found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'Try broadening your search term or adjusting category and date range filters.'
                : 'No audit events recorded yet for this organization.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="mt-4 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {auditLogs.map((log) => {
              const visuals = getEventVisuals(log);
              const Icon = visuals.icon;
              const isExpanded = !!expandedCards[log.id];
              const relativeTime = getRelativeTime(log.created_at);
              const formattedTime = formatTimestamp(log.created_at);

              return (
                <div
                  key={log.id}
                  className={`bg-slate-900/90 hover:bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 transition-all shadow-sm ${visuals.cardBorder}`}
                >
                  {/* Top Bar: Action Icon, Title, Badges, Reference, Timestamps */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${visuals.bg}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white tracking-tight">
                            {log.action_display}
                          </h4>
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider ${visuals.badge}`}>
                            {log.category_display}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-950 text-indigo-300 border border-slate-800 font-semibold" title={`Audit Record Reference: ${log.event_reference}`}>
                            {log.event_reference}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-slate-400 text-xs shrink-0">
                      {relativeTime && (
                        <span className="font-semibold text-slate-300 text-[11px]">
                          {relativeTime}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500">
                        • {formattedTime}
                      </span>
                    </div>
                  </div>

                  {/* Main Section: Candidate, Job & Company, Performer */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-3.5">
                    {/* Candidate Info */}
                    <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                        Candidate Information
                      </span>
                      {log.candidate_name ? (
                        <div>
                          <p className="text-xs font-bold text-slate-100">{log.candidate_name}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {log.candidate_reference && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-indigo-400 font-semibold">
                                {log.candidate_reference}
                              </span>
                            )}
                            {log.candidate_email && (
                              <span className="text-[10px] text-slate-500 truncate" title={log.candidate_email}>
                                {log.candidate_email}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">General Organization Action</p>
                      )}
                    </div>

                    {/* Job & Company Info */}
                    <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                        Job Position & Company
                      </span>
                      {log.job_title ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <p className="text-xs font-bold text-slate-100 truncate" title={log.job_title}>
                              {log.job_title}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400">
                            <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate">{log.company_name || 'Smart Recruit Enterprise'}</span>
                            {log.job_reference && (
                              <span className="text-[10px] font-mono text-slate-500">
                                ({log.job_reference})
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-semibold text-slate-300">
                            {log.company_name || 'Organization Level'}
                          </p>
                          <span className="text-[10px] text-slate-500">System governance action</span>
                        </div>
                      )}
                    </div>

                    {/* Performer / Reviewer Info */}
                    <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                        Action Performer
                      </span>
                      <p className="text-xs font-bold text-slate-100">{log.actor_name}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-900 border border-slate-800 text-slate-300 font-medium">
                          {log.actor_designation}
                        </span>
                        {log.actor_reference && (
                          <span className="text-[10px] font-mono text-slate-500">
                            {log.actor_reference}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Detail Section: Status Transition & Notes */}
                  {(log.previous_status || log.new_status || log.decision_notes) && (
                    <div className="mt-3.5 pt-3.5 border-t border-slate-800/80 space-y-2.5">
                      {/* Status Transition Badges */}
                      {(log.previous_status || log.new_status) && (
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="text-[11px] font-semibold text-slate-400">Status Transition:</span>
                          {log.previous_status && (
                            <span className="px-2 py-0.5 rounded text-[11px] bg-slate-950 text-slate-300 border border-slate-800">
                              {log.previous_status}
                            </span>
                          )}
                          {log.previous_status && log.new_status && (
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          {log.new_status && (
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                log.new_status.toLowerCase() === 'accepted'
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                  : log.new_status.toLowerCase() === 'rejected'
                                  ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                                  : 'bg-indigo-950/80 text-indigo-300 border-indigo-800'
                              }`}
                            >
                              {log.new_status}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Decision Notes */}
                      {log.decision_notes && (
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/90 text-xs text-slate-300 leading-relaxed">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                            Recorded Rationale / Explanation:
                          </span>
                          "{log.decision_notes}"
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expandable Section & Actions */}
                  <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {log.application_reference && (
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {log.application_reference}
                        </span>
                      )}
                      {log.assessment_reference && (
                        <span className="text-[10px] text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800/60">
                          {log.assessment_reference}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setModalAudit(log)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                        title="View complete audit certificate & verification details"
                      >
                        <Eye className="w-3 h-3 text-indigo-400" />
                        <span>Inspect Record</span>
                      </button>

                      <button
                        onClick={() => toggleExpand(log.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold text-slate-400 hover:text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-colors"
                      >
                        <span>{isExpanded ? 'Hide Raw Details' : 'Raw Details'}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Technical Details Accordion */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 bg-slate-950/90 rounded-lg p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                          <Code className="w-3.5 h-3.5 text-indigo-400" />
                          Immutable Audit Payload & Technical Metadata
                        </span>
                        <button
                          onClick={() => copyToClipboard(log.details_json, log.id)}
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-indigo-400"
                        >
                          {copiedId === log.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy JSON</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono text-slate-400 pb-2 border-b border-slate-800">
                        <div>
                          <span className="text-slate-500 block">Database Action:</span>
                          <span className="text-indigo-300">{log.action}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Actor Role:</span>
                          <span className="text-slate-300">{log.actor_role}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Resource Type:</span>
                          <span className="text-slate-300">{log.resource_type || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Resource ID:</span>
                          <span className="text-slate-300 truncate block" title={log.resource_id || 'N/A'}>
                            {log.resource_id || 'N/A'}
                          </span>
                        </div>
                      </div>

                      <pre className="p-2.5 rounded bg-slate-950 border border-slate-800/80 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 scrollbar-thin">
                        {JSON.stringify(log.details_json, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {!loadingAudits && totalPages > 1 && (
          <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <p>
              Showing <span className="font-semibold text-white">{(page - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-white">{Math.min(page * pageSize, totalCount)}</span> of{' '}
              <span className="font-semibold text-white">{totalCount}</span> compliance audit events
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => {
                  const showEllipsisBefore = idx > 0 && p - arr[idx - 1] > 1;
                  return (
                    <React.Fragment key={p}>
                      {showEllipsisBefore && (
                        <span className="px-1 text-slate-500 text-xs">...</span>
                      )}
                      <button
                        onClick={() => setPage(p)}
                        className={`min-w-[28px] h-7 text-xs rounded-lg font-semibold transition-colors ${
                          page === p
                            ? 'bg-indigo-600 text-white'
                            : 'border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* AUDIT DETAILS INSPECTION MODAL                                            */}
      {/* ========================================================================= */}
      {modalAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Compliance Audit Record</h3>
                  <p className="text-xs font-mono text-indigo-400">{modalAudit.event_reference}</p>
                </div>
              </div>
              <button
                onClick={() => setModalAudit(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 text-xs">
              {/* Event Type & Verified Badge */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                    Action Title
                  </span>
                  <p className="text-sm font-bold text-white mt-0.5">{modalAudit.action_display}</p>
                  <span className="text-[11px] text-slate-400">{modalAudit.category_display}</span>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase">
                    Tamper-Proof
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1">{formatTimestamp(modalAudit.created_at)}</p>
                </div>
              </div>

              {/* 3 Columns Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Candidate Column */}
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                    Candidate
                  </span>
                  <p className="text-xs font-bold text-slate-100">
                    {modalAudit.candidate_name || 'Organization Action'}
                  </p>
                  {modalAudit.candidate_reference && (
                    <p className="text-[10px] font-mono text-indigo-400 mt-0.5">
                      {modalAudit.candidate_reference}
                    </p>
                  )}
                  {modalAudit.candidate_email && (
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">{modalAudit.candidate_email}</p>
                  )}
                </div>

                {/* Job & Company Column */}
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                    Position & Org
                  </span>
                  <p className="text-xs font-bold text-slate-100">
                    {modalAudit.job_title || 'General Management'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{modalAudit.company_name}</p>
                  {modalAudit.job_reference && (
                    <p className="text-[10px] font-mono text-slate-500 mt-0.5">{modalAudit.job_reference}</p>
                  )}
                </div>

                {/* Performer Column */}
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                    Recorded Actor
                  </span>
                  <p className="text-xs font-bold text-slate-100">{modalAudit.actor_name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{modalAudit.actor_designation}</p>
                  {modalAudit.actor_reference && (
                    <p className="text-[10px] font-mono text-slate-500 mt-0.5">{modalAudit.actor_reference}</p>
                  )}
                </div>
              </div>

              {/* Status Transition */}
              {(modalAudit.previous_status || modalAudit.new_status) && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Status Transition
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      {modalAudit.previous_status || 'Initial'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 font-semibold">
                      {modalAudit.new_status || 'Current'}
                    </span>
                  </div>
                </div>
              )}

              {/* Recorded Notes */}
              {modalAudit.decision_notes && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                    Decision Explanation & Reviewer Notes
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    "{modalAudit.decision_notes}"
                  </p>
                </div>
              )}

              {/* Raw JSON Details */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Original Immutable Metadata Payload
                  </span>
                  <button
                    onClick={() => copyToClipboard(modalAudit.details_json, 'modal-json')}
                    className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-indigo-400"
                  >
                    {copiedId === 'modal-json' ? (
                      <span className="text-emerald-400">Copied!</span>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-40 scrollbar-thin">
                  {JSON.stringify(modalAudit.details_json, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-[10px] font-mono text-slate-500">
                Audit Record ID: {modalAudit.id}
              </span>
              <button
                onClick={() => setModalAudit(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
