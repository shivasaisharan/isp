-- =========================================================================
-- SMART RECRUIT: COMPLETE SUPABASE POSTGRESQL SCHEMA & RLS POLICIES
-- Platform: Supabase PostgreSQL
-- Standard: UUID Primary Keys, Relational Integrity, Row Level Security
-- =========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- 2. CORE TABLES (1 to 30)
-- =========================================================================

-- 1. Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url TEXT,
    website TEXT,
    plan VARCHAR(50) DEFAULT 'professional' NOT NULL,
    active_jobs_limit INT DEFAULT 20 NOT NULL,
    monthly_interview_allowance INT DEFAULT 200 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(30),
    role VARCHAR(30) DEFAULT 'CANDIDATE' NOT NULL, -- 'CANDIDATE', 'HR', 'ORG_ADMIN', 'SUPER_ADMIN'
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Organization Members
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'recruiter' NOT NULL, -- 'owner', 'admin', 'recruiter'
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (organization_id, user_id)
);

-- 4. Candidate Profiles
CREATE TABLE IF NOT EXISTS public.candidate_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    headline VARCHAR(200),
    summary TEXT,
    education VARCHAR(255),
    experience_years FLOAT DEFAULT 0.0 NOT NULL,
    skills JSONB DEFAULT '[]'::jsonb NOT NULL,
    location VARCHAR(100),
    linkedin_url TEXT,
    github_url TEXT,
    anonymized_alias VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. HR Profiles
CREATE TABLE IF NOT EXISTS public.hr_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    department VARCHAR(100),
    title VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. Jobs
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title VARCHAR(150) NOT NULL,
    department VARCHAR(100) NOT NULL,
    experience_level VARCHAR(50) DEFAULT 'Mid-Level' NOT NULL,
    location VARCHAR(100) DEFAULT 'Remote / Hybrid' NOT NULL,
    employment_type VARCHAR(50) DEFAULT 'Full-Time' NOT NULL,
    salary_range VARCHAR(100) DEFAULT '$90,000 - $130,000',
    required_skills JSONB DEFAULT '[]'::jsonb NOT NULL,
    preferred_skills JSONB DEFAULT '[]'::jsonb NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(30) DEFAULT 'published' NOT NULL, -- draft, published, paused, closed, archived
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. Skills Master Catalog
CREATE TABLE IF NOT EXISTS public.skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) DEFAULT 'technical' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 8. Skill Aliases
CREATE TABLE IF NOT EXISTS public.skill_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    alias VARCHAR(100) UNIQUE NOT NULL
);

-- 9. Job Skills
CREATE TABLE IF NOT EXISTS public.job_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    is_required BOOLEAN DEFAULT TRUE NOT NULL,
    weight FLOAT DEFAULT 1.0 NOT NULL,
    UNIQUE (job_id, skill_id)
);

-- 10. Resumes
CREATE TABLE IF NOT EXISTS public.resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100) DEFAULT 'application/pdf' NOT NULL,
    parsed_text TEXT,
    extracted_skills JSONB DEFAULT '[]'::jsonb NOT NULL,
    extracted_experience JSONB DEFAULT '{}'::jsonb NOT NULL,
    anonymized_alias VARCHAR(50) NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 11. Resume Skills
CREATE TABLE IF NOT EXISTS public.resume_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    years_experience FLOAT DEFAULT 1.0,
    UNIQUE (resume_id, skill_id)
);

-- 12. Applications
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'submitted' NOT NULL, -- submitted, under_review, interview_pending, interview_completed, hr_review, selected, rejected, withdrawn
    resume_match_score FLOAT DEFAULT 0.0 NOT NULL,
    sbert_similarity FLOAT DEFAULT 0.0 NOT NULL,
    skills_match_score FLOAT DEFAULT 0.0 NOT NULL,
    overall_ranking_score FLOAT DEFAULT 0.0 NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 13. Fit Assessments
CREATE TABLE IF NOT EXISTS public.fit_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID UNIQUE NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    match_score FLOAT NOT NULL,
    matched_skills JSONB DEFAULT '[]'::jsonb NOT NULL,
    missing_skills JSONB DEFAULT '[]'::jsonb NOT NULL,
    experience_fit_status VARCHAR(50) DEFAULT 'Qualified' NOT NULL,
    analyzed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 14. Interview Sessions
