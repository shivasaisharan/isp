import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize, RotateCcw,
  Download, ShieldAlert, ShieldCheck, AlertTriangle, Monitor,
  Camera, Mic, Video, Clock, CheckCircle2, XCircle, FileVideo,
  ChevronRight, RefreshCw, Sparkles, UserCheck, AlertOctagon,
  Smartphone, Users, UserX, EyeOff, Rewind, FastForward,
  Image as ImageIcon, HelpCircle, Check, Tag
} from 'lucide-react';
import api from '../services/api';

export default function HrProctoringReviewPlayer({ sessionId, candidateName }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewData, setReviewData] = useState(null);

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedRecordingIndex, setSelectedRecordingIndex] = useState(0);

  // AI Video Analysis State
  const [analyzingVideo, setAnalyzingVideo] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState(null);

  // Filter for events
  const [eventFilter, setEventFilter] = useState('all'); // 'all', 'violations', 'ai_detections', 'disconnections'

  // Evidence Modal
  const [selectedEvidenceEvent, setSelectedEvidenceEvent] = useState(null);

  // Per-Event Classification State
  const [reviewingEventId, setReviewingEventId] = useState(null);
  const [eventReviewStatus, setEventReviewStatus] = useState('genuine_violation');
  const [eventReviewNotes, setEventReviewNotes] = useState('');
  const [savingEventReview, setSavingEventReview] = useState(false);

  // Overall HR Verdict Assessment Form
  const [verdict, setVerdict] = useState('cleared');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [submittingVerdict, setSubmittingVerdict] = useState(false);
  const [verdictMessage, setVerdictMessage] = useState('');

  const fetchReview = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/interviews/${sessionId}/proctoring-review`);
      setReviewData(res.data);
      if (res.data.proctoring_verdict && res.data.proctoring_verdict !== 'pending') {
        setVerdict(res.data.proctoring_verdict);
      }
      if (res.data.reviewer_notes) {
        setReviewerNotes(res.data.reviewer_notes);
      }
      if (res.data.ai_video_analysis) {
        setAnalysisStatus(res.data.ai_video_analysis);
      }
    } catch (err) {
      console.error("Failed to load proctoring review:", err);
      setError(err.response?.data?.detail || 'Failed to load video recording and proctoring events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchReview();
    }
  }, [sessionId]);

  const activeRecording = reviewData?.recordings?.[selectedRecordingIndex] || reviewData?.recordings?.[0];

  // Video Event Handlers
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(e => console.warn("Video play error:", e));
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || activeRecording?.duration_seconds || 0);
  };

  const handleSeek = (e) => {
    const target = parseFloat(e.target.value);
    if (!videoRef.current) return;
    videoRef.current.currentTime = target;
    setCurrentTime(target);
  };

  const seekToTime = (seconds) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, seconds);
    setCurrentTime(seconds);
    if (!isPlaying) {
      videoRef.current.play().catch(() => {});
    }
  };

  const jumpSeconds = (delta) => {
    if (!videoRef.current) return;
    const nextTime = Math.max(0, Math.min(duration || 10000, videoRef.current.currentTime + delta));
    videoRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const changeSpeed = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    videoRef.current.muted = nextMuted;
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen().catch(err => console.error(err));
    }
  };

  const formatSeconds = (sec) => {
    if (!sec || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Trigger AI Video Analysis Pipeline
  const handleTriggerAnalysis = async () => {
    setAnalyzingVideo(true);
    try {
      const res = await api.post(`/interviews/${sessionId}/ai-video-analysis`);
      setAnalysisStatus(res.data);
      await fetchReview();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to start AI video analysis.');
    } finally {
      setAnalyzingVideo(false);
    }
  };

  // Submit Per-Event Classification
  const handleSaveEventReview = async (eventId) => {
    setSavingEventReview(true);
    try {
      const res = await api.post(`/interviews/${sessionId}/proctoring-events/${eventId}/review`, {
        review_status: eventReviewStatus,
        hr_notes: eventReviewNotes
      });
      // Update local events list
      setReviewData(prev => ({
        ...prev,
        events: prev.events.map(ev => ev.id === eventId ? {
          ...ev,
          review_status: res.data.review_status,
          hr_notes: res.data.hr_notes,
          reviewed_at: res.data.reviewed_at
        } : ev)
      }));
      setReviewingEventId(null);
      setEventReviewNotes('');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save event review.');
    } finally {
      setSavingEventReview(false);
    }
  };

  // Submit Overall HR Proctoring Verdict
  const handleVerdictSubmit = async (e) => {
    e.preventDefault();
    setSubmittingVerdict(true);
    setVerdictMessage('');
    try {
      const res = await api.post(`/interviews/${sessionId}/proctoring-verdict`, {
        verdict: verdict,
        reviewer_notes: reviewerNotes
      });
      setVerdictMessage('Proctoring assessment recorded and permanently logged to compliance audit.');
      setReviewData(prev => ({
        ...prev,
        proctoring_verdict: res.data.proctoring_verdict,
        reviewed_at: res.data.reviewed_at
      }));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit proctoring assessment.');
    } finally {
      setSubmittingVerdict(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 rounded-3xl bg-slate-950 border border-slate-800 text-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-400 mx-auto"></div>
        <p className="text-xs text-slate-400">Loading interview recording & proctoring timeline...</p>
      </div>
    );
  }

  if (error || !reviewData) {
    return (
      <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 text-center space-y-2">
        <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
        <h4 className="text-xs font-bold text-white">Proctoring Data Unavailable</h4>
        <p className="text-xs text-slate-400">{error || 'No interview session or recording found.'}</p>
        <button
          type="button"
          onClick={fetchReview}
          className="px-3 py-1 bg-slate-800 text-xs text-slate-200 rounded-lg border border-slate-700 hover:bg-slate-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const events = reviewData.events || [];
  const consent = reviewData.consent;
  const aiAnalysis = reviewData.ai_video_analysis || analysisStatus;

  // Filtered timeline events
  const filteredEvents = events.filter(ev => {
    if (eventFilter === 'violations') return ev.is_security_violation || ev.severity === 'critical';
    if (eventFilter === 'ai_detections') {
      return ['multiple_persons_detected', 'cell_phone_detected', 'candidate_absent', 'looking_down_frequently', 'camera_obstructed'].includes(ev.event_type);
    }
    if (eventFilter === 'disconnections') {
      return ev.event_type.includes('disconnect') || ev.event_type.includes('stopped') || ev.event_type.includes('exit');
    }
    return true;
  });

  const highPriorityCount = events.filter(e => e.severity === 'critical' || e.severity === 'high').length;
  const reviewedCount = events.filter(e => e.review_status && e.review_status !== 'unreviewed').length;
  const unreviewedCount = events.length - reviewedCount;
  const disconnectionCount = events.filter(e => e.event_type.includes('disconnect') || e.event_type.includes('stopped')).length;

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'cell_phone_detected':
        return <Smartphone className="w-4 h-4 text-rose-400" />;
      case 'multiple_persons_detected':
        return <Users className="w-4 h-4 text-rose-400" />;
      case 'candidate_absent':
        return <UserX className="w-4 h-4 text-amber-400" />;
      case 'looking_down_frequently':
        return <EyeOff className="w-4 h-4 text-amber-400" />;
      case 'camera_obstructed':
      case 'webcam_disconnected':
        return <Camera className="w-4 h-4 text-rose-400" />;
      case 'screen_share_stopped':
      case 'fullscreen_exit':
        return <Monitor className="w-4 h-4 text-amber-400" />;
      default:
        return <ShieldAlert className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* =====================================================================
          1. AI PROCTORING & INTEGRITY REVIEW DASHBOARD HEADER
      ====================================================================== */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI Proctoring & Video Inspection
              </span>
              <span className="text-xs text-slate-500 font-mono">Session: {sessionId.slice(0, 8)}...</span>
            </div>
            <h3 className="text-lg font-bold text-white mt-1">
              {candidateName || reviewData.candidate_name}'s Proctored Interview Session
            </h3>
            <p className="text-xs text-slate-400">
              Target Position: <strong className="text-slate-200">{reviewData.job_title}</strong>
            </p>
          </div>

          {/* AI Integrity Status + Re-Run Action Button */}
          <div className="flex flex-wrap items-center gap-2">
            <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
              reviewData.proctoring_verdict === 'cleared'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : reviewData.proctoring_verdict === 'suspicious'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : reviewData.proctoring_verdict === 'flagged_violation'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}>
              {reviewData.proctoring_verdict === 'cleared' ? (
                <ShieldCheck className="w-4 h-4" />
              ) : reviewData.proctoring_verdict === 'flagged_violation' ? (
                <AlertOctagon className="w-4 h-4" />
              ) : (
                <ShieldAlert className="w-4 h-4" />
              )}
              <span className="capitalize">
                {reviewData.proctoring_verdict ? reviewData.proctoring_verdict.replace('_', ' ') : 'Pending Review'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleTriggerAnalysis}
              disabled={analyzingVideo}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
            >
              {analyzingVideo ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing YOLO AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{aiAnalysis ? 'Re-run AI Analysis' : 'Run AI Video Analysis'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* AI Analysis Status Banner */}
        {aiAnalysis && (
          <div className="p-3 rounded-2xl bg-slate-900/90 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                aiAnalysis.integrity_status === 'no_significant_indicators' ? 'bg-emerald-400' :
                aiAnalysis.integrity_status === 'suspicious_activity' ? 'bg-amber-400' : 'bg-rose-400'
              }`} />
              <span className="font-semibold text-slate-200">
                AI Vision Status: <span className="capitalize text-indigo-300 font-bold">{aiAnalysis.integrity_status?.replace(/_/g, ' ')}</span>
              </span>
              <span className="text-slate-500 text-[11px]">
                ({aiAnalysis.analyzed_frames_count} frames sampled via {aiAnalysis.detection_model_name})
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-3">
              <span>Overall Integrity Score: <b className="text-emerald-400">{aiAnalysis.overall_integrity_score}%</b></span>
              <span>Total Detections: <b className="text-amber-400">{aiAnalysis.detected_events_count}</b></span>
            </div>
          </div>
        )}

        {/* 5 Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Recorded Video</span>
            <span className="text-sm font-extrabold text-white">
              {activeRecording ? `${formatSeconds(activeRecording.duration_seconds)}` : '00:00'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Events</span>
            <span className="text-sm font-extrabold text-indigo-400">
              {events.length}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">High Priority</span>
            <span className={`text-sm font-extrabold ${highPriorityCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {highPriorityCount}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Interruptions</span>
            <span className="text-sm font-extrabold text-amber-400">
              {disconnectionCount}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">HR Classifications</span>
            <span className="text-sm font-extrabold text-slate-200">
              {reviewedCount} / {events.length}
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. PRE-FLIGHT HARDWARE VERIFICATION BADGES
      ====================================================================== */}
      {consent && (
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">
            Pre-Flight Hardware Verifications:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 border ${
              consent.webcam_granted ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              <Camera className="w-3.5 h-3.5" />
              <span>Camera {consent.webcam_granted ? 'Verified (Face Confirmed)' : 'Missing'}</span>
            </span>

            <span className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 border ${
              consent.microphone_granted ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              <Mic className="w-3.5 h-3.5" />
              <span>Mic {consent.microphone_granted ? 'Verified' : 'Missing'}</span>
            </span>

            <span className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 border ${
              consent.screen_share_granted ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              <Monitor className="w-3.5 h-3.5" />
              <span>Entire Screen {consent.screen_share_granted ? 'Verified' : 'Missing'}</span>
            </span>

            <span className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 border ${
              consent.recording_consent_agreed ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Proctoring Consent Signed</span>
            </span>
          </div>
        </div>
      )}

      {/* =====================================================================
          3. FULL RECORDING PLAYER & INTERACTIVE PROCTORING TIMELINE GRID
      ====================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Full Original Recording Player (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div
            ref={containerRef}
            className="relative bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl group"
          >
            {activeRecording ? (
              <>
                <video
                  ref={videoRef}
                  src={activeRecording.playback_url || `/api/v1/interviews/${sessionId}/recordings/${activeRecording.id}/stream`}
                  className="w-full aspect-video bg-black object-contain cursor-pointer"
                  onClick={togglePlay}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  playsInline
                />

                {/* Big Center Play Overlay Button */}
                {!isPlaying && (
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-brand-600/90 text-white flex items-center justify-center shadow-xl hover:scale-105 transition-transform"
                  >
                    <Play className="w-8 h-8 ml-1" />
                  </button>
                )}

                {/* Bottom Custom Control Bar */}
                <div className="p-4 bg-gradient-to-t from-slate-950 via-slate-900/90 to-transparent space-y-3">
                  {/* Scrubber Range */}
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      step={0.5}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
                    />
                  </div>

                  {/* Playback Controls Row */}
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={togglePlay}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white"
                        title={isPlaying ? 'Pause' : 'Play'}
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                      </button>

                      {/* -10s and +10s Quick Seek Buttons */}
                      <button
                        type="button"
                        onClick={() => jumpSeconds(-10)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                        title="Seek backward 10s"
                      >
                        <Rewind className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => jumpSeconds(10)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                        title="Seek forward 10s"
                      >
                        <FastForward className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-1.5 ml-1">
                        <button
                          type="button"
                          onClick={toggleMute}
                          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300"
                        >
                          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="w-14 h-1 bg-slate-700 rounded appearance-none accent-indigo-400"
                        />
                      </div>

                      <span className="font-mono text-[11px] text-slate-400 ml-1">
                        {formatSeconds(currentTime)} / {formatSeconds(duration)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Playback Speeds */}
                      {[0.5, 1, 1.25, 1.5, 2].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => changeSpeed(s)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            playbackSpeed === s
                              ? 'bg-brand-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {s}x
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={toggleFullscreen}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 ml-1"
                        title="Fullscreen"
                      >
                        <Maximize className="w-3.5 h-3.5" />
                      </button>

                      <a
                        href={`/api/v1/interviews/${sessionId}/recordings/${activeRecording.id}/download`}
                        download
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                        title="Download Recording File"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="w-full aspect-video flex flex-col items-center justify-center p-8 text-center space-y-2">
                <FileVideo className="w-12 h-12 text-slate-700" />
                <p className="text-xs text-slate-400">No video recording stream recorded for this interview session.</p>
              </div>
            )}
          </div>

          {/* Recording Media File Details & Review Window Helper */}
          {activeRecording && (
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-brand-400" />
                <span>Format: <b className="text-slate-200">{activeRecording.mime_type}</b></span>
                <span className="text-slate-700">•</span>
                <span>Size: <b className="text-slate-200">{(activeRecording.file_size_bytes / (1024 * 1024)).toFixed(2)} MB</b></span>
              </div>
              <span className="text-[11px] text-indigo-400 font-medium">
                Active Seeking: <b>{formatSeconds(currentTime)}</b> (±10s Window)
              </span>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Proctoring Timeline with Evidence Previews (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Proctoring Event Timeline
                </h4>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">{filteredEvents.length} events</span>
            </div>

            <p className="text-[11px] text-slate-400">
              Click any event to <b>seek video</b>. Click image snapshots to inspect <b>AI bounding boxes</b>.
            </p>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[
                { id: 'all', label: 'All Events' },
                { id: 'ai_detections', label: 'AI Detections' },
                { id: 'violations', label: 'Strikes / Violations' },
                { id: 'disconnections', label: 'Disconnections' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setEventFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-colors ${
                    eventFilter === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline Scroll Area */}
          <div className="max-h-[460px] overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
            {filteredEvents.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No events match the selected filter.
              </div>
            ) : (
              filteredEvents.map((ev) => {
                const isNearCurrent = Math.abs(currentTime - ev.timestamp_offset_seconds) < 3.0;
                return (
                  <div
                    key={ev.id}
                    onClick={() => seekToTime(ev.timestamp_offset_seconds)}
                    className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all hover:border-indigo-500/60 ${
                      isNearCurrent
                        ? 'bg-indigo-950/40 border-indigo-500/80 shadow-md shadow-indigo-950/50'
                        : ev.is_security_violation
                        ? 'bg-rose-950/20 border-rose-900/40 hover:bg-rose-950/30'
                        : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {getEventIcon(ev.event_type)}
                          <span className="font-bold text-slate-200 capitalize text-[11px]">
                            {ev.event_type.replace(/_/g, ' ')}
                          </span>

                          {/* Confidence Score Pill */}
                          {ev.confidence_score && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                              {(ev.confidence_score * 100).toFixed(0)}% conf
                            </span>
                          )}

                          {/* HR Review Status Tag */}
                          {ev.review_status && ev.review_status !== 'unreviewed' ? (
                            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 capitalize">
                              {ev.review_status.replace(/_/g, ' ')}
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              Unreviewed
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {ev.description}
                        </p>

                        {/* Evidence Image Thumbnail */}
                        {ev.evidence_image_path && (
                          <div className="pt-1 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvidenceEvent(ev);
                              }}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-500/30 text-[10px] text-indigo-300 font-semibold"
                            >
                              <ImageIcon className="w-3 h-3" />
                              <span>View Annotated AI Snapshot</span>
                            </button>
                          </div>
                        )}

                        {/* Event Review Action Link */}
                        <div className="pt-1 flex items-center gap-3 text-[10px]">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReviewingEventId(ev.id);
                              setEventReviewStatus(ev.review_status || 'genuine_violation');
                              setEventReviewNotes(ev.hr_notes || '');
                            }}
                            className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                          >
                            <Tag className="w-3 h-3" />
                            <span>{ev.review_status && ev.review_status !== 'unreviewed' ? 'Edit Event Classification' : 'Classify Event'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Clickable Timestamp Seek Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          seekToTime(ev.timestamp_offset_seconds);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-[10px] font-mono font-bold text-indigo-300 hover:text-white shrink-0 border border-slate-700 transition-colors"
                        title="Click to seek video"
                      >
                        {formatSeconds(ev.timestamp_offset_seconds)}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          4. PER-EVENT CLASSIFICATION MODAL
      ====================================================================== */}
      {reviewingEventId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-400" />
                <h4 className="text-sm font-bold text-white">Classify Proctoring Event</h4>
              </div>
              <button
                type="button"
                onClick={() => setReviewingEventId(null)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">Assessment Verdict</label>
              <div className="space-y-1.5">
                {[
                  { id: 'genuine_violation', label: 'Genuine Violation', desc: 'Confirmed breach of examination integrity' },
                  { id: 'false_positive', label: 'False Positive', desc: 'AI falsely detected or misclassified normal object' },
                  { id: 'normal_behavior', label: 'Normal Candidate Behavior', desc: 'Candidate was thinking, adjusting chair, etc.' },
                  { id: 'technical_issue', label: 'Technical Issue', desc: 'Hardware or network disconnection resolved' },
                  { id: 'investigating', label: 'Under Investigation', desc: 'Requires further review with senior recruiter' }
                ].map(opt => (
                  <label
                    key={opt.id}
                    className={`p-2.5 rounded-xl border block cursor-pointer transition text-xs ${
                      eventReviewStatus === opt.id
                        ? 'bg-indigo-600/15 border-indigo-500 text-indigo-200'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="event_review_status"
                          value={opt.id}
                          checked={eventReviewStatus === opt.id}
                          onChange={() => setEventReviewStatus(opt.id)}
                          className="accent-indigo-500"
                        />
                        <span className="font-bold text-xs text-white">{opt.label}</span>
                      </div>
                      {eventReviewStatus === opt.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400 pl-5 mt-0.5">{opt.desc}</p>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">HR Recruiter Notes</label>
              <textarea
                rows={2}
                value={eventReviewNotes}
                onChange={(e) => setEventReviewNotes(e.target.value)}
                placeholder="Optional explanation for audit records..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewingEventId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveEventReview(reviewingEventId)}
                disabled={savingEventReview}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-1.5"
              >
                {savingEventReview ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Save Classification</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          5. EVIDENCE SNAPSHOT MODAL (AI BOUNDING BOX VIEW)
      ====================================================================== */}
      {selectedEvidenceEvent && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-slate-900 border border-indigo-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-bold text-white">
                  Annotated AI Evidence Frame ({formatSeconds(selectedEvidenceEvent.timestamp_offset_seconds)})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvidenceEvent(null)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-slate-800 flex items-center justify-center">
              <img
                src={`/api/v1/interviews/${sessionId}/evidence/${selectedEvidenceEvent.evidence_image_path}`}
                alt="AI Evidence Frame"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentNode.innerHTML = '<div class="p-8 text-center text-xs text-slate-400">Evidence frame snapshot loading or unavailable.</div>';
                }}
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white capitalize">{selectedEvidenceEvent.event_type.replace(/_/g, ' ')}</span>
                <span className="font-mono text-indigo-400">Confidence: {(selectedEvidenceEvent.confidence_score * 100).toFixed(1)}%</span>
              </div>
              <p className="text-slate-400">{selectedEvidenceEvent.description}</p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  seekToTime(selectedEvidenceEvent.timestamp_offset_seconds);
                  setSelectedEvidenceEvent(null);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Jump Video to This Moment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          6. HUMAN HR PROCTORING VERDICT & OVERALL ASSESSMENT DECISION FORM
      ====================================================================== */}
      <div className="p-6 sm:p-7 rounded-3xl bg-slate-950 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-400" />
            <h4 className="text-sm font-bold text-white">
              Official Recruiter Proctoring Assessment & Integrity Verdict
            </h4>
          </div>
          {reviewData.reviewed_at && (
            <span className="text-[11px] text-slate-500">
              Last Assessed: {new Date(reviewData.reviewed_at).toLocaleDateString()} by {reviewData.reviewer_name || 'HR Recruiter'}
            </span>
          )}
        </div>

        <form onSubmit={handleVerdictSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'cleared', label: 'Cleared', desc: 'No suspicious activity; candidate fully complied with proctoring.', color: 'emerald' },
              { id: 'suspicious', label: 'Suspicious Activity', desc: 'Occasional interruptions observed; human review required.', color: 'amber' },
              { id: 'flagged_violation', label: 'Flagged Violation', desc: 'Severe violation of examination integrity.', color: 'rose' }
            ].map(v => (
              <label
                key={v.id}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all space-y-1 block ${
                  verdict === v.id
                    ? v.color === 'emerald'
                      ? 'bg-emerald-500/10 border-emerald-500/80 text-emerald-300'
                      : v.color === 'amber'
                      ? 'bg-amber-500/10 border-amber-500/80 text-amber-300'
                      : 'bg-rose-500/10 border-rose-500/80 text-rose-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="proctoring_verdict"
                      value={v.id}
                      checked={verdict === v.id}
                      onChange={() => setVerdict(v.id)}
                      className="accent-indigo-500"
                    />
                    <span className="font-bold text-xs text-white">{v.label}</span>
                  </div>
                  {verdict === v.id && <CheckCircle2 className="w-4 h-4" />}
                </div>
                <p className="text-[10px] leading-relaxed opacity-80 pl-5">
                  {v.desc}
                </p>
              </label>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Recruiter Confidential Assessment Notes
            </label>
            <textarea
              rows={3}
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              placeholder="e.g. Candidate reconnected screen sharing promptly at 00:25; no unauthorized external devices or personnel observed."
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {verdictMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{verdictMessage}</span>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={submittingVerdict}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-40"
            >
              {submittingVerdict ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Recording Verdict...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Proctoring Assessment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
