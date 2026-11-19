-- ============================================================================
-- Migration: 20261119_wger_exercise_catalog.sql
-- Description: Server-side curated Wger exercise catalog with strict license
--              and attribution storage (Tier 2 High-ROI Upgrade).
-- Security:
--   - RLS enabled.
--   - Public read for anon and authenticated users (active exercises only).
--   - Write/upsert restricted strictly to service_role (via sync-wger-catalog).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.wger_exercise_catalog (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    wger_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT NOT NULL,
    primary_muscles TEXT[] DEFAULT '{}'::text[],
    secondary_muscles TEXT[] DEFAULT '{}'::text[],
    equipment TEXT[] DEFAULT '{}'::text[],
    image_url TEXT,
    license_name TEXT NOT NULL,
    license_author TEXT,
    attribution_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    synced_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast category browsing, search, and sync deduplication
CREATE INDEX IF NOT EXISTS idx_wger_catalog_category ON public.wger_exercise_catalog (category);
CREATE INDEX IF NOT EXISTS idx_wger_catalog_name ON public.wger_exercise_catalog (name);
CREATE INDEX IF NOT EXISTS idx_wger_catalog_active ON public.wger_exercise_catalog (is_active);
CREATE INDEX IF NOT EXISTS idx_wger_catalog_wger_id ON public.wger_exercise_catalog (wger_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.wger_exercise_catalog ENABLE ROW LEVEL SECURITY;

-- 1. Read Policy: Allow anon and authenticated clients to read active records
DROP POLICY IF EXISTS "Allow public read of active wger exercises" ON public.wger_exercise_catalog;
CREATE POLICY "Allow public read of active wger exercises"
    ON public.wger_exercise_catalog
    FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

-- 2. Service Role Management Policy: Edge functions & background sync jobs
DROP POLICY IF EXISTS "Allow service_role full management of wger exercises" ON public.wger_exercise_catalog;
CREATE POLICY "Allow service_role full management of wger exercises"
    ON public.wger_exercise_catalog
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant appropriate permissions
GRANT SELECT ON public.wger_exercise_catalog TO anon, authenticated;
GRANT ALL ON public.wger_exercise_catalog TO service_role;