CREATE TABLE IF NOT EXISTS public.interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID UNIQUE NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    status VARCHAR(30) DEFAULT 'in_progress' NOT NULL, -- pending, in_progress, completed, expired, terminated_flagged
    duration_minutes INT DEFAULT 15 NOT NULL,
    current_question_index INT DEFAULT 0 NOT NULL,
    total_questions INT DEFAULT 5 NOT NULL,
    violation_count INT DEFAULT 0 NOT NULL,
    max_violations INT DEFAULT 3 NOT NULL,
    flagged_for_review BOOLEAN DEFAULT FALSE NOT NULL,
    termination_reason TEXT,
    is_secure_mode BOOLEAN DEFAULT TRUE NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMPTZ
);

-- 15. Interview Questions
CREATE TABLE IF NOT EXISTS public.interview_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    question_index INT NOT NULL,
    question_text TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'technical' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 16. Interview Answers
CREATE TABLE IF NOT EXISTS public.interview_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID UNIQUE NOT NULL REFERENCES public.interview_questions(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    candidate_answer TEXT NOT NULL,
    technical_score FLOAT DEFAULT 0.0 NOT NULL,
    problem_solving_score FLOAT DEFAULT 0.0 NOT NULL,
    skills_score FLOAT DEFAULT 0.0 NOT NULL,
    communication_score FLOAT DEFAULT 0.0 NOT NULL,
    project_score FLOAT DEFAULT 0.0 NOT NULL,
    composite_score FLOAT DEFAULT 0.0 NOT NULL,
    feedback TEXT,
    answered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 17. Interview Rubrics
CREATE TABLE IF NOT EXISTS public.interview_rubrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    rubric_version VARCHAR(20) DEFAULT '2026.1' NOT NULL,
    technical_weight FLOAT DEFAULT 0.35 NOT NULL,
    problem_solving_weight FLOAT DEFAULT 0.25 NOT NULL,
    skills_weight FLOAT DEFAULT 0.20 NOT NULL,
    communication_weight FLOAT DEFAULT 0.10 NOT NULL,
    project_weight FLOAT DEFAULT 0.10 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 18. Assessment Scores (Reports)
CREATE TABLE IF NOT EXISTS public.assessment_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID UNIQUE NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    technical_rating FLOAT NOT NULL,
    problem_solving_rating FLOAT NOT NULL,
    skills_rating FLOAT NOT NULL,
    communication_rating FLOAT NOT NULL,
    project_rating FLOAT NOT NULL,
    overall_score FLOAT NOT NULL,
    rubric_version VARCHAR(20) DEFAULT '2026.1' NOT NULL,
    strengths JSONB DEFAULT '[]'::jsonb NOT NULL,
    weaknesses JSONB DEFAULT '[]'::jsonb NOT NULL,
    skill_gap_summary TEXT NOT NULL,
    suggestions_for_improvement TEXT NOT NULL,
    candidate_visible_feedback TEXT NOT NULL,
    recruiter_confidential_notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 19. Assessment Evidence
CREATE TABLE IF NOT EXISTS public.assessment_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_score_id UUID NOT NULL REFERENCES public.assessment_scores(id) ON DELETE CASCADE,
    dimension VARCHAR(50) NOT NULL,
    evidence_quote TEXT NOT NULL,
    justification TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 20. Coding Assessments
CREATE TABLE IF NOT EXISTS public.coding_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    problem_statement TEXT NOT NULL,
    starter_code TEXT,
    test_cases JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 21. Coding Submissions
CREATE TABLE IF NOT EXISTS public.coding_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.coding_assessments(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    code_submitted TEXT NOT NULL,
    passed_tests INT DEFAULT 0 NOT NULL,
    total_tests INT DEFAULT 0 NOT NULL,
    score FLOAT DEFAULT 0.0 NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 22. HR Decisions
CREATE TABLE IF NOT EXISTS public.hr_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID UNIQUE NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    recruiter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    decision VARCHAR(50) NOT NULL, -- 'selected', 'rejected', 'on_hold'
    rationale TEXT NOT NULL,
    decided_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 23. Decision History
CREATE TABLE IF NOT EXISTS public.decision_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 24. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) DEFAULT 'info' NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 25. Candidate Consents
CREATE TABLE IF NOT EXISTS public.candidate_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL, -- 'ai_voice_interview', 'audio_recording', 'data_processing'
    has_consented BOOLEAN DEFAULT TRUE NOT NULL,
    consented_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 26. Interview Violations (Proctoring)
CREATE TABLE IF NOT EXISTS public.interview_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    violation_type VARCHAR(50) NOT NULL, -- fullscreen_exit, tab_switched, focus_lost, navigation_attempt
    description TEXT NOT NULL,
    violation_number INT NOT NULL,
    metadata_json JSONB DEFAULT '{}'::jsonb NOT NULL,
    occurred_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 27. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(50),
    details_json JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 28. Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID UNIQUE NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    plan_id VARCHAR(50) DEFAULT 'professional' NOT NULL,
    status VARCHAR(50) DEFAULT 'active' NOT NULL,
    current_period_start TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days') NOT NULL
);

