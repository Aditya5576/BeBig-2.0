-- ==============================================================================
-- BeBig 2.0 — Milestone 10 (Fix)
-- Migration: 20260916000000_grant_authenticated_sync_table_access.sql
-- Purpose: Grant necessary table-level privileges to the 'authenticated' role
--          to allow the Supabase API to route requests to the sync tables.
--          RLS remains enabled and will enforce row-level access (user_id = auth.uid()).
-- ==============================================================================

GRANT SELECT, INSERT, UPDATE ON public.workout_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.workout_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.custom_exercises TO authenticated;
