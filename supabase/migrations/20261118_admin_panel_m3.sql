-- ==============================================================================
-- BeBig 2.0 — Admin Control Panel Milestone 3
-- Global Curated Exercise Catalog (Strictly Text/Metadata-Only, Zero Bitmaps)
-- Migration: 20261118_admin_panel_m3.sql
-- Additive, idempotent, zero destructive operations.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.global_exercise_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 140),
  category TEXT NOT NULL CHECK (
    category IN ('abs', 'arms', 'back', 'calves', 'cardio', 'chest', 'legs', 'shoulders', 'other')
  ),
  equipment TEXT NOT NULL DEFAULT 'Bodyweight' CHECK (char_length(trim(equipment)) BETWEEN 1 AND 80),
  primary_muscles TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(primary_muscles) >= 1),
  secondary_muscles TEXT[] NOT NULL DEFAULT '{}',
  instructions TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_global_exercise_catalog_active_category
  ON public.global_exercise_catalog (is_active, category, name);

DROP TRIGGER IF EXISTS set_global_exercise_catalog_updated_at ON public.global_exercise_catalog;
CREATE TRIGGER set_global_exercise_catalog_updated_at
  BEFORE UPDATE ON public.global_exercise_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.global_exercise_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active global exercises and admins view all" ON public.global_exercise_catalog;
CREATE POLICY "Public can view active global exercises and admins view all"
  ON public.global_exercise_catalog
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = TRUE OR public.is_current_user_admin()
  );

DROP POLICY IF EXISTS "Admins can insert global exercises" ON public.global_exercise_catalog;
CREATE POLICY "Admins can insert global exercises"
  ON public.global_exercise_catalog
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_current_user_admin()
    AND (created_by IS NULL OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update global exercises" ON public.global_exercise_catalog;
CREATE POLICY "Admins can update global exercises"
  ON public.global_exercise_catalog
  FOR UPDATE
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can delete global exercises" ON public.global_exercise_catalog;
CREATE POLICY "Admins can delete global exercises"
  ON public.global_exercise_catalog
  FOR DELETE
  TO authenticated
  USING (public.is_current_user_admin());
