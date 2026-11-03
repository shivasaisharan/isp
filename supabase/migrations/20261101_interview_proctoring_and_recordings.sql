-- Migration: 20261101_interview_proctoring_and_recordings.sql
-- Description: Remote Video Interview, Screen Sharing, MediaRecorder Chunks, and AI Proctoring Event Timeline Schema

-- 1. Storage bucket for interview recordings (ensure bucket exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'smartrecruit-interview-recordings',
    'smartrecruit-interview-recordings',
    false,
    524288000, -- 500 MB max file size
    ARRAY['video/webm', 'video/mp4', 'video/x-matroska', 'audio/webm']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Interview Recordings Table
CREATE TABLE IF NOT EXISTS public.interview_recordings (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    candidate_id VARCHAR(36) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes INTEGER NOT NULL DEFAULT 0,
    duration_seconds FLOAT NOT NULL DEFAULT 0.0,
    mime_type VARCHAR(50) NOT NULL DEFAULT 'video/webm',
    status VARCHAR(30) NOT NULL DEFAULT 'recording', -- 'recording', 'processing', 'ready', 'failed'
    recording_type VARCHAR(50) NOT NULL DEFAULT 'composite_screen_camera',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_interview_recordings_session ON public.interview_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_recordings_candidate ON public.interview_recordings(candidate_id);

-- 3. Interview Recording Chunks Table
CREATE TABLE IF NOT EXISTS public.interview_recording_chunks (
    id VARCHAR(36) PRIMARY KEY,
    recording_id VARCHAR(36) NOT NULL REFERENCES public.interview_recordings(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL DEFAULT 0,
    duration_seconds FLOAT NOT NULL DEFAULT 0.0,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_recording_chunks_recording ON public.interview_recording_chunks(recording_id);
CREATE INDEX IF NOT EXISTS idx_interview_recording_chunks_order ON public.interview_recording_chunks(recording_id, chunk_index);

-- 4. Interview Proctoring Events Table
CREATE TABLE IF NOT EXISTS public.interview_proctoring_events (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    candidate_id VARCHAR(36) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info', -- 'info', 'low', 'medium', 'high', 'critical'
    is_security_violation BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT NOT NULL,
    timestamp_offset_seconds FLOAT NOT NULL DEFAULT 0.0,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proctoring_events_session ON public.interview_proctoring_events(session_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_events_type ON public.interview_proctoring_events(event_type);
CREATE INDEX IF NOT EXISTS idx_proctoring_events_severity ON public.interview_proctoring_events(severity);

-- 5. Interview Permission Consent Table
CREATE TABLE IF NOT EXISTS public.interview_permission_consents (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL UNIQUE REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    candidate_id VARCHAR(36) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    webcam_granted BOOLEAN NOT NULL DEFAULT FALSE,
    microphone_granted BOOLEAN NOT NULL DEFAULT FALSE,
    screen_share_granted BOOLEAN NOT NULL DEFAULT FALSE,
    recording_consent_agreed BOOLEAN NOT NULL DEFAULT FALSE,
    fullscreen_consent_agreed BOOLEAN NOT NULL DEFAULT FALSE,
    browser_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    consented_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permission_consents_session ON public.interview_permission_consents(session_id);

-- 6. Interview Session Proctoring Metadata & HR Review Table
CREATE TABLE IF NOT EXISTS public.interview_session_metadata (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL UNIQUE REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    reviewer_id VARCHAR(36) REFERENCES public.users(id) ON DELETE SET NULL,
    proctoring_verdict VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'cleared', 'suspicious', 'flagged_violation'
    reviewer_notes TEXT DEFAULT '',
    reviewed_at TIMESTAMP WITH TIME ZONE,
    total_recording_duration_seconds FLOAT NOT NULL DEFAULT 0.0,
    total_disconnections INTEGER NOT NULL DEFAULT 0,
    total_fullscreen_exits INTEGER NOT NULL DEFAULT 0,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_metadata_session ON public.interview_session_metadata(session_id);
CREATE INDEX IF NOT EXISTS idx_session_metadata_verdict ON public.interview_session_metadata(proctoring_verdict);

