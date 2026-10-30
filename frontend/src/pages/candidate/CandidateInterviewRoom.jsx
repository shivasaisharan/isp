import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, Volume2, Bot, Clock, ArrowRight, Loader2,
  Shield, ShieldAlert, ShieldCheck, AlertTriangle, Maximize2, Minimize2,
  XCircle, Lock, Info, ExternalLink
} from 'lucide-react';
import api from '../../services/api';

export default function CandidateInterviewRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // Session & Question State
  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastFeedback, setLastFeedback] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [sttError, setSttError] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 mins
  const [loading, setLoading] = useState(true);

  // =========================================================================
  // SECURE FULL-SCREEN INTERVIEW & THREE-STRIKE STATE
  // =========================================================================
  const [hasStartedSecureMode, setHasStartedSecureMode] = useState(false);
  const [micGranted, setMicGranted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [maxViolations] = useState(3);
  const [isTerminated, setIsTerminated] = useState(false);
  const [terminationReason, setTerminationReason] = useState('');
  const [activeWarning, setActiveWarning] = useState(null); // { violationNumber, title, message }
  const [fullscreenError, setFullscreenError] = useState('');

  // Audio & Speech Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const liveTranscriptRef = useRef('');

  // Monitoring Deduplication Ref
  const lastViolationTimeRef = useRef(0);
  const isTerminatedRef = useRef(false);
  isTerminatedRef.current = isTerminated;

  // Load session & live security status
  const fetchSession = async () => {
    try {
      const res = await api.get(`/interviews/${sessionId}`);
      setSession(res.data);

      if (res.data.status === 'completed') {
        const repRes = await api.get('/reports/candidate/all');
        const match = repRes.data.find(r => r.session_id === sessionId);
        if (match) {
          navigate(`/candidate/results/${match.id}`);
          return;
        }
      }

      if (res.data.status === 'terminated_flagged') {
        setIsTerminated(true);
        setViolationCount(3);
        setTerminationReason(res.data.termination_reason || 'Interview terminated and flagged for HR review.');
        return;
      }

      // Fetch server security status to recover state on refresh
      try {
        const secRes = await api.get(`/interviews/${sessionId}/security-status`);
        setViolationCount(secRes.data.violation_count);
        if (secRes.data.is_terminated) {
          setIsTerminated(true);
          setTerminationReason(secRes.data.termination_reason);
        }
      } catch (e) {
        console.warn("Could not retrieve initial security status:", e);
      }

      setCurrentQuestion(res.data.current_question);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();

    // Timer countdown
    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearInterval(timer);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [sessionId]);

  // Request Microphone Check on Consent Screen
  const handleCheckMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setMicGranted(true);
      setFullscreenError('');
    } catch (err) {
      setFullscreenError('Microphone permission is required to conduct the interview. Please allow mic access in your browser settings.');
    }
  };

  // Enter Full-Screen Mode and Start Secure Session
  const handleEnterSecureInterview = async () => {
    setFullscreenError('');
    if (!micGranted) {
      await handleCheckMicrophone();
    }

    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }

      setIsFullscreen(true);
      setHasStartedSecureMode(true);

      // Play introductory question audio once entered
      if (currentQuestion) {
        speakText(currentQuestion.question_text);
      }
    } catch (err) {
      console.error("Full-screen request failed:", err);
      setFullscreenError(
        "Could not enter browser full-screen mode automatically. Please click the button again or press F11 / Fullscreen in your browser."
      );
    }
  };

  // =========================================================================
  // DEDUPLICATED THREE-STRIKE VIOLATION ENGINE
  // =========================================================================
  const triggerViolation = useCallback(async (type, description) => {
    if (!hasStartedSecureMode || isTerminatedRef.current) return;

    const now = Date.now();
    // 3000ms deduplication window: prevents tandem blur + visibilitychange firing twice
    if (now - lastViolationTimeRef.current < 3000) {
      return;
    }
    lastViolationTimeRef.current = now;

    try {
      const res = await api.post(`/interviews/${sessionId}/violations`, {
        violation_type: type,
        description: description,
        metadata: { client_timestamp: new Date().toISOString() }
      });

      const newCount = res.data.violation_count;
      setViolationCount(newCount);

      if (res.data.is_terminated || newCount >= 3) {
        setIsTerminated(true);
        setTerminationReason("You have exceeded the permitted number of interview environment violations (3/3 strikes). Your interview has been terminated and flagged for HR review.");
        setActiveWarning({
          level: 3,
          title: "Interview Terminated & Flagged",
          message: "You have exceeded the permitted number of interview environment violations. Your interview has been safely recorded and submitted to human HR recruiters for review."
        });
        if (isListening) stopRecording();
      } else if (newCount === 1) {
        setActiveWarning({
          level: 1,
          title: "Interview Security Warning (1 of 3)",
          message: "You have exited the secure interview environment or switched windows. This activity has been recorded. You have 2 remaining chances before termination."
        });
      } else if (newCount === 2) {
        setActiveWarning({
          level: 2,
          title: "Final Interview Warning (2 of 3)",
          message: "This is your second security violation. One more confirmed interruption will immediately terminate your interview and flag it for HR review."
        });
      }
    } catch (err) {
      console.error("Violation sync error:", err);
    }
  }, [hasStartedSecureMode, sessionId, isListening]);

  // Browser Event Listeners
  useEffect(() => {
    if (!hasStartedSecureMode || isTerminated) return;

    // A. Fullscreen Exit
    const handleFullscreenChange = () => {
      const isCurrentlyFs = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFs);
      if (!isCurrentlyFs && !isTerminatedRef.current) {
        triggerViolation("fullscreen_exit", "Candidate exited browser full-screen mode.");
      }
    };

    // B. Tab Switching / Document Visibility
    const handleVisibilityChange = () => {
      if (document.hidden && !isTerminatedRef.current) {
        triggerViolation("tab_switched", "Candidate switched tabs or minimized the interview window.");
      }
    };

    // C. Window Blur (Focus Lost)
    const handleWindowBlur = () => {
      if (!isTerminatedRef.current) {
        triggerViolation("focus_lost", "Interview window lost focus.");
      }
    };

    // D. Prevent Accidental Page Refresh / Exit
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Leaving this page may register an interview violation. Are you sure?";
      return e.returnValue;
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasStartedSecureMode, isTerminated, triggerViolation]);

  // Re-engage Full-Screen and Dismiss Non-Fatal Warnings
  const handleReturnToInterview = async () => {
    try {
      const elem = document.documentElement;
      if (!document.fullscreenElement) {
        if (elem.requestFullscreen) await elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) await elem.webkitRequestFullscreen();
      }
      setIsFullscreen(true);
      await api.post(`/interviews/${sessionId}/resume-secure-mode`);
    } catch (err) {
      console.warn("Fullscreen re-entry notice:", err);
    } finally {
      setActiveWarning(null);
    }
  };

  // Web Speech TTS
  const speakText = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // Enterprise Dual Speech-to-Text Pipeline (Faster-Whisper)
  const startRecording = async () => {
    if (isTerminated) return;
    setSttError('');
    liveTranscriptRef.current = '';

    // Live Streaming Speech for instant visual feedback
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          let currentFinal = '';
          for (let i = 0; i < event.results.length; i++) {
            currentFinal += event.results[i][0].transcript + ' ';
          }
          if (currentFinal.trim()) {
            liveTranscriptRef.current = currentFinal.trim();
            setAnswerText(currentFinal.trim());
          }
        };
        recognition.onerror = () => {};
        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {}
    }

    // MediaRecorder Raw Audio Buffer for Faster-Whisper
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');
      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const blobType = mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
        if (audioBlob.size > 500) {
          await transcribeWithWhisper(audioBlob);
        } else if (liveTranscriptRef.current) {
          setAnswerText(liveTranscriptRef.current);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsListening(true);
    } catch (err) {
      console.warn("MediaRecorder mic access error:", err);
      if (recognitionRef.current) {
        setIsListening(true);
      } else {
        setSttError("Microphone access was denied. Please verify browser permissions.");
      }
    }
  };

  const stopRecording = () => {
    setIsListening(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
  };

  const toggleListening = () => {
    if (isTerminated) return;
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const transcribeWithWhisper = async (audioBlob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'candidate_voice.webm');
      const res = await api.post('/interviews/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.transcript && res.data.transcript.trim()) {
        setAnswerText(res.data.transcript.trim());
      } else if (liveTranscriptRef.current) {
        setAnswerText(liveTranscriptRef.current);
      }
    } catch (err) {
      console.warn("Whisper refinement notice:", err);
      if (liveTranscriptRef.current) {
        setAnswerText(liveTranscriptRef.current);
      }
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answerText.trim() || !currentQuestion || isTerminated) return;
    setSubmitting(true);
    setLastFeedback(null);

    try {
      const res = await api.post('/interviews/answer', {
        session_id: sessionId,
        question_id: currentQuestion.id,
        answer: answerText
      });

      setAnswerText('');
      if (isListening) stopRecording();

      if (res.data.is_finished) {
        const finalRes = await api.post(`/interviews/${sessionId}/complete`);
        navigate(`/candidate/results/${finalRes.data.report_id}`);
      } else {
        setLastFeedback({
          score: res.data.evaluated_score,
          feedback: res.data.feedback
        });
        setCurrentQuestion(res.data.next_question);
        speakText(res.data.next_question.question_text);
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Error submitting answer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          <span className="text-sm font-semibold tracking-wide text-slate-300">Initializing Secure Interview Room...</span>
        </div>
      </div>
    );
  }

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // =========================================================================
  // VIEW 1: SECURE INTERVIEW INSTRUCTIONS SCREEN (PRE-ENTRY)
  // =========================================================================
  if (!hasStartedSecureMode && !isTerminated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl space-y-8">
          <div className="text-center space-y-3">
            <div className="inline-flex p-3 rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20 mb-2">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Secure Full-Screen Interview Mode
            </h1>
            <p className="text-sm text-slate-400">
              Welcome to your official technical interview. Please review the proctoring protocols before entering.
            </p>
          </div>

          {fullscreenError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-xs flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{fullscreenError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 flex items-start gap-3.5">
              <Maximize2 className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-white">1. Mandatory Browser Full-Screen Mode</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  The interview operates strictly in full-screen mode to ensure an uninterrupted, focused examination environment.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 flex items-start gap-3.5">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-white">2. Three-Strike Security Policy</h2>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Switching tabs, minimizing the browser, or exiting full-screen will log a security alert. Candidates receive exactly <b>three violation chances</b>. On the 3rd strike, the session terminates and flags for human HR review.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 flex items-start gap-3.5">
              <Mic className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-white">3. Microphone Verification</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Voice answers are transcribed using Faster-Whisper AI. Ensure your microphone is connected and authorized.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
            {!micGranted ? (
              <button
                type="button"
                onClick={handleCheckMicrophone}
                className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl text-sm border border-slate-700 transition-all flex items-center justify-center gap-2"
              >
                <Mic className="w-4 h-4 text-brand-400" />
                <span>Verify Microphone Permission</span>
              </button>
            ) : (
              <div className="w-full py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-xs font-bold flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Microphone Verified & Ready</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleEnterSecureInterview}
              className="w-full py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-2xl text-sm shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Enter Full-Screen & Start Interview</span>
            </button>
          </div>

          <p className="text-[11px] text-center text-slate-500">
            By entering, you confirm agreement to the examination protocols. Security events are transparently audited for HR review.
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: FULL-SCREEN EXAMINATION ROOM
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between select-none">
      {/* 1. PROFESSIONAL SECURE EXAMINATION HEADER */}
      <header className="h-16 px-6 sm:px-10 bg-slate-900/90 border-b border-slate-800/80 backdrop-blur flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-md">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">
              Smart<span className="text-brand-400">Recruit</span> Secure Examination Mode
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Session ID: {sessionId.slice(0, 8)}...</p>
          </div>
        </div>

        {/* Progress & Countdown */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700/60 text-xs font-semibold text-slate-300">
            <Bot className="w-3.5 h-3.5 text-brand-400" />
            <span>Question {(currentQuestion?.question_index ?? 0) + 1} of 5</span>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700/60 text-xs font-bold text-slate-200">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{formatTime(timeLeft)}</span>
          </div>

          {/* Security Status Indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
            violationCount === 0
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : violationCount === 1
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}>
            <Shield className="w-3.5 h-3.5" />
            <span>{3 - violationCount} / 3 Strikes Remaining</span>
          </div>
        </div>
      </header>

      {/* 2. MAIN INTERVIEW EXAMINATION WORKSPACE */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 sm:p-8 flex flex-col justify-center space-y-6">
        {/* Terminal/Flagged Notice if Terminated */}
        {isTerminated ? (
          <div className="p-8 rounded-3xl bg-rose-950/40 border border-rose-800/60 text-center space-y-4">
            <div className="inline-flex p-3 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <XCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-white">Interview Terminated & Flagged for HR Review</h2>
            <p className="text-sm text-rose-200 max-w-lg mx-auto leading-relaxed">
              {terminationReason}
            </p>
            <div className="pt-4 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/candidate/applications')}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs border border-slate-700"
              >
                Return to My Applications
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* AI Question Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-brand-950 via-slate-900 to-indigo-950 border border-slate-800 text-white shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-400 bg-brand-500/10 px-3 py-1 rounded-full border border-brand-500/20">
                  {currentQuestion?.category || 'Technical'} Competency Dimension
                </span>
                <button
                  type="button"
                  onClick={() => speakText(currentQuestion?.question_text || '')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                    isSpeaking
                      ? 'bg-brand-500 text-white border-brand-400'
                      : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{isSpeaking ? 'Speaking...' : 'Repeat Audio'}</span>
                </button>
              </div>
              <h2 className="text-lg sm:text-2xl font-bold leading-relaxed text-slate-100">
                "{currentQuestion?.question_text || 'Loading question...'}"
              </h2>
            </div>

            {/* Previous Turn Feedback */}
            {lastFeedback && (
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-xs flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0"></div>
                <div>
                  <span className="font-bold text-white block">Previous Answer Evaluated ({lastFeedback.score}%)</span>
                  <span>{lastFeedback.feedback}</span>
                </div>
              </div>
            )}

            {/* Candidate Answer Workspace */}
            <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-xl space-y-4">
              {sttError && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>{sttError}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Your Technical Response</label>
                  <span className="text-[10px] font-semibold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20">
                    Faster-Whisper STT
                  </span>
                </div>

                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={isTranscribing || isTerminated}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-600/30'
                      : isTranscribing
                      ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20 cursor-wait'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-3.5 h-3.5" />
                      <span>Stop & Transcribe</span>
                    </>
                  ) : isTranscribing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-400" />
                      <span>Transcribing...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 text-brand-400" />
                      <span>Speak Answer</span>
                    </>
                  )}
                </button>
              </div>

              <textarea
                rows={6}
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                disabled={isTerminated}
                placeholder="Type or speak your answer in detail. Emphasize architecture trade-offs, code principles, and real production metrics..."
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-brand-500 focus:outline-none leading-relaxed resize-none"
              />

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500">
                  {answerText.split(/\s+/).filter(Boolean).length} words recorded
                </span>
                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={submitting || !answerText.trim() || isTerminated}
                  className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-500/25 transition-all flex items-center gap-2 disabled:opacity-40"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Scoring Answer...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit & Next Question</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* 3. EXAMINATION PROCTORING FOOTER */}
      <footer className="h-14 px-6 sm:px-10 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="font-medium">Continuous Security Monitoring Active</span>
        </div>

        <div className="flex items-center gap-4">
          <span>Violations Logged: <b className="text-white">{violationCount} / 3</b></span>
          <span className="hidden sm:inline text-slate-600">•</span>
          <span className="hidden sm:inline">Human HR Review Enforced</span>
        </div>
      </footer>

      {/* =====================================================================
          PROFESSIONAL SECURITY WARNING MODAL (STRIKES 1, 2, 3)
      ====================================================================== */}
      {activeWarning && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-in fade-in duration-200">
            <div className={`inline-flex p-3 rounded-2xl ${
              activeWarning.level === 1
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}>
              {activeWarning.level === 3 ? (
                <XCircle className="w-8 h-8" />
              ) : (
                <ShieldAlert className="w-8 h-8" />
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-white tracking-tight">{activeWarning.title}</h2>
              <p className="text-xs text-slate-300 leading-relaxed">{activeWarning.message}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-around text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Strikes Logged</span>
                <span className={`text-base font-extrabold ${activeWarning.level === 3 ? 'text-rose-400' : 'text-amber-400'}`}>
                  {violationCount} of 3
                </span>
              </div>
              <div className="h-6 w-px bg-slate-800"></div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Chances Remaining</span>
                <span className="text-base font-extrabold text-slate-200">
                  {Math.max(0, 3 - violationCount)}
                </span>
              </div>
            </div>

            {activeWarning.level < 3 ? (
              <button
                type="button"
                onClick={handleReturnToInterview}
                className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Return to Full-Screen Interview</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/candidate/applications')}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs border border-slate-700 transition-all"
              >
                Go to My Applications
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
