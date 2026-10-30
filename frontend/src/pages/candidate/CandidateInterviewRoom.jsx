import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, Volume2, Send, CheckCircle2, AlertCircle, Bot, Clock, ArrowRight, Sparkles, Loader2
} from 'lucide-react';
import api from '../../services/api';

export default function CandidateInterviewRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

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

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);

  // Load session details
  const fetchSession = async () => {
    try {
      const res = await api.get(`/interviews/${sessionId}`);
      setSession(res.data);
      if (res.data.status === 'completed') {
        // Find report and redirect
        const repRes = await api.get('/reports/candidate/all');
        const match = repRes.data.find(r => r.session_id === sessionId);
        if (match) {
          navigate(`/candidate/results/${match.id}`);
          return;
        }
      }
      setCurrentQuestion(res.data.current_question);
      if (res.data.current_question) {
        speakText(res.data.current_question.question_text);
      }
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

  // Professional Enterprise Dual Speech-to-Text Pipeline:
  // 1. Live Streaming SpeechRecognition renders your words in REAL TIME as you speak (immediate feedback).
  // 2. High-Fidelity MediaRecorder buffers the raw audio.
  // 3. When you click Stop, Faster-Whisper cleans, corrects technical terms, formats proper nouns, and finalizes the answer.
  const liveTranscriptRef = useRef('');

  const startRecording = async () => {
    setSttError('');
    liveTranscriptRef.current = '';

    // A. Start Live Real-Time Web Speech for Instant Visual Feedback
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
            // Show real-time words immediately in the box
            setAnswerText(currentFinal.trim());
          }
        };

        recognition.onerror = (e) => {
          console.warn("Live speech warning:", e.error);
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {
        console.warn("Could not start live speech recognizer:", e);
      }
    }

    // B. Start High-Fidelity Audio Buffer Recording for Faster-Whisper
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
          // If audio blob was tiny but live recognition caught words, keep the live transcript
          setAnswerText(liveTranscriptRef.current);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // Collect chunk every 250ms
      setIsListening(true);
    } catch (err) {
      console.warn("MediaRecorder mic access error:", err);
      // Fallback: if MediaRecorder fails, live speech recognition continues alone
      if (recognitionRef.current) {
        setIsListening(true);
      } else {
        setSttError("Microphone access was denied or not found. Please verify browser permissions.");
      }
    }
  };

  const stopRecording = () => {
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
  };

  const toggleListening = () => {
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
        const whisperClean = res.data.transcript.trim();
        // Replace provisional live text with pristine Whisper output
        setAnswerText(whisperClean);
      } else if (liveTranscriptRef.current) {
        // Retain live speech transcript if Whisper returned blank
        setAnswerText(liveTranscriptRef.current);
      }
    } catch (err) {
      console.warn("Whisper refinement notice:", err);
      // Keep live transcript intact if server is busy
      if (liveTranscriptRef.current) {
        setAnswerText(liveTranscriptRef.current);
      }
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answerText.trim() || !currentQuestion) return;
    setSubmitting(true);
    setLastFeedback(null);

    try {
      const res = await api.post('/interviews/answer', {
        session_id: sessionId,
        question_id: currentQuestion.id,
        answer: answerText
      });

      setAnswerText('');
      if (isListening) toggleListening();

      if (res.data.is_finished) {
        // Finalize interview
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
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Session Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase">Interactive AI Interview Room</span>
            <p className="text-sm font-bold text-slate-900">
              Question {(currentQuestion?.question_index ?? 0) + 1} of 5
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>

      {/* Question Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-brand-900 to-indigo-900 text-white shadow-md relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-300">
            {currentQuestion?.category || 'Technical'} Dimension
          </span>
          <button
            onClick={() => speakText(currentQuestion?.question_text || '')}
            className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              isSpeaking ? 'bg-brand-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>{isSpeaking ? 'Speaking...' : 'Play Audio'}</span>
          </button>
        </div>
        <h2 className="text-lg sm:text-xl font-bold leading-relaxed">
          "{currentQuestion?.question_text || 'Loading question...'}"
        </h2>
      </div>

      {/* Previous Answer Evaluation Notice */}
      {lastFeedback && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Previous Answer Evaluated ({lastFeedback.score}%)</span>
            <span>{lastFeedback.feedback}</span>
          </div>
        </div>
      )}

      {/* Candidate Answer Workspace */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        {sttError && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{sttError}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700 uppercase">Your Technical Response</label>
            <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
              Faster-Whisper AI Powered
            </span>
          </div>
          <button
            type="button"
            onClick={toggleListening}
            disabled={isTranscribing}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              isListening
                ? 'bg-rose-500 text-white animate-pulse'
                : isTranscribing
                ? 'bg-brand-50 text-brand-700 border border-brand-200 cursor-wait'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-3.5 h-3.5" />
                <span>Stop & Transcribe</span>
              </>
            ) : isTranscribing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                <span>Whisper Transcribing...</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 text-brand-600" />
                <span>Speak Answer</span>
              </>
            )}
          </button>
        </div>

        <textarea
          rows={6}
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
          placeholder="Type or speak your answer in detail. Emphasize architecture decisions, code principles, and problem-solving trade-offs..."
          className="w-full p-4 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none leading-relaxed"
        />

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-400">
            {answerText.split(/\s+/).filter(Boolean).length} words recorded
          </span>
          <button
            onClick={handleSubmitAnswer}
            disabled={submitting || !answerText.trim()}
            className="px-6 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Evaluating Evidence...</span>
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
    </div>
  );
}

