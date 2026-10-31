-- ==============================================================================
-- SMART RECRUIT SUPABASE MIGRATION: CANDIDATE RECRUITMENT ACTIVITIES
-- Version: 2026.10.31
-- Description: Dedicated table for candidate recruitment journey milestones
--              (excluding authentication noise), with Candidate-scoped RLS.
-- ==============================================================================

-- 1. Create table candidate_recruitment_activities
CREATE TABLE IF NOT EXISTS public.candidate_recruitment_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    activity_type VARCHAR(80) NOT NULL,
    activity_title VARCHAR(255) NOT NULL,
    activity_description TEXT NOT NULL,
    metadata_json JSONB DEFAULT '{}'::jsonb NOT NULL,
    occurred_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_cand_rec_act_candidate ON public.candidate_recruitment_activities(candidate_id);
CREATE INDEX IF NOT EXISTS idx_cand_rec_act_application ON public.candidate_recruitment_activities(application_id);
CREATE INDEX IF NOT EXISTS idx_cand_rec_act_job ON public.candidate_recruitment_activities(job_id);
CREATE INDEX IF NOT EXISTS idx_cand_rec_act_company ON public.candidate_recruitment_activities(company_id);
CREATE INDEX IF NOT EXISTS idx_cand_rec_act_type ON public.candidate_recruitment_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_cand_rec_act_occurred ON public.candidate_recruitment_activities(occurred_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.candidate_recruitment_activities ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Candidates can view only their own recruitment activities
DROP POLICY IF EXISTS "Candidates can view their own recruitment activities" ON public.candidate_recruitment_activities;
CREATE POLICY "Candidates can view their own recruitment activities"
ON public.candidate_recruitment_activities
FOR SELECT
USING (auth.uid() = candidate_id);

-- 5. RLS Policy: HR Recruiters can view activity events for applications in their organization
DROP POLICY IF EXISTS "HR members can view company application activities" ON public.candidate_recruitment_activities;
CREATE POLICY "HR members can view company application activities"
ON public.candidate_recruitment_activities
FOR SELECT
USING (
    company_id IS NOT NULL AND
    EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_members.organization_id = candidate_recruitment_activities.company_id
        AND organization_members.user_id = auth.uid()
    )
);

-- 6. RLS Policy: Privileged backend service role can manage activities
DROP POLICY IF EXISTS "Service role can manage candidate activities" ON public.candidate_recruitment_activities;
CREATE POLICY "Service role can manage candidate activities"
ON public.candidate_recruitment_activities
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 7. Immutable audit log: No updates or deletes permitted by candidates or standard users
DROP POLICY IF EXISTS "No updates permitted on recruitment activity logs" ON public.candidate_recruitment_activities;
CREATE POLICY "No updates permitted on recruitment activity logs"
ON public.candidate_recruitment_activities
FOR UPDATE
USING (false);

DROP POLICY IF EXISTS "No deletes permitted on recruitment activity logs" ON public.candidate_recruitment_activities;
CREATE POLICY "No deletes permitted on recruitment activity logs"
ON public.candidate_recruitment_activities
FOR DELETE
USING (false);

