-- =========================================================================
-- SMART RECRUIT: SUPABASE SEED DATA
-- Platform: Supabase PostgreSQL
-- =========================================================================

-- 1. Demo Organization
INSERT INTO public.organizations (id, name, slug, logo_url, website, plan, active_jobs_limit, monthly_interview_allowance)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Global Tech Solutions',
    'global-tech',
    'https://images.unsplash.com/photo-1549923746-c502d488b3ea?auto=format&fit=crop&w=120&h=120&q=80',
    'https://globaltech.io',
    'enterprise',
    50,
    500
) ON CONFLICT (slug) DO NOTHING;

-- 2. Demo Job Opening
INSERT INTO public.jobs (
    id, organization_id, title, department, experience_level, location,
    employment_type, salary_range, required_skills, preferred_skills,
    description, status
) VALUES (
    'j0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Senior AI / ML Platform Engineer',
    'Engineering',
    'Senior',
    'Remote / Hybrid',
    'Full-Time',
    '$140,000 - $180,000',
    '["Python", "FastAPI", "Docker", "PyTorch", "PostgreSQL"]'::jsonb,
    '["Kubernetes", "AWS", "LLM", "vLLM"]'::jsonb,
    'Architect and implement scalable AI inference and candidate evaluation pipelines for Smart Recruit.',
    'published'
) ON CONFLICT (id) DO NOTHING;

