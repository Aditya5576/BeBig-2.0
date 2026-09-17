-- ==============================================================================
-- BeBig 2.0 — Milestone 4G: Admin Table Grants
-- Migration: 20260917171602_grant_admin_table_access.sql
-- Purpose: Grant SELECT table-level privileges on admin tables to 'authenticated'.
--          RLS remains enabled and will enforce row-level security.
-- ==============================================================================

GRANT SELECT ON public.admin_roles TO authenticated;
GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT SELECT ON public.coach_client_relationships TO authenticated;
