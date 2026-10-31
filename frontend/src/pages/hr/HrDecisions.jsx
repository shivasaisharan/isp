import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, XCircle, Clock, ShieldCheck, User, Briefcase,
  Search, Filter, RotateCcw, Download, Calendar, ExternalLink,
  ChevronLeft, ChevronRight, X, AlertCircle, Sparkles, FileText,
  Building, CheckSquare, RefreshCw, UserCheck, Users
} from 'lucide-react';
import api from '../../services/api';

export default function HrDecisions() {
  const [decisions, setDecisions] = useState([]);
  const [summary, setSummary] = useState({
    total_decisions: 0,
    total_accepted: 0,
    total_rejected: 0,
    decisions_this_month: 0
  });
  const [reviewers, setReviewers] = useState([]);
  const [loadingReviewers, setLoadingReviewers] = useState(false);
  const [reviewerError, setReviewerError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters state
  const [decisionType, setDecisionType] = useState('all'); // 'all', 'ACCEPTED', 'REJECTED'
  const [candidateSearch, setCandidateSearch] = useState('');
  const [jobTitleSearch, setJobTitleSearch] = useState('');
  const [reviewerFilter, setReviewerFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // View Details Modal State
  const [selectedDecision, setSelectedDecision] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Fetch Summary statistics
  const fetchSummary = async () => {
    try {
      const res = await api.get('/hr/decisions/summary');
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to load summary counts:', err);
    }
  };

  // Fetch Reviewers for dropdown dynamically from database
  const fetchReviewers = async () => {
    try {
      setLoadingReviewers(true);
      setReviewerError('');
      let res;
      try {
        res = await api.get('/hr/reviewers');
      } catch (e) {
        res = await api.get('/hr/decisions/reviewers');
      }
      setReviewers(res.data || []);
    } catch (err) {
      console.error('Failed to load reviewers:', err);
      setReviewerError('Could not retrieve organization HR reviewers.');
    } finally {
      setLoadingReviewers(false);
    }
  };

  // Fetch Decisions with query filters
  const fetchDecisions = async (resetPage = false) => {
    try {
      setLoading(true);
      setError('');
      const currentPage = resetPage ? 1 : page;
      if (resetPage) setPage(1);

      const params = {
        page: currentPage,
        page_size: pageSize,
        sort_order: sortOrder
      };

      if (decisionType !== 'all') params.decision_type = decisionType;
      if (candidateSearch.trim()) params.candidate_search = candidateSearch.trim();
      if (jobTitleSearch.trim()) params.job_title_search = jobTitleSearch.trim();
      if (reviewerFilter !== 'all') params.reviewer_id = reviewerFilter;
      if (startDate) params.start_date = new Date(startDate).toISOString();
      if (endDate) params.end_date = new Date(endDate + 'T23:59:59').toISOString();

      const res = await api.get('/hr/decisions', { params });
      setDecisions(res.data.items || []);
      setTotalPages(res.data.total_pages || 1);
      setTotalCount(res.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch hiring decisions:', err);
      setError(err.response?.data?.detail || 'Failed to load hiring decision records from server.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchSummary();
    fetchReviewers();
  }, []);

  // Fetch when filters or page change
  useEffect(() => {
    fetchDecisions();
  }, [page, decisionType, sortOrder]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDecisions(true);
  };

  const handleResetFilters = () => {
    setDecisionType('all');
    setCandidateSearch('');
    setJobTitleSearch('');
    setReviewerFilter('all');
    setStartDate('');
    setEndDate('');
    setSortOrder('desc');
    setPage(1);
    setTimeout(() => {
      fetchDecisions(true);
      fetchSummary();
    }, 50);
  };

  const activeReviewerObj = useMemo(() => {
    if (reviewerFilter === 'all') return null;
    return reviewers.find(r => r.id === reviewerFilter) || null;
  }, [reviewerFilter, reviewers]);

  const hasActiveFilters = Boolean(
    decisionType !== 'all' ||
    candidateSearch.trim() ||
    jobTitleSearch.trim() ||
    reviewerFilter !== 'all' ||
    startDate ||
    endDate
  );

  const handleOpenDetails = async (decisionId) => {
    try {
      setModalLoading(true);
      setSelectedDecision(null);
      const res = await api.get(`/hr/decisions/${decisionId}`);
      setSelectedDecision(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not load decision details.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await api.get('/hr/decisions/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `hiring_decisions_audit_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to export decisions CSV.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Compliance & Audit Trail
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              Immutable Records
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Confirmed Hiring Decisions
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Official chronological history of all candidate acceptance and rejection determinations made by authorized HR reviewers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchDecisions(); fetchSummary(); fetchReviewers(); }}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Refresh decision records and reviewers"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={handleExportCsv}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export Audit CSV
          </button>
        </div>
      </div>

      {/* =========================================================================
          SECTION 1: SUMMARY CARDS
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Decisions */}
        <div className="bg-slate-950 border border-slate-800/90 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Decisions</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-white">{summary.total_decisions}</span>
            <span className="text-[11px] block text-slate-500 mt-0.5">Historical human audit events</span>
          </div>
        </div>

        {/* Total Accepted */}
        <div className="bg-slate-950 border border-emerald-950/40 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Total Accepted</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-emerald-400">{summary.total_accepted}</span>
            <span className="text-[11px] block text-emerald-500/70 mt-0.5">Candidates marked for hire</span>
          </div>
        </div>

        {/* Total Rejected */}
        <div className="bg-slate-950 border border-rose-950/40 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Total Rejected</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-rose-400">{summary.total_rejected}</span>
            <span className="text-[11px] block text-rose-500/70 mt-0.5">Applications declined by HR</span>
          </div>
        </div>

        {/* Decisions This Month */}
        <div className="bg-slate-950 border border-slate-800/90 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">This Month</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-amber-400">{summary.decisions_this_month}</span>
            <span className="text-[11px] block text-slate-500 mt-0.5">Determinations logged in current cycle</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: SEARCH & FILTERS
          ========================================================================= */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        {/* Decision Type Buttons & Sorting */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              Outcome:
            </span>
            <button
              onClick={() => { setDecisionType('all'); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                decisionType === 'all'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              All Decisions ({summary.total_decisions})
            </button>
            <button
              onClick={() => { setDecisionType('ACCEPTED'); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                decisionType === 'ACCEPTED'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-900 text-emerald-400/80 hover:text-emerald-300 border border-slate-800'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              Accepted ({summary.total_accepted})
            </button>
            <button
              onClick={() => { setDecisionType('REJECTED'); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                decisionType === 'REJECTED'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-slate-900 text-rose-400/80 hover:text-rose-300 border border-slate-800'
              }`}
            >
              <XCircle className="w-3 h-3" />
              Rejected ({summary.total_rejected})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-400">Sort by:</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Multi-criteria Search Form */}
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Candidate
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
                placeholder="Name or email..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Job Position
            </label>
            <div className="relative">
              <Briefcase className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                value={jobTitleSearch}
                onChange={(e) => setJobTitleSearch(e.target.value)}
                placeholder="Title or department..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Dynamic HR Reviewer Dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>HR Reviewer</span>
              {loadingReviewers && (
                <span className="text-[10px] text-indigo-400 font-normal animate-pulse">Loading reviewers...</span>
              )}
            </label>
            <div className="relative">
              <select
                value={reviewerFilter}
                onChange={(e) => {
                  setReviewerFilter(e.target.value);
                }}
                className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors ${
                  reviewerFilter !== 'all' ? 'border-indigo-500/60 bg-indigo-950/20 text-white' : 'border-slate-800'
                }`}
              >
                <option value="all">All Reviewers (Full Team)</option>
                {loadingReviewers ? (
                  <option disabled value="">Loading authorized HR reviewers...</option>
                ) : reviewerError ? (
                  <option disabled value="">Error loading reviewers</option>
                ) : reviewers.length === 0 ? (
                  <option disabled value="">No HR reviewers found for this organization</option>
                ) : (
                  reviewers.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} – {r.designation || 'HR Recruiter'} ({r.email})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Search className="w-3.5 h-3.5" />
              Apply Filters
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs transition-colors"
              title="Reset all filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Date Filter & Active Filters Pill Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-400 border-t border-slate-900">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" /> Date Range:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
              />
              <span>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
              />
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="text-[11px] text-indigo-400 hover:underline ml-1"
                >
                  Clear Dates
                </button>
              )}
            </div>
          </div>

          {/* Active Reviewer Filter Indicator */}
          {activeReviewerObj && (
            <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-xl text-xs text-indigo-300">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                Filtered by: <strong>{activeReviewerObj.name} – {activeReviewerObj.designation}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setReviewerFilter('all');
                  setPage(1);
                  setTimeout(() => fetchDecisions(true), 50);
                }}
                className="p-0.5 rounded-md hover:bg-indigo-500/20 text-indigo-300 hover:text-white transition-colors"
                title="Remove reviewer filter"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          SECTION 3: DECISION HISTORY TABLE
          ========================================================================= */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
            <p className="text-xs text-slate-400 animate-pulse">Loading verified decision audit history...</p>
          </div>
        ) : error ? (
          <div className="text-center py-16 px-4 space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <p className="text-xs font-semibold text-rose-300">{error}</p>
            <button
              onClick={() => fetchDecisions()}
              className="px-4 py-2 bg-slate-900 border border-slate-700 text-xs font-bold text-slate-200 rounded-xl hover:text-white"
            >
              Retry
            </button>
          </div>
        ) : decisions.length === 0 ? (
          <div className="text-center py-20 px-4 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
              <CheckSquare className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">No hiring decisions found.</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {hasActiveFilters
                ? 'No decision records match your current search filters and reviewer selection.'
                : 'Accepted and rejected candidates will appear here automatically whenever authorized HR recruiters finalize hiring decisions in the Applicant Pool or Candidate Scorecard.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500"
              >
                Clear All Search Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Candidate</th>
                  <th className="py-3.5 px-4">Job Position</th>
                  <th className="py-3.5 px-4">Decision</th>
                  <th className="py-3.5 px-4">HR Reviewer</th>
                  <th className="py-3.5 px-4">Decision Date</th>
                  <th className="py-3.5 px-4">Decision Notes</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {decisions.map((d) => {
                  const isAccepted = d.decision === 'ACCEPTED';
                  return (
                    <tr key={d.id} className="hover:bg-slate-900/40 transition-colors">
                      {/* Candidate */}
                      <td className="py-4 px-5">
                        <div className="font-bold text-white leading-snug">{d.candidate_name}</div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="font-mono text-indigo-400 text-[10px]">{d.candidate_alias}</span>
                          {d.candidate_email && (
                            <>
                              <span>•</span>
                              <span>{d.candidate_email}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Job Position */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-200">{d.job_title}</div>
                        <div className="text-[11px] text-slate-500">{d.job_department}</div>
                      </td>

                      {/* Decision Badge */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {isAccepted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            ACCEPTED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3.5 h-3.5" />
                            REJECTED
                          </span>
                        )}
                      </td>

                      {/* HR Reviewer */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                          <User className="w-3 h-3 text-slate-500" />
                          {d.reviewer_name}
                        </div>
                        {d.reviewer_email && (
                          <div className="text-[11px] text-slate-500">{d.reviewer_email}</div>
                        )}
                      </td>

                      {/* Decision Date */}
                      <td className="py-4 px-4 whitespace-nowrap text-slate-300">
                        <div className="font-medium">
                          {new Date(d.decided_at).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(d.decided_at).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>

                      {/* Decision Notes */}
                      <td className="py-4 px-4 max-w-xs">
                        <p className="text-slate-300 italic text-[11px] line-clamp-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                          "{d.decision_notes}"
                        </p>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleOpenDetails(d.id)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 hover:text-white rounded-xl transition-all shadow-sm"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {decisions.length > 0 && (
          <div className="p-4 border-t border-slate-800 bg-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div>
              Showing <span className="font-bold text-white">{decisions.length}</span> of{' '}
              <span className="font-bold text-white">{totalCount}</span> total confirmed decisions
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 flex items-center gap-1 font-semibold"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <span className="text-[11px] px-2 font-mono">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 flex items-center gap-1 font-semibold"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          SECTION 4: VIEW DETAILS AUDIT MODAL
          ========================================================================= */}
      {selectedDecision && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl text-slate-200 animate-fadeIn space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Official Audit Record
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">ID: {selectedDecision.id.slice(0, 8)}...</span>
                </div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  Hiring Decision Details
                </h2>
              </div>

              <button
                onClick={() => setSelectedDecision(null)}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Decision Status Banner */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              selectedDecision.decision === 'ACCEPTED'
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
            }`}>
              <div className="flex items-center gap-3">
                {selectedDecision.decision === 'ACCEPTED' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-400" />
                )}
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider block">
                    Final Determination: {selectedDecision.decision}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Status transitioned from <span className="font-mono text-slate-300">{selectedDecision.previous_status || 'Under Review'}</span> to <span className="font-mono text-slate-200">{selectedDecision.new_status}</span>
                  </span>
                </div>
              </div>

              <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-700/60">
                {selectedDecision.decision}
              </span>
            </div>

            {/* Candidate & Job Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Candidate Information
                </span>
                <div className="font-bold text-white text-sm">{selectedDecision.candidate_name}</div>
                <div className="text-xs text-slate-400">{selectedDecision.candidate_email}</div>
                <div className="text-[11px] font-mono text-indigo-400">{selectedDecision.candidate_alias}</div>
                <div className="text-[10px] text-slate-500 pt-1">
                  Candidate ID: <span className="font-mono">{selectedDecision.candidate_id}</span>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Position & Reviewer
                </span>
                <div className="font-bold text-white text-sm">{selectedDecision.job_title}</div>
                <div className="text-xs text-slate-400">{selectedDecision.job_department}</div>
                <div className="text-xs text-slate-300 flex items-center gap-1.5 pt-1">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  Reviewed by: <strong>{selectedDecision.reviewer_name}</strong>
                </div>
                <div className="text-[10px] text-slate-500">
                  Decided on: {new Date(selectedDecision.decided_at).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Assessment Scores Summary */}
            <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-2xl space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Associated Assessment Metrics
              </span>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-lg font-bold text-white">
                    {selectedDecision.resume_match_score ? `${selectedDecision.resume_match_score}%` : 'Not Available'}
                  </span>
                  <span className="text-[10px] block text-slate-400 uppercase mt-0.5">Resume Match</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-lg font-bold text-indigo-400">
                    {selectedDecision.interview_score !== null ? `${selectedDecision.interview_score}%` : 'Not Available'}
                  </span>
                  <span className="text-[10px] block text-slate-400 uppercase mt-0.5">Interview Score</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-lg font-bold text-emerald-400">
                    {selectedDecision.overall_fit_score ? `${selectedDecision.overall_fit_score}%` : 'Not Available'}
                  </span>
                  <span className="text-[10px] block text-slate-400 uppercase mt-0.5">Overall Fit</span>
                </div>
              </div>
            </div>

            {/* HR Decision Notes */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Mandatory HR Recruiter Rationale & Notes
              </span>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans">
                "{selectedDecision.decision_notes}"
              </div>
            </div>

            {/* Footer Modal Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <Link
                to={`/hr/applications/${selectedDecision.application_id}/scorecard`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                <FileText className="w-3.5 h-3.5" />
                Inspect Full Evaluation Scorecard
              </Link>

              <button
                onClick={() => setSelectedDecision(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 rounded-xl hover:text-white transition-colors"
              >
                Close Audit Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
