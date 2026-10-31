-- ==============================================================================
-- SMART RECRUIT SUPABASE MIGRATION: HR DECISION HISTORY & RLS POLICIES
-- Version: 2026.10.31
-- Description: Dedicated immutable decision audit table with organization-level RLS.
-- ==============================================================================

-- 1. Create table hr_decision_history
CREATE TABLE IF NOT EXISTS public.hr_decision_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    decision VARCHAR(50) NOT NULL, -- 'ACCEPTED' or 'REJECTED'
    decision_notes TEXT NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    decided_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Performance & Audit Indexes
CREATE INDEX IF NOT EXISTS idx_hr_decision_hist_org ON public.hr_decision_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_hr_decision_hist_app ON public.hr_decision_history(application_id);
CREATE INDEX IF NOT EXISTS idx_hr_decision_hist_cand ON public.hr_decision_history(candidate_id);
CREATE INDEX IF NOT EXISTS idx_hr_decision_hist_job ON public.hr_decision_history(job_id);
CREATE INDEX IF NOT EXISTS idx_hr_decision_hist_rev ON public.hr_decision_history(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_hr_decision_hist_decision ON public.hr_decision_history(decision);
CREATE INDEX IF NOT EXISTS idx_hr_decision_hist_date ON public.hr_decision_history(decided_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.hr_decision_history ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: HR Recruiters can view decisions for their authorized organization
DROP POLICY IF EXISTS "HR members can view their organization decision history" ON public.hr_decision_history;
CREATE POLICY "HR members can view their organization decision history"
ON public.hr_decision_history
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_members.organization_id = hr_decision_history.organization_id
        AND organization_members.user_id = auth.uid()
    )
);

-- 5. RLS Policy: Privileged backend service role can insert decision records
DROP POLICY IF EXISTS "Service role can manage decision history" ON public.hr_decision_history;
CREATE POLICY "Service role can manage decision history"
ON public.hr_decision_history
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 6. RLS Policy: Protect historical records from updates and deletions (Immutable audit log)
DROP POLICY IF EXISTS "No updates permitted on immutable decision history" ON public.hr_decision_history;
CREATE POLICY "No updates permitted on immutable decision history"
ON public.hr_decision_history
FOR UPDATE
USING (false);

DROP POLICY IF EXISTS "No deletes permitted on immutable decision history" ON public.hr_decision_history;
CREATE POLICY "No deletes permitted on immutable decision history"
ON public.hr_decision_history
FOR DELETE
USING (false);

