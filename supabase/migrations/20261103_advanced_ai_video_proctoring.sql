-- Migration: 20261103_advanced_ai_video_proctoring.sql
-- Description: Advanced AI Video Proctoring, YOLO Malpractice Detection, Frame Verification, and HR Evidence Review

-- 1. Add evidence and review columns to interview_proctoring_events if not exists
ALTER TABLE public.interview_proctoring_events
ADD COLUMN IF NOT EXISTS evidence_image_path TEXT,
ADD COLUMN IF NOT EXISTS confidence_score FLOAT NOT NULL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS model_name VARCHAR(50) NOT NULL DEFAULT 'system',
ADD COLUMN IF NOT EXISTS review_status VARCHAR(30) NOT NULL DEFAULT 'unreviewed', -- unreviewed, genuine_violation, false_positive, normal_behavior, technical_issue, investigating
ADD COLUMN IF NOT EXISTS hr_notes TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reviewer_id VARCHAR(36) REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_proctoring_events_review_status ON public.interview_proctoring_events(review_status);

-- 2. AI Video Analysis Table (tracks asynchronous chronological second-by-second video processing)
CREATE TABLE IF NOT EXISTS public.ai_video_analyses (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL UNIQUE REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    recording_id VARCHAR(36) REFERENCES public.interview_recordings(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    total_frames_sampled INTEGER NOT NULL DEFAULT 0,
    video_duration_seconds FLOAT NOT NULL DEFAULT 0.0,
    processed_duration_seconds FLOAT NOT NULL DEFAULT 0.0,
    coverage_percentage FLOAT NOT NULL DEFAULT 0.0,
    events_detected_count INTEGER NOT NULL DEFAULT 0,
    high_priority_count INTEGER NOT NULL DEFAULT 0,
    technical_events_count INTEGER NOT NULL DEFAULT 0,
    overall_integrity_status VARCHAR(50) NOT NULL DEFAULT 'pending_analysis',
    -- 'pending_analysis', 'analysis_in_progress', 'no_significant_indicators', 'suspicious_activity_flagged', 'technical_issues_detected', 'human_review_completed'
    model_version VARCHAR(50) NOT NULL DEFAULT 'YOLOv8n-Vision-2026.1',
    error_message TEXT,
    analysis_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_ai_video_analyses_session ON public.ai_video_analyses(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_video_analyses_status ON public.ai_video_analyses(status);
CREATE INDEX IF NOT EXISTS idx_ai_video_analyses_integrity ON public.ai_video_analyses(overall_integrity_status);

-- 3. Camera Verification Logs Table (strict pre-flight verification & live monitoring)
CREATE TABLE IF NOT EXISTS public.camera_verification_logs (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    candidate_id VARCHAR(36) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL, -- 'passed', 'failed', 'retried'
    has_face_detected BOOLEAN NOT NULL DEFAULT FALSE,
    is_black_screen BOOLEAN NOT NULL DEFAULT FALSE,
    is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
    average_brightness FLOAT NOT NULL DEFAULT 0.0,
    fps FLOAT NOT NULL DEFAULT 0.0,
    error_message TEXT,
    verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_camera_logs_session ON public.camera_verification_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_camera_logs_candidate ON public.camera_verification_logs(candidate_id);
