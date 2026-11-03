import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, Volume2, Bot, Clock, ArrowRight, Loader2,
  Shield, ShieldAlert, ShieldCheck, AlertTriangle, Maximize2, Minimize2,
  XCircle, Lock, Info, ExternalLink, Camera, CameraOff, Monitor, MonitorOff,
  Video, VideoOff, CheckSquare, Square, RefreshCw, Radio, CheckCircle2
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
  // HARDWARE VERIFICATION & PRE-INTERVIEW INSTRUCTIONS STATE
  // =========================================================================
  const [cameraVerified, setCameraVerified] = useState(false);
  const [micVerified, setMicVerified] = useState(false);
  const [screenVerified, setScreenVerified] = useState(false);
  const [consentAgreed, setConsentAgreed] = useState(false);

  const [checkingCamera, setCheckingCamera] = useState(false);
  const [checkingMic, setCheckingMic] = useState(false);
  const [checkingScreen, setCheckingScreen] = useState(false);

  const [cameraError, setCameraError] = useState('');
  const [micError, setMicError] = useState('');
  const [screenError, setScreenError] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);

  // Media Stream Refs
  const webcamStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const micStreamRef = useRef(null);

  // Video Element Refs
  const previewWebcamVideoRef = useRef(null);
  const previewScreenVideoRef = useRef(null);
  const activeWebcamVideoRef = useRef(null);

  // Audio Context for Level Testing
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  // Video Recording Engine Refs
  const videoRecorderRef = useRef(null);
  const recordingChunkIndexRef = useRef(0);
  const recordingStartTimeRef = useRef(null);
  const isFinishedRef = useRef(false);

  // Screen Disconnection Alert Modal
  const [screenDisconnected, setScreenDisconnected] = useState(false);
  const [reconnectingScreen, setReconnectingScreen] = useState(false);

  // Camera Disconnection Alert Modal
  const [cameraDisconnected, setCameraDisconnected] = useState(false);
  const [reconnectingCamera, setReconnectingCamera] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);

  // =========================================================================
  // SECURE FULL-SCREEN INTERVIEW & THREE-STRIKE STATE
  // =========================================================================
  const [hasStartedSecureMode, setHasStartedSecureMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [maxViolations] = useState(3);
  const [isTerminated, setIsTerminated] = useState(false);
  const [terminationReason, setTerminationReason] = useState('');
  const [activeWarning, setActiveWarning] = useState(null); // { level, title, message }
  const [fullscreenError, setFullscreenError] = useState('');

  // Audio & Speech Refs for Answers
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const liveTranscriptRef = useRef('');

  // Monitoring & Incident Deduplication Refs
  const violationCountRef = useRef(0);
  const isInterruptedRef = useRef(false);
  const isFullscreenRef = useRef(false);
  const isTerminatedRef = useRef(false);
  const hasStartedSecureModeRef = useRef(false);
  const currentIncidentIdRef = useRef(null);

  isTerminatedRef.current = isTerminated;
  hasStartedSecureModeRef.current = hasStartedSecureMode;
  violationCountRef.current = violationCount;

  // Helper to log proctoring events to backend
  const logProctoringEvent = useCallback(async (eventType, severity, description, isViolation = false, metadata = {}) => {
    try {
      const offsetSeconds = recordingStartTimeRef.current
        ? (Date.now() - recordingStartTimeRef.current) / 1000
        : 0;
      await api.post(`/interviews/${sessionId}/proctoring-events`, {
        event_type: eventType,
        severity: severity,
        is_security_violation: isViolation,
        description: description,
        timestamp_offset_seconds: offsetSeconds,
        metadata: metadata
      });
    } catch (e) {
      console.warn("Could not log proctoring event:", e);
    }
  }, [sessionId]);

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

      try {
        const secRes = await api.get(`/interviews/${sessionId}/security-status`);
        setViolationCount(secRes.data.violation_count);
        violationCountRef.current = secRes.data.violation_count;
        if (secRes.data.is_terminated) {
          setIsTerminated(true);
          isTerminatedRef.current = true;
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

    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearInterval(timer);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      // Cleanup streams on unmount
      if (webcamStreamRef.current) webcamStreamRef.current.getTracks().forEach(t => t.stop());
      if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop());
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (e) {}
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [sessionId]);

  // Attach webcam preview when stream ready
  useEffect(() => {
    if (previewWebcamVideoRef.current && webcamStreamRef.current) {
      previewWebcamVideoRef.current.srcObject = webcamStreamRef.current;
    }
  }, [cameraVerified]);

  // Attach active room PiP webcam when started
  useEffect(() => {
    if (hasStartedSecureMode && activeWebcamVideoRef.current && webcamStreamRef.current) {
      activeWebcamVideoRef.current.srcObject = webcamStreamRef.current;
    }
  }, [hasStartedSecureMode]);

  // Attach screen preview when ready
  useEffect(() => {
    if (previewScreenVideoRef.current && screenStreamRef.current) {
      previewScreenVideoRef.current.srcObject = screenStreamRef.current;
    }
  }, [screenVerified]);

  // =========================================================================
  // 1. WEBCAM PERMISSION, FRAME BRIGHTNESS & FACE DETECTION VERIFICATION
  // =========================================================================
  const handleCameraStreamEnded = () => {
    setCameraVerified(false);
    setCameraDisconnected(true);
    logProctoringEvent('webcam_disconnected', 'critical', 'Candidate webcam stream disconnected during active session.', true);
    triggerViolation('webcam_disconnected', 'Candidate webcam was disconnected during active examination.');
  };

  const handleReconnectCamera = async () => {
    setReconnectingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      webcamStreamRef.current = stream;
      stream.getVideoTracks()[0].addEventListener('ended', handleCameraStreamEnded);
      if (activeWebcamVideoRef.current) {
        activeWebcamVideoRef.current.srcObject = stream;
      }
      setCameraVerified(true);
      setCameraDisconnected(false);
      logProctoringEvent('webcam_reconnected', 'info', 'Candidate reconnected webcam successfully.');
    } catch (e) {
      console.error("Camera reconnect failed:", e);
    } finally {
      setReconnectingCamera(false);
    }
  };

  const handleVerifyWebcam = async () => {
    setCheckingCamera(true);
    setCameraError('');
    setFaceDetected(false);
    try {
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      webcamStreamRef.current = stream;
      stream.getVideoTracks()[0].addEventListener('ended', handleCameraStreamEnded);

      if (previewWebcamVideoRef.current) {
        previewWebcamVideoRef.current.srcObject = stream;
        try { await previewWebcamVideoRef.current.play(); } catch (e) {}
      }

      // Allow camera hardware 600ms to settle auto-gain/exposure
      await new Promise(res => setTimeout(res, 600));

      const video = previewWebcamVideoRef.current;
      if (!video) throw new Error("Video element unavailable");

      // Offscreen canvas frame pixel analysis
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, 640, 480);

      const imgData = ctx.getImageData(0, 0, 640, 480).data;
      let totalLuma = 0;
      for (let i = 0; i < imgData.length; i += 4) {
        totalLuma += (imgData[i] * 0.299 + imgData[i+1] * 0.587 + imgData[i+2] * 0.114);
      }
      const avgBrightness = totalLuma / (imgData.length / 4);

      // Black screen / Obstructed camera detection
      if (avgBrightness < 12.0) {
        setCameraVerified(false);
        setFaceDetected(false);
        setCameraError("Black screen detected! Your camera preview is completely dark or obstructed. Please check physical privacy slider, room lighting, or camera drivers.");
        setCheckingCamera(false);
        return;
      }

      // Send snapshot frame to backend AI model for face detection
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setCameraVerified(false);
          setCameraError("Failed to capture video frame for AI verification.");
          setCheckingCamera(false);
          return;
        }

        try {
          const formData = new FormData();
          formData.append('file', blob, 'candidate_frame.jpg');
          const res = await api.post(`/interviews/${sessionId}/verify-camera-frame`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          if (res.data.valid && res.data.has_face) {
            setCameraVerified(true);
            setFaceDetected(true);
            setCameraError('');
          } else {
            setCameraVerified(false);
            setFaceDetected(false);
            setCameraError(res.data.error || "No human face detected. Please face the camera directly in a well-lit area.");
          }
        } catch (apiErr) {
          console.warn("Backend camera validation notice:", apiErr);
          if (avgBrightness >= 18.0) {
            setCameraVerified(true);
            setFaceDetected(true);
          } else {
            setCameraVerified(false);
            setCameraError("Camera verification failed. Please try again.");
          }
        } finally {
          setCheckingCamera(false);
        }
      }, 'image/jpeg', 0.85);

    } catch (err) {
      console.error("Camera verification error:", err);
      setCameraError('Webcam access was denied or device not found. Please allow camera permissions in your browser.');
      setCameraVerified(false);
      setCheckingCamera(false);
    }
  };

  // =========================================================================
  // 2. MICROPHONE PERMISSION & AUDIO LEVEL METER
  // =========================================================================
  const handleVerifyMicrophone = async () => {
    setCheckingMic(true);
    setMicError('');
    try {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // Create audio visualizer analyser
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(updateLevel);
        };
        updateLevel();
      } catch (audioErr) {
        console.warn("Audio meter init notice:", audioErr);
      }

      setMicVerified(true);
    } catch (err) {
      console.error("Mic verification error:", err);
      setMicError('Microphone permission was denied. Please allow microphone access in your browser.');
      setMicVerified(false);
    } finally {
      setCheckingMic(false);
    }
  };

  // =========================================================================
  // 3. SCREEN SHARING PERMISSION & INTERRUPTION LISTENER
  // =========================================================================
  const handleVerifyScreenShare = async () => {
    setCheckingScreen(true);
    setScreenError('');
    try {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false
      });
      screenStreamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      // Listen for when candidate stops sharing via the browser floating bar
      track.addEventListener('ended', handleScreenShareStopped);

      setScreenVerified(true);
      if (previewScreenVideoRef.current) {
        previewScreenVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Screen share error:", err);
      setScreenError('Screen sharing was cancelled or denied. Full display sharing is required for proctoring compliance.');
      setScreenVerified(false);
    } finally {
      setCheckingScreen(false);
    }
  };

  // Handler for when candidate stops sharing their screen
  const handleScreenShareStopped = () => {
    setScreenVerified(false);
    setScreenDisconnected(true);
    logProctoringEvent('screen_share_stopped', 'critical', 'Candidate stopped screen sharing track.', true);
    triggerViolation('screen_share_stopped', 'Candidate interrupted full-screen display sharing.');
  };

  // Reconnect Screen Share from Dialog
  const handleReconnectScreenShare = async () => {
    setReconnectingScreen(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false
      });
      screenStreamRef.current = stream;
      stream.getVideoTracks()[0].addEventListener('ended', handleScreenShareStopped);
      setScreenVerified(true);
      setScreenDisconnected(false);
      logProctoringEvent('screen_share_resumed', 'info', 'Candidate reconnected screen sharing successfully.');
    } catch (err) {
      console.error("Reconnect screen share failed:", err);
    } finally {
      setReconnectingScreen(false);
    }
  };

  // =========================================================================
  // 4. START SECURE INTERVIEW & CHUNKED VIDEO RECORDING ENGINE
  // =========================================================================
  const startChunkedVideoRecording = () => {
    try {
      // Build combined media stream (Screen Video + Mic Audio)
      const combinedStream = new MediaStream();
      if (screenStreamRef.current) {
        screenStreamRef.current.getVideoTracks().forEach(t => combinedStream.addTrack(t));
      } else if (webcamStreamRef.current) {
        webcamStreamRef.current.getVideoTracks().forEach(t => combinedStream.addTrack(t));
      }
      if (micStreamRef.current) {
        micStreamRef.current.getAudioTracks().forEach(t => combinedStream.addTrack(t));
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '');

      const recorder = new MediaRecorder(combinedStream, mimeType ? { mimeType } : undefined);
      recordingChunkIndexRef.current = 0;
      recordingStartTimeRef.current = Date.now();

      recorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          const chunkIdx = recordingChunkIndexRef.current++;
          const formData = new FormData();
          formData.append('file', e.data, `chunk_${chunkIdx}.webm`);
          formData.append('chunk_index', chunkIdx);
          formData.append('duration_seconds', 10.0);
          formData.append('is_final', isFinishedRef.current ? 'true' : 'false');

          try {
            await api.post(`/interviews/${sessionId}/recordings/chunks`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
          } catch (uploadErr) {
            console.warn("Chunk upload warning:", uploadErr);
          }
        }
      };

      recorder.start(10000); // 10s chunk slices
      videoRecorderRef.current = recorder;
    } catch (err) {
      console.error("Video recording engine initialization error:", err);
    }
  };

  const handleEnterSecureInterview = async () => {
    setFullscreenError('');

    // Pre-flight validation
    if (!cameraVerified || !micVerified || !screenVerified || !consentAgreed) {
      alert("Please satisfy all pre-flight verifications (Webcam, Microphone, Screen Sharing, and Consent) before entering.");
      return;
    }

    // Submit consent record
    try {
      await api.post(`/interviews/${sessionId}/consent`, {
        webcam_granted: true,
        microphone_granted: true,
        screen_share_granted: true,
        recording_consent_agreed: true,
        fullscreen_consent_agreed: true,
        browser_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height
        }
      });
    } catch (consentErr) {
      console.warn("Consent recording notice:", consentErr);
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
      isFullscreenRef.current = true;
      setHasStartedSecureMode(true);
      hasStartedSecureModeRef.current = true;
      isInterruptedRef.current = false;
      currentIncidentIdRef.current = null;

      // Launch progressive video recording engine
      startChunkedVideoRecording();

      // Log proctoring start event
      logProctoringEvent('interview_started', 'info', 'Candidate entered full-screen examination mode and activated recording pipeline.');

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
  // DEDUPLICATED THREE-STRIKE VIOLATION ENGINE (INCIDENT-BASED)
  // =========================================================================
  const triggerViolation = useCallback(async (type, description) => {
    if (!hasStartedSecureModeRef.current || isTerminatedRef.current) return;

    if (isInterruptedRef.current) {
      return;
    }

    isInterruptedRef.current = true;
    isFullscreenRef.current = false;
    setIsFullscreen(false);

    const incidentId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `inc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    currentIncidentIdRef.current = incidentId;

    const nextCount = Math.min(3, violationCountRef.current + 1);
    violationCountRef.current = nextCount;
    setViolationCount(nextCount);

    if (nextCount >= 3) {
      setIsTerminated(true);
      isTerminatedRef.current = true;
      setTerminationReason("You have exceeded the permitted number of interview environment violations (3/3 strikes). Your interview has been terminated and flagged for HR review.");
      setActiveWarning({
        level: 3,
        title: "Interview Terminated & Flagged",
        message: "You have exceeded the permitted number of interview environment violations. Your interview has been safely recorded and submitted to human HR recruiters for review."
      });
      if (isListening) stopRecording();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      logProctoringEvent('interview_terminated', 'critical', 'Session terminated after reaching 3 strikes.', true);
    } else if (nextCount === 1) {
      setActiveWarning({
        level: 1,
        title: "Interview Security Warning (1 of 3)",
        message: "You have exited the secure interview environment or switched windows. This activity has been recorded. You have 2 remaining chances before termination."
      });
      logProctoringEvent('strike_1_logged', 'high', description, true);
    } else if (nextCount === 2) {
      setActiveWarning({
        level: 2,
        title: "Final Interview Warning (2 of 3)",
        message: "This is your second security violation. One more confirmed interruption will immediately terminate your interview and flag it for HR review."
      });
      logProctoringEvent('strike_2_logged', 'critical', description, true);
    }

    try {
      const res = await api.post(`/interviews/${sessionId}/violations`, {
        incident_id: incidentId,
        violation_type: type,
        description: description,
        metadata: { client_timestamp: new Date().toISOString() }
      });

      const serverCount = res.data.violation_count;
      if (serverCount !== undefined && serverCount !== nextCount) {
        setViolationCount(serverCount);
        violationCountRef.current = serverCount;
      }

      if (res.data.is_terminated) {
        setIsTerminated(true);
        isTerminatedRef.current = true;
        setTerminationReason(res.data.termination_reason || "Interview terminated and flagged for HR review.");
        setActiveWarning({
          level: 3,
          title: "Interview Terminated & Flagged",
          message: "You have exceeded the permitted number of interview environment violations. Your interview has been safely recorded and submitted to human HR recruiters for review."
        });
        if (isListening) stopRecording();
        if (window.speechSynthesis) window.speechSynthesis.cancel();
      }
    } catch (err) {
      console.error("Violation sync error:", err);
    }
  }, [sessionId, isListening, logProctoringEvent]);

  // Browser Event Listeners
  useEffect(() => {
    if (!hasStartedSecureMode || isTerminated) return;

    const handleFullscreenChange = () => {
      const isCurrentlyFs = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFs);
      isFullscreenRef.current = isCurrentlyFs;

      if (!isCurrentlyFs && !isTerminatedRef.current) {
        triggerViolation("fullscreen_exit", "Candidate exited browser full-screen mode.");
      } else if (isCurrentlyFs) {
        isInterruptedRef.current = false;
        currentIncidentIdRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && !isTerminatedRef.current) {
        triggerViolation("tab_switched", "Candidate switched tabs or minimized the interview window.");
      }
    };

    const handleWindowBlur = () => {
      if (!isTerminatedRef.current && isFullscreenRef.current) {
        triggerViolation("focus_lost", "Interview window lost focus.");
      }
    };

    const handleKeyDown = (e) => {
      if ((e.key === 'Escape' || e.key === 'Esc') && isFullscreenRef.current && !isTerminatedRef.current) {
        triggerViolation("fullscreen_exit", "Candidate pressed Escape to exit full-screen mode.");
      }
    };

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Leaving this page may register an interview violation. Are you sure?";
      return e.returnValue;
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasStartedSecureMode, isTerminated, triggerViolation]);

  const handleReturnToInterview = async () => {
    try {
      const elem = document.documentElement;
      if (!document.fullscreenElement) {
        if (elem.requestFullscreen) await elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) await elem.webkitRequestFullscreen();
        else if (elem.msRequestFullscreen) await elem.msRequestFullscreen();
      }
      setIsFullscreen(true);
      isFullscreenRef.current = true;
      isInterruptedRef.current = false;
      currentIncidentIdRef.current = null;
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

  // Enterprise Speech-to-Text Pipeline (Faster-Whisper)
  const startRecording = async () => {
    if (isTerminated) return;
    setSttError('');
    liveTranscriptRef.current = '';

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
        isFinishedRef.current = true;
        // Finalize video recording
        if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
          try { videoRecorderRef.current.stop(); } catch (e) {}
        }
        try {
          await api.post(`/interviews/${sessionId}/recordings/finalize`);
        } catch (finErr) {
          console.warn("Recording finalize notice:", finErr);
        }

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

  const allChecksPassed = cameraVerified && micVerified && screenVerified && consentAgreed;

  // =========================================================================
  // VIEW 1: SECURE INTERVIEW INSTRUCTIONS SCREEN (PRE-ENTRY)
  // =========================================================================
  if (!hasStartedSecureMode && !isTerminated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20 mb-1">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Smart<span className="text-brand-400">Recruit</span> Secure Examination Mode
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
              This remote interview incorporates real-time webcam monitoring, entire screen sharing, voice recording, and AI proctoring for compliance integrity.
            </p>
          </div>

          {fullscreenError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{fullscreenError}</span>
            </div>
          )}

          {/* 4 Interactive Pre-Flight Verification Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Card 1: Webcam Verification & Live Preview */}
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-brand-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">1. Webcam Verification</h3>
                </div>
                {cameraVerified ? (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Face & Camera Verified (AI Confirmed)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Required
                  </span>
                )}
              </div>

              {/* Webcam Preview Video */}
              <div className="relative aspect-video rounded-xl bg-black overflow-hidden border border-slate-700 flex items-center justify-center">
                {cameraVerified ? (
                  <>
                    <video
                      ref={previewWebcamVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover -scale-x-100"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Cam Live
                    </div>
                    {faceDetected && (
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-emerald-950/80 backdrop-blur text-[10px] text-emerald-300 font-medium flex items-center gap-1 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Face Detected
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center p-4 space-y-1">
                    <CameraOff className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-[11px] text-slate-500">Camera preview not active</p>
                  </div>
                )}
              </div>

              {cameraError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Camera Check Failed</span>
                  </div>
                  <p className="text-[11px] text-rose-300/90 leading-relaxed">{cameraError}</p>
                  <p className="text-[10px] text-slate-400 pt-1">
                    Tip: Open your camera privacy shutter, sit in a well-lit room facing the camera, and grant camera permissions when prompted.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleVerifyWebcam}
                disabled={checkingCamera}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 flex items-center justify-center gap-2"
              >
                {checkingCamera ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5 text-brand-400" />}
                <span>{cameraVerified ? 'Re-test Camera' : 'Allow & Preview Camera'}</span>
              </button>
            </div>

            {/* Card 2: Microphone Verification & Audio Level Meter */}
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">2. Microphone Test</h3>
                </div>
                {micVerified ? (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Ready
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Required
                  </span>
                )}
              </div>

              {/* Audio Level Visualizer */}
              <div className="aspect-video rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center p-4 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                  <Mic className={`w-6 h-6 ${micVerified ? 'text-emerald-400' : 'text-slate-600'}`} />
                </div>
                <div className="w-full max-w-[200px] space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Input Level</span>
                    <span className="font-mono">{audioLevel}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-75"
                      style={{ width: `${audioLevel}%` }}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 text-center">
                  {micVerified ? 'Speak into your mic to test audio level meter' : 'Microphone access pending verification'}
                </p>
              </div>

              {micError && (
                <p className="text-[11px] text-rose-400">{micError}</p>
              )}

              <button
                type="button"
                onClick={handleVerifyMicrophone}
                disabled={checkingMic}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 flex items-center justify-center gap-2"
              >
                {checkingMic ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{micVerified ? 'Re-test Microphone' : 'Allow & Test Microphone'}</span>
              </button>
            </div>

            {/* Card 3: Entire Screen Sharing Verification */}
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3 md:col-span-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">3. Screen Sharing Verification</h3>
                </div>
                {screenVerified ? (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Entire Screen Active
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Mandatory
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="space-y-2">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Select <b>"Entire Screen"</b> in your browser dialog. Proctoring rules prohibit sharing single tabs or application windows.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    • Detection logs when candidate stops sharing.<br />
                    • Screen capture runs continuously until interview completion.
                  </p>
                  {screenError && (
                    <p className="text-[11px] text-rose-400">{screenError}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleVerifyScreenShare}
                    disabled={checkingScreen}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 flex items-center justify-center gap-2"
                  >
                    {checkingScreen ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Monitor className="w-3.5 h-3.5 text-indigo-400" />}
                    <span>{screenVerified ? 'Re-select Screen Share' : 'Select Entire Screen to Share'}</span>
                  </button>
                </div>

                {/* Screen Preview */}
                <div className="aspect-video rounded-xl bg-black border border-slate-700 overflow-hidden flex items-center justify-center relative">
                  {screenVerified ? (
                    <>
                      <video
                        ref={previewScreenVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur text-[10px] text-indigo-400 font-mono font-bold flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        Screen Streaming
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4 space-y-1">
                      <MonitorOff className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-[11px] text-slate-500">Screen share preview not active</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Explicit Recording Consent & Three-Strike Security Notice */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300 space-y-1">
                <span className="font-bold text-white block">Three-Strike Security & Integrity Policy</span>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Exiting full-screen, switching windows, or stopping screen sharing logs a security violation. Candidates receive exactly <b>3 strikes</b>. On the 3rd strike, the session terminates and flags for human HR review.
                </p>
              </div>
            </div>

            {/* Checkbox Consent */}
            <label className="flex items-start gap-3 pt-2 cursor-pointer select-none border-t border-slate-800/80">
              <input
                type="checkbox"
                checked={consentAgreed}
                onChange={(e) => setConsentAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-brand-600 bg-slate-900 border-slate-700 focus:ring-brand-500 accent-brand-600 cursor-pointer"
              />
              <span className="text-xs text-slate-300 leading-relaxed">
                I explicitly consent to continuous video, microphone, and entire screen recording during this interview for evaluation and integrity review by Smart Recruit.
              </span>
            </label>
          </div>

          {/* Permission Checklist & Gated Start Button */}
          <div className="pt-2 space-y-3">
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 px-1">
              <span>Verification Checklist:</span>
              <div className="flex items-center gap-3 font-semibold text-[11px]">
                <span className={cameraVerified ? 'text-emerald-400' : 'text-slate-500'}>
                  {cameraVerified ? '✓' : '○'} Camera
                </span>
                <span className={micVerified ? 'text-emerald-400' : 'text-slate-500'}>
                  {micVerified ? '✓' : '○'} Mic
                </span>
                <span className={screenVerified ? 'text-emerald-400' : 'text-slate-500'}>
                  {screenVerified ? '✓' : '○'} Screen Share
                </span>
                <span className={consentAgreed ? 'text-emerald-400' : 'text-slate-500'}>
                  {consentAgreed ? '✓' : '○'} Consent
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleEnterSecureInterview}
              disabled={!allChecksPassed}
              className={`w-full py-4 font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-xl ${
                allChecksPassed
                  ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-500/25 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 border border-slate-800 cursor-not-allowed'
              }`}
            >
              <Maximize2 className="w-4 h-4" />
              <span>
                {allChecksPassed
                  ? 'Enter Full-Screen & Start Interview'
                  : 'Complete All Verifications to Enable Interview'}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: ACTIVE FULL-SCREEN EXAMINATION ROOM
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

        {/* Live Status Indicators */}
        <div className="flex items-center gap-3">
          {/* Active Screen Share & REC Badges */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60 text-[11px] font-semibold text-slate-300">
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="text-rose-400 font-bold uppercase tracking-wider text-[10px]">REC</span>
            <span className="text-slate-600">|</span>
            <Monitor className="w-3.5 h-3.5 text-indigo-400" />
            <span>Screen Live</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700/60 text-xs font-semibold text-slate-300">
            <Bot className="w-3.5 h-3.5 text-brand-400" />
            <span>Question {(currentQuestion?.question_index ?? 0) + 1} of 5</span>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700/60 text-xs font-bold text-slate-200">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{formatTime(timeLeft)}</span>
          </div>

          {/* Security Strikes Badge */}
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
        {/* Terminal Notice if Terminated */}
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
                placeholder="Type your structured answer here, or click 'Speak Answer' to speak naturally..."
                disabled={isTerminated}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
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
          <span className="font-medium">Continuous Security & Screen Monitoring Active</span>
        </div>

        <div className="flex items-center gap-4">
          <span>Violations Logged: <b className="text-white">{violationCount} / 3</b></span>
          <span className="hidden sm:inline text-slate-600">•</span>
          <span className="hidden sm:inline">Human HR Review Enforced</span>
        </div>
      </footer>

      {/* =====================================================================
          FLOATING PICTURE-IN-PICTURE (PiP) WEBCAM PREVIEW
      ====================================================================== */}
      <div className="fixed bottom-20 right-6 z-40 w-44 sm:w-52 aspect-video bg-black rounded-2xl overflow-hidden border-2 border-brand-500/80 shadow-2xl">
        <video
          ref={activeWebcamVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover -scale-x-100"
        />
        <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur text-[9px] text-emerald-400 font-bold flex items-center gap-1 border border-emerald-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>PROCTORING CAM</span>
        </div>
      </div>

      {/* =====================================================================
          SCREEN SHARE DISCONNECTION RECOVERY MODAL
      ====================================================================== */}
      {screenDisconnected && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-amber-500/60 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-center">
            <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <MonitorOff className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-white">Screen Sharing Interrupted</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                You stopped sharing your display. Proctoring protocols require continuous entire screen sharing. Please reconnect immediately to avoid further security strikes.
              </p>
            </div>

            <button
              type="button"
              onClick={handleReconnectScreenShare}
              disabled={reconnectingScreen}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2"
            >
              {reconnectingScreen ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Requesting Display...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Reconnect Entire Screen</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          CAMERA DISCONNECTION RECOVERY MODAL
      ====================================================================== */}
      {cameraDisconnected && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-rose-500/60 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-center">
            <div className="inline-flex p-3 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <CameraOff className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-white">Webcam Disconnected – Assessment Paused</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your webcam video feed was disconnected. AI proctoring requires continuous facial and environment monitoring. Please reconnect your camera immediately to resume your interview.
              </p>
            </div>

            <button
              type="button"
              onClick={handleReconnectCamera}
              disabled={reconnectingCamera}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2"
            >
              {reconnectingCamera ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Re-enabling Webcam...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Reconnect Camera</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

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
