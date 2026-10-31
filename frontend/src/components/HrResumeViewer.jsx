import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertCircle,
  Loader2,
  ExternalLink,
  User,
  Briefcase,
  Hash,
  Calendar,
  FileCheck2
} from 'lucide-react';
import api from '../services/api';

export default function HrResumeViewer({
  isOpen,
  onClose,
  applicationId,
  candidateName = '',
  candidateId = '',
  jobTitle = ''
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const blobUrlRef = useRef(null);

  // Clean up object URLs
  const cleanupBlob = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanupBlob();
    };
  }, []);

  // Fetch resume metadata and load PDF content
  useEffect(() => {
    if (!isOpen || !applicationId) {
      cleanupBlob();
      setBlobUrl(null);
      setMeta(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);
    setZoom(100);
    setCurrentPage(1);

    const loadResume = async () => {
      try {
        // 1. Fetch resume application metadata
        const metaRes = await api.get(`/hr/applications/${applicationId}/resume`);
        if (!isMounted) return;
        setMeta(metaRes.data);

        const resume = metaRes.data.resume;
        if (!resume) {
          throw new Error('No resume document found for this application.');
        }

        // 2. Fetch the PDF binary via stream endpoint with current HR auth token
        const streamUrl = resume.stream_url || `/hr/applications/${applicationId}/resume/file`;
        const fileRes = await api.get(streamUrl, {
          responseType: 'blob'
        });
        if (!isMounted) return;

        cleanupBlob();
        const pdfBlob = new Blob([fileRes.data], { type: 'application/pdf' });
        const newUrl = URL.createObjectURL(pdfBlob);
        blobUrlRef.current = newUrl;
        setBlobUrl(newUrl);

        // Approximate total pages (standard single or dual page resume default)
        setTotalPages(1);
      } catch (err) {
        if (!isMounted) return;
        console.error('Error loading resume:', err);
        const detail = err.response?.data?.detail;
        if (err.response?.status === 404) {
          setError(detail || 'Resume Not Available: No resume document has been uploaded for this candidate application.');
        } else if (err.response?.status === 403) {
          setError('Access Denied: You do not have permission to view this application resume.');
        } else {
          setError(detail || err.message || 'Unable to retrieve resume file. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadResume();

    return () => {
      isMounted = false;
    };
  }, [isOpen, applicationId]);

  // Handle ESC key to exit fullscreen or close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, onClose]);

  if (!isOpen) return null;

  // Zoom handlers
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 20, 220));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 20, 60));
  const handleResetZoom = () => setZoom(100);

  // Page handlers
  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));

  // Download Handler
  const handleDownload = async () => {
    if (!meta?.resume) return;
    setDownloading(true);
    try {
      if (blobUrl) {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = meta.resume.file_name || 'candidate_resume.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const res = await api.get(`/hr/applications/${applicationId}/resume/file?download=true`, {
          responseType: 'blob'
        });
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = meta.resume.file_name || 'candidate_resume.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download resume document.');
    } finally {
      setDownloading(false);
    }
  };

  const displayName = meta?.candidate_name || candidateName || 'Candidate';
  const displayJob = meta?.job_title || jobTitle || 'Position';
  const displayRef = meta?.application_reference || (applicationId ? `APP-${applicationId.slice(0, 8).toUpperCase()}` : 'APP-REF');
  const displayCandId = meta?.candidate_id || candidateId || '';
  const uploadDate = meta?.resume?.uploaded_at ? new Date(meta.resume.uploaded_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) : 'Recorded in system';

  const fileSizeKb = meta?.resume?.file_size ? `${Math.round(meta.resume.file_size / 1024)} KB` : '';

  // Constructed iframe source with zoom and page parameters
  const iframeSrc = blobUrl ? `${blobUrl}#page=${currentPage}&zoom=${zoom}` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`bg-slate-900 border border-slate-800 shadow-2xl flex flex-col transition-all duration-200 overflow-hidden ${
          isFullscreen
            ? 'fixed inset-0 w-screen h-screen rounded-none z-50'
            : 'w-full max-w-6xl h-[92vh] rounded-3xl'
        }`}
      >
        {/* ========================================================================= */}
        {/* 1. TOP HEADER: Candidate & Application Metadata */}
        {/* ========================================================================= */}
        <div className="p-4 sm:px-6 bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-850 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
              <FileText className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-tight truncate">
                  {displayName}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 uppercase tracking-wider">
                  Verified Candidate Resume
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1 text-slate-300 font-medium">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  {displayJob}
                </span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1 font-mono text-[11px] text-purple-300">
                  <Hash className="w-3 h-3 text-purple-400" />
                  {displayRef}
                </span>
                {meta?.resume?.file_name && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="truncate max-w-[200px] text-slate-400" title={meta.resume.file_name}>
                      {meta.resume.file_name} {fileSizeKb && `(${fileSizeKb})`}
                    </span>
                  </>
                )}
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1 text-slate-400 text-[11px]">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  Uploaded: {uploadDate}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Header Actions: Fullscreen & Close */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors border border-transparent hover:border-slate-700"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-rose-500/20 hover:border-rose-500/30 transition-colors border border-transparent"
              title="Close Viewer (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. VIEWER TOOLBAR: Zoom, Page Controls, Download */}
        {/* ========================================================================= */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl px-2 py-1 shadow-sm">
            <button
              onClick={handleZoomOut}
              disabled={loading || !!error || zoom <= 60}
              className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-40 hover:bg-slate-800 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-semibold text-indigo-300 px-1 min-w-[42px] text-center">
              {zoom}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={loading || !!error || zoom >= 220}
              className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-40 hover:bg-slate-800 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-3 bg-slate-700 mx-0.5" />
            <button
              onClick={handleResetZoom}
              disabled={loading || !!error || zoom === 100}
              className="px-1.5 py-0.5 rounded text-[10px] text-slate-400 hover:text-white disabled:opacity-40 hover:bg-slate-800 transition-colors flex items-center gap-1"
              title="Fit to Default"
            >
              <RotateCcw className="w-3 h-3" />
              Fit
            </button>
          </div>

          {/* Page Indicator Controls */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1 text-[11px] text-slate-400">
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1 || loading || !!error}
              className="p-0.5 rounded hover:text-white disabled:opacity-30 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span>
              Page <span className="text-white font-bold">{currentPage}</span> of <span className="text-white font-bold">{totalPages}</span>
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage >= totalPages || loading || !!error}
              className="p-0.5 rounded hover:text-white disabled:opacity-30 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Download Action */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={loading || !!error || downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/90 hover:bg-purple-600 active:bg-purple-700 disabled:opacity-50 text-white font-medium text-xs shadow-lg shadow-purple-600/20 transition-all border border-purple-500/40"
              title="Download Resume PDF"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Resume</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. DOCUMENT PREVIEW BODY */}
        {/* ========================================================================= */}
        <div className="flex-1 bg-slate-950 p-2 sm:p-4 overflow-auto flex items-center justify-center relative">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-400 py-20">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                <FileText className="w-5 h-5 text-indigo-400 absolute inset-0 m-auto" />
              </div>
              <p className="text-sm font-semibold text-slate-300">Retrieving secure candidate resume...</p>
              <p className="text-xs text-slate-500">Decrypting document snapshot from storage repository</p>
            </div>
          )}

          {!loading && error && (
            <div className="max-w-md w-full p-6 bg-slate-900/90 border border-rose-500/30 rounded-2xl text-center space-y-3 shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">Document Not Available</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {error}
              </p>
              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 transition-colors"
                >
                  Close Viewer
                </button>
              </div>
            </div>
          )}

          {!loading && !error && blobUrl && (
            <div
              className="w-full h-full flex items-center justify-center transition-transform duration-150 origin-top"
              style={{
                transform: zoom !== 100 ? `scale(${zoom / 100})` : 'none',
                transformOrigin: 'top center'
              }}
            >
              <object
                data={iframeSrc}
                type="application/pdf"
                className="w-full h-full rounded-xl bg-white shadow-2xl border border-slate-800"
              >
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400 bg-slate-900 rounded-xl">
                  <FileCheck2 className="w-12 h-12 text-indigo-400 mb-3" />
                  <h4 className="text-base font-bold text-white mb-1">Preview Ready</h4>
                  <p className="text-xs text-slate-400 max-w-sm mb-4">
                    Your browser does not support inline PDF object rendering. You can view or download the resume directly.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg"
                    >
                      <Download className="w-4 h-4" /> Download PDF
                    </button>
                    <a
                      href={blobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                    >
                      <ExternalLink className="w-4 h-4" /> Open in New Tab
                    </a>
                  </div>
                </div>
              </object>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 4. FOOTER STATUS BAR */}
        {/* ========================================================================= */}
        <div className="px-6 py-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-slate-300">Smart Recruit Enterprise Document Security</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-500">Read-Only Candidate Snapshot</span>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