-- 29. Plans
CREATE TABLE IF NOT EXISTS public.plans (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    monthly_price INT DEFAULT 0 NOT NULL,
    active_jobs_limit INT DEFAULT 20 NOT NULL,
    monthly_interviews_limit INT DEFAULT 200 NOT NULL
);

-- 30. Usage Records
CREATE TABLE IF NOT EXISTS public.usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    metric VARCHAR(50) NOT NULL, -- 'interviews_conducted', 'active_jobs', 'ai_tokens'
    count INT DEFAULT 1 NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =========================================================================
-- 3. AUTOMATIC PROFILE PROVISIONING TRIGGER (auth.users -> profiles)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone',
    COALESCE(UPPER(new.raw_user_meta_data->>'role'), 'CANDIDATE')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      updated_at = NOW();

  IF COALESCE(UPPER(new.raw_user_meta_data->>'role'), 'CANDIDATE') = 'CANDIDATE' THEN
    INSERT INTO public.candidate_profiles (user_id, anonymized_alias)
    VALUES (new.id, 'Candidate #' || SUBSTRING(new.id::text, 1, 4))
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =========================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_auth_org_id()
RETURNS uuid AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles Policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.get_auth_role() IN ('HR', 'SUPER_ADMIN'));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Candidate Resumes Policies
CREATE POLICY "Candidates manage own resumes"
  ON public.resumes FOR ALL
  USING (candidate_id = auth.uid());

CREATE POLICY "HR can view applicant resumes"
  ON public.resumes FOR SELECT
  USING (public.get_auth_role() IN ('HR', 'SUPER_ADMIN'));

-- Jobs Policies
CREATE POLICY "Anyone can view published jobs"
  ON public.jobs FOR SELECT
  USING (status = 'published' OR organization_id = public.get_auth_org_id());

CREATE POLICY "HR can manage own organization jobs"
  ON public.jobs FOR ALL
  USING (organization_id = public.get_auth_org_id());

-- Applications Policies
CREATE POLICY "Candidates can view own applications"
  ON public.applications FOR SELECT
  USING (candidate_id = auth.uid());

CREATE POLICY "Candidates can submit applications"
  ON public.applications FOR INSERT
  WITH CHECK (candidate_id = auth.uid());

CREATE POLICY "HR can view applications for their organization jobs"
  ON public.applications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = applications.job_id
      AND jobs.organization_id = public.get_auth_org_id()
    )
  );

-- Interview Sessions Policies
CREATE POLICY "Candidates can view own interview sessions"
  ON public.interview_sessions FOR SELECT
  USING (candidate_id = auth.uid());

CREATE POLICY "HR can view interview sessions for their organization"
  ON public.interview_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = interview_sessions.job_id
      AND jobs.organization_id = public.get_auth_org_id()
    )
  );

-- Notifications Policies
CREATE POLICY "Users manage own notifications"
  ON public.notifications FOR ALL
  USING (user_id = auth.uid());

-- =========================================================================
-- 5. STORAGE BUCKETS SETUP & STORAGE RLS
-- =========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('candidate-resumes', 'candidate-resumes', false, 10485760, ARRAY['application/pdf']),
  ('interview-audio', 'interview-audio', false, 20971520, ARRAY['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/ogg']),
  ('assessment-reports', 'assessment-reports', false, 10485760, ARRAY['application/pdf']),
  ('organization-assets', 'organization-assets', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;

-- Storage RLS: Candidate Resumes
CREATE POLICY "Candidates upload own resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'candidate-resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Candidates and HR read resumes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'candidate-resumes' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.get_auth_role() IN ('HR', 'SUPER_ADMIN')));

-- Storage RLS: Interview Audio
CREATE POLICY "Candidates upload interview audio"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'interview-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "HR read interview audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'interview-audio' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.get_auth_role() IN ('HR', 'SUPER_ADMIN')));
