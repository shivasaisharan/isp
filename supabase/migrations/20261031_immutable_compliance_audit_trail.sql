-- ==============================================================================
-- SMART RECRUIT SUPABASE MIGRATION: IMMUTABLE RESPONSIBLE AI AUDIT TRAIL
-- Version: 2026.10.31
-- Description: Dedicated table for immutable compliance audit events with
--              organization-level RLS and strict tamper-proof immutability rules.
-- ==============================================================================

-- 1. Create table audit_events
CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_role VARCHAR(50) NOT NULL, -- 'hr', 'candidate', 'system'
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(36),
    details_json JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Performance & Audit Indexes
CREATE INDEX IF NOT EXISTS idx_audit_events_org ON public.audit_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON public.audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON public.audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON public.audit_events(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON public.audit_events(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Authorized HR recruiters can view audit events for their organization
DROP POLICY IF EXISTS "HR members can view their organization audit trail" ON public.audit_events;
CREATE POLICY "HR members can view their organization audit trail"
ON public.audit_events
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_members.organization_id = audit_events.organization_id
        AND organization_members.user_id = auth.uid()
    )
);

-- 5. RLS Policy: Privileged backend service role can insert audit events
DROP POLICY IF EXISTS "Service role can record compliance audit events" ON public.audit_events;
CREATE POLICY "Service role can record compliance audit events"
ON public.audit_events
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 6. STRICT ENTERPRISE IMMUTABILITY: No updates or deletes permitted
DROP POLICY IF EXISTS "Strict immutability - no updates permitted on audit events" ON public.audit_events;
CREATE POLICY "Strict immutability - no updates permitted on audit events"
ON public.audit_events
FOR UPDATE
USING (false);

DROP POLICY IF EXISTS "Strict immutability - no deletes permitted on audit events" ON public.audit_events;
CREATE POLICY "Strict immutability - no deletes permitted on audit events"
ON public.audit_events
FOR DELETE
USING (false);
