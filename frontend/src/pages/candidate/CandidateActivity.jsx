import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  CheckCircle2,
  FileText,
  Bot,
  Sparkles,
  Briefcase,
  Award,
  XCircle,
  Upload,
  Trash2,
  Calendar,
  Search,
  ArrowUpDown,
  Filter,
  RefreshCw,
  Building2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Tag,
  AlertCircle
} from 'lucide-react';
import api from '../../services/api';

const CATEGORIES = [
  { id: 'all', label: 'All Activities', countKey: null },
  { id: 'resume', label: 'Resume Activities', countKey: 'total_resumes_uploaded' },
  { id: 'application', label: 'Job Applications', countKey: 'total_jobs_applied' },
  { id: 'interview', label: 'AI Interviews', countKey: 'interviews_completed' },
  { id: 'decision', label: 'Hiring Decisions', countKey: 'applications_accepted' },
];

export default function CandidateActivity() {
  const [activities, setActivities] = useState([]);
  const [summary, setSummary] = useState({
    total_resumes_uploaded: 0,
    total_jobs_applied: 0,
    interviews_completed: 0,
    applications_accepted: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Filters
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch summary counts
  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get('/candidate/activities/summary');
      if (res.data) {
        setSummary(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch activity summary:', err);
    }
  }, []);

  // Fetch recruitment activities
  const fetchActivities = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

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
        params.company_name = debouncedSearch.trim();
        params.job_title = debouncedSearch.trim();
      }
      if (startDate) {
        params.start_date = new Date(startDate).toISOString();
      }
      if (endDate) {
        // End of the day
        const endD = new Date(endDate);
        endD.setHours(23, 59, 59, 999);
        params.end_date = endD.toISOString();
      }

      const res = await api.get('/candidate/activities', { params });
      if (res.data) {
        setActivities(res.data.items || []);
        setTotalCount(res.data.total || 0);
        setTotalPages(res.data.total_pages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch recruitment activities:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCategory, debouncedSearch, startDate, endDate, sortOrder, page]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleRefresh = async () => {
    await Promise.all([fetchSummary(), fetchActivities(true)]);
  };

  const handleResetFilters = () => {
    setActiveCategory('all');
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setSortOrder('desc');
    setPage(1);
  };

  const getEventVisuals = (act) => {
    const type = (act.activity_type || '').toUpperCase();
    const category = (act.category || '').toLowerCase();

    if (type === 'APPLICATION_ACCEPTED' || type === 'ACCEPTED') {
      return {
        icon: Award,
        bg: 'bg-emerald-100 text-emerald-700 border-emerald-300',
        cardBorder: 'border-l-4 border-l-emerald-500',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };
    }
    if (type === 'APPLICATION_REJECTED' || type === 'REJECTED') {
      return {
        icon: XCircle,
        bg: 'bg-rose-100 text-rose-700 border-rose-300',
        cardBorder: 'border-l-4 border-l-rose-500',
        badgeBg: 'bg-rose-50 text-rose-700 border-rose-200'
      };
    }
    if (type === 'NEXT_ROUND') {
      return {
        icon: TrendingUp,
        bg: 'bg-indigo-100 text-indigo-700 border-indigo-300',
        cardBorder: 'border-l-4 border-l-indigo-500',
        badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200'
      };
    }
    if (type.includes('INTERVIEW_COMPLETED') || type.includes('ASSESSMENT')) {
      return {
        icon: CheckCircle2,
        bg: 'bg-teal-100 text-teal-700 border-teal-300',
        cardBorder: 'border-l-4 border-l-teal-500',
        badgeBg: 'bg-teal-50 text-teal-700 border-teal-200'
      };
    }
    if (type.includes('INTERVIEW')) {
      return {
        icon: Bot,
        bg: 'bg-sky-100 text-sky-700 border-sky-300',
        cardBorder: 'border-l-4 border-l-sky-500',
        badgeBg: 'bg-sky-50 text-sky-700 border-sky-200'
      };
    }
    if (type.includes('APPLICATION')) {
      return {
        icon: Briefcase,
        bg: 'bg-blue-100 text-blue-700 border-blue-300',
        cardBorder: 'border-l-4 border-l-blue-500',
        badgeBg: 'bg-blue-50 text-blue-700 border-blue-200'
      };
    }
    if (type === 'RESUME_DELETED') {
      return {
        icon: Trash2,
        bg: 'bg-slate-100 text-slate-700 border-slate-300',
        cardBorder: 'border-l-4 border-l-slate-400',
        badgeBg: 'bg-slate-50 text-slate-700 border-slate-200'
      };
    }
    if (type === 'RESUME_ANALYZED') {
      return {
        icon: Sparkles,
        bg: 'bg-purple-100 text-purple-700 border-purple-300',
        cardBorder: 'border-l-4 border-l-purple-500',
        badgeBg: 'bg-purple-50 text-purple-700 border-purple-200'
      };
    }
    if (category === 'resume' || type.includes('RESUME')) {
      return {
        icon: FileText,
        bg: 'bg-violet-100 text-violet-700 border-violet-300',
        cardBorder: 'border-l-4 border-l-violet-500',
        badgeBg: 'bg-violet-50 text-violet-700 border-violet-200'
      };
    }
    return {
      icon: Clock,
      bg: 'bg-slate-100 text-slate-700 border-slate-300',
      cardBorder: 'border-l-4 border-l-slate-400',
      badgeBg: 'bg-slate-50 text-slate-700 border-slate-200'
    };
  };

  const formatActivityTime = (isoString) => {
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
    startDate !== '' ||
    endDate !== '' ||
    sortOrder !== 'desc';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Candidate Activity
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Track your recruitment journey, resume updates, job applications, AI interviews and hiring decisions in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm disabled:opacity-50"
            title="Refresh recruitment activity timeline"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-brand-600' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Timeline'}</span>
          </button>
          <Link
            to="/candidate/jobs"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm shadow-brand-500/20"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Browse Jobs</span>
          </Link>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Resumes Uploaded
              </p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {summary.total_resumes_uploaded}
              </h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            Parsed and verified candidate CV profiles
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Jobs Applied
              </p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {summary.total_jobs_applied}
              </h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Submitted applications across hiring companies
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Interviews Completed
              </p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {summary.interviews_completed}
              </h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
            Verified turn-by-turn AI interview sessions
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Applications Accepted
              </p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {summary.applications_accepted}
              </h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Confirmed offers & selected candidate outcomes
          </p>
        </div>
      </div>

      {/* Filter & Category Controls */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm space-y-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Search, Date Range, Sort Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
          {/* Search Input */}
          <div className="relative md:col-span-5">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by company or job position..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                ×
              </button>
            )}
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2 md:col-span-4">
            <div className="relative flex-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-600"
                title="Start Date"
              />
            </div>
            <span className="text-xs text-slate-400">to</span>
            <div className="relative flex-1">
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-600"
                title="End Date"
              />
            </div>
          </div>

          {/* Sort Order Selector */}
          <div className="flex items-center gap-2 md:col-span-3 justify-end">
            <div className="relative w-full">
              <select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-700 bg-white"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg whitespace-nowrap transition-colors font-medium border border-transparent hover:border-rose-200"
                title="Clear all filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Timeline List */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 sm:p-7">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
            <p className="text-xs text-slate-500">Loading recruitment activity events...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-14 px-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
              <Calendar className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {hasActiveFilters ? 'No activities match your filters' : 'No recruitment activities recorded yet'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'Try broadening your search term or adjusting the date range filters.'
                : 'Upload your resume or apply to your first open position to start recording recruitment milestones.'}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              {hasActiveFilters ? (
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Clear Filters
                </button>
              ) : (
                <Link
                  to="/candidate/jobs"
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm"
                >
                  Explore Open Jobs
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="relative pl-4 sm:pl-6 border-l-2 border-slate-200 space-y-6">
            {activities.map((act) => {
              const visuals = getEventVisuals(act);
              const Icon = visuals.icon;
              const relativeTime = getRelativeTime(act.occurred_at || act.created_at);
              const formattedTime = formatActivityTime(act.occurred_at || act.created_at);
              const metadata = act.metadata_json || {};

              return (
                <div key={act.id} className="relative group">
                  {/* Timeline Node Icon */}
                  <div
                    className={`absolute -left-[29px] sm:-left-[37px] top-1.5 w-7 h-7 rounded-full border-2 flex items-center justify-center shadow-xs transition-transform group-hover:scale-110 ${visuals.bg}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  {/* Activity Card */}
                  <div
                    className={`bg-slate-50/70 hover:bg-white border border-slate-200 rounded-xl p-4 sm:p-5 transition-all hover:shadow-md ${visuals.cardBorder}`}
                  >
                    {/* Top Row: Title, Badges, Timestamp */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                          {act.activity_title}
                        </h4>
                        {act.status_badge && (
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider ${visuals.badgeBg}`}
                          >
                            {act.status_badge}
                          </span>
                        )}
                        {act.application_id && (
                          <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-200 text-slate-700 font-semibold" title={`Application ID: ${act.application_id}`}>
                            {act.application_id.startsWith('APP-')
                              ? act.application_id
                              : `APP-${act.application_id.substring(0, 8).toUpperCase()}`}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-slate-400 text-xs">
                        {relativeTime && (
                          <span className="font-semibold text-slate-600 text-[11px]">
                            {relativeTime}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {formattedTime}
                        </span>
                      </div>
                    </div>

                    {/* Context Row: Company & Position */}
                    {(act.company_name || act.job_title) && (
                      <div className="flex items-center gap-3 text-xs text-slate-600 font-medium mb-2 flex-wrap">
                        {act.company_name && (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold text-slate-800">{act.company_name}</span>
                          </div>
                        )}
                        {act.company_name && act.job_title && (
                          <span className="text-slate-300">•</span>
                        )}
                        {act.job_title && (
                          <div className="flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-slate-700">{act.job_title}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Description */}
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {act.activity_description}
                    </p>

                    {/* Metadata Chips (if applicable) */}
                    {(metadata.overall_score !== undefined ||
                      metadata.decision ||
                      metadata.file_name ||
                      metadata.interview_score !== undefined) && (
                      <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center gap-2 flex-wrap">
                        {metadata.file_name && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-white border border-slate-200 text-slate-600">
                            <FileText className="w-3 h-3 text-slate-400" />
                            {metadata.file_name}
                          </span>
                        )}
                        {metadata.overall_score !== undefined && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                            <Award className="w-3 h-3 text-emerald-600" />
                            Score: {metadata.overall_score}%
                          </span>
                        )}
                        {metadata.decision && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-slate-100 border border-slate-200 text-slate-700 font-medium capitalize">
                            Decision: {metadata.decision}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="mt-8 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700">{(page - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-slate-700">{Math.min(page * pageSize, totalCount)}</span> of{' '}
              <span className="font-semibold text-slate-700">{totalCount}</span> recruitment activities
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
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
                        <span className="px-1 text-slate-400 text-xs">...</span>
                      )}
                      <button
                        onClick={() => setPage(p)}
                        className={`min-w-[28px] h-7 text-xs rounded-lg font-semibold transition-colors ${
                          page === p
                            ? 'bg-brand-600 text-white'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
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
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
