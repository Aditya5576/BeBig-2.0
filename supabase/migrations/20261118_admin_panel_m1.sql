-- ==============================================================================
-- BeBig 2.0 — Admin Control Panel Milestone 1 (RBAC, Error Logs, Announcements)
-- Migration: 20261118_admin_panel_m1.sql
-- Additive, idempotent, zero destructive operations.
-- ==============================================================================

-- 1. Add is_admin flag to public.profiles (strictly default FALSE)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_is_admin
  ON public.profiles (id)
  WHERE is_admin = TRUE;

-- 1b. Prevent client-side self-escalation of profiles.is_admin via own-profile INSERT/UPDATE RLS
CREATE OR REPLACE FUNCTION public.prevent_profiles_is_admin_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
  -- Allow trusted server-side roles (Supabase Dashboard SQL editor / postgres / service_role)
  IF jwt_role = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_admin IS TRUE THEN
      RAISE EXCEPTION 'Forbidden: cannot set profiles.is_admin from client role'
        USING ERRCODE = '42501';
    END IF;
    NEW.is_admin := FALSE;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'Forbidden: cannot modify profiles.is_admin from client role'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profiles_is_admin_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profiles_is_admin_escalation
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profiles_is_admin_escalation();

-- 2. Zero-argument SECURITY DEFINER admin check (prevents arbitrary UUID probing)
--    Checks profiles.is_admin = TRUE and maintains backwards compatibility with admin_roles.
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  has_flag BOOLEAN := FALSE;
BEGIN
  IF uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = uid
      AND p.is_admin = TRUE
  ) INTO has_flag;

  IF has_flag THEN
    RETURN TRUE;
  END IF;

  -- Backwards compatibility with existing admin_roles table (super_admin / admin)
  IF to_regclass('public.admin_roles') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.admin_roles ar
      WHERE ar.user_id = uid
        AND ar.role IN ('super_admin', 'admin')
    ) INTO has_flag;
  END IF;

  RETURN COALESCE(has_flag, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO anon, authenticated;

-- 3. Create public.app_error_logs table (Sanitized Client Diagnostics Telemetry)
CREATE TABLE IF NOT EXISTS public.app_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  route TEXT NOT NULL DEFAULT '/' CHECK (char_length(route) <= 256),
  error_name TEXT NOT NULL DEFAULT 'Error' CHECK (char_length(error_name) <= 128),
  error_message TEXT NOT NULL CHECK (char_length(error_message) <= 1000),
  stack_trace TEXT NULL CHECK (stack_trace IS NULL OR char_length(stack_trace) <= 8000),
  device_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  app_version TEXT NOT NULL DEFAULT 'unknown' CHECK (char_length(app_version) <= 64),
  severity TEXT NOT NULL DEFAULT 'crash' CHECK (severity IN ('crash', 'error', 'warning', 'info'))
);

CREATE INDEX IF NOT EXISTS idx_app_error_logs_created_at
  ON public.app_error_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_error_logs_severity_created
  ON public.app_error_logs (severity, created_at DESC);

ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can insert sanitized app error logs" ON public.app_error_logs;
CREATE POLICY "Clients can insert sanitized app error logs"
  ON public.app_error_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id IS NULL OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can view app error logs" ON public.app_error_logs;
CREATE POLICY "Admins can view app error logs"
  ON public.app_error_logs
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can delete app error logs" ON public.app_error_logs;
CREATE POLICY "Admins can delete app error logs"
  ON public.app_error_logs
  FOR DELETE
  TO authenticated
  USING (public.is_current_user_admin());

-- 4. Create public.app_announcements table
CREATE TABLE IF NOT EXISTS public.app_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 140),
  body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 1000),
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'release', 'maintenance')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_app_announcements_active_created
  ON public.app_announcements (is_active, created_at DESC);

DROP TRIGGER IF EXISTS set_app_announcements_updated_at ON public.app_announcements;
CREATE TRIGGER set_app_announcements_updated_at
  BEFORE UPDATE ON public.app_announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.app_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active announcements and admins view all" ON public.app_announcements;
CREATE POLICY "Anyone can view active announcements and admins view all"
  ON public.app_announcements
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = TRUE OR public.is_current_user_admin()
  );

DROP POLICY IF EXISTS "Admins can create announcements" ON public.app_announcements;
CREATE POLICY "Admins can create announcements"
  ON public.app_announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_current_user_admin()
    AND (created_by IS NULL OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update announcements" ON public.app_announcements;
CREATE POLICY "Admins can update announcements"
  ON public.app_announcements
  FOR UPDATE
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can delete announcements" ON public.app_announcements;
CREATE POLICY "Admins can delete announcements"
  ON public.app_announcements
  FOR DELETE
  TO authenticated
  USING (public.is_current_user_admin());

-- 5. SECURITY DEFINER RPC for Admin Overview Aggregate Metrics (zero PII)
CREATE OR REPLACE FUNCTION public.get_admin_overview_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_users BIGINT := 0;
  v_workouts_today BIGINT := 0;
  v_workouts_this_week BIGINT := 0;
  v_total_completed_workouts BIGINT := 0;
  v_recent_errors_24h BIGINT := 0;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin access required'
      USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*)::BIGINT
    INTO v_total_users
    FROM public.profiles;

  SELECT COUNT(*)::BIGINT
    INTO v_workouts_today
    FROM public.workout_sessions
   WHERE deleted_at IS NULL
     AND finished_at >= date_trunc('day', now());

  SELECT COUNT(*)::BIGINT
    INTO v_workouts_this_week
    FROM public.workout_sessions
   WHERE deleted_at IS NULL
     AND finished_at >= now() - interval '7 days';

  SELECT COUNT(*)::BIGINT
    INTO v_total_completed_workouts
    FROM public.workout_sessions
   WHERE deleted_at IS NULL
     AND status = 'completed';

  SELECT COUNT(*)::BIGINT
    INTO v_recent_errors_24h
    FROM public.app_error_logs
   WHERE created_at >= now() - interval '24 hours';

  RETURN jsonb_build_object(
    'total_users', v_total_users,
    'workouts_today', v_workouts_today,
    'workouts_this_week', v_workouts_this_week,
    'total_completed_workouts', v_total_completed_workouts,
    'recent_errors_24h', v_recent_errors_24h,
    'generated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_overview_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_overview_metrics() TO authenticated;
