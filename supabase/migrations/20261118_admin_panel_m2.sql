-- ==============================================================================
-- BeBig 2.0 — Admin Control Panel Milestone 2
-- User Directory RPC + Trainer Workout Templates + Safe Client Assignment Inbox
-- Migration: 20261118_admin_panel_m2.sql
-- Additive, idempotent, zero destructive operations.
-- ==============================================================================

-- 1. Create public.trainer_workout_templates (strictly admin-managed reusable templates)
CREATE TABLE IF NOT EXISTS public.trainer_workout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 140),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  focus_tag TEXT NOT NULL DEFAULT 'Full Body' CHECK (char_length(focus_tag) <= 64),
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(exercises) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_trainer_workout_templates_updated_at
  ON public.trainer_workout_templates (updated_at DESC);

DROP TRIGGER IF EXISTS set_trainer_workout_templates_updated_at ON public.trainer_workout_templates;
CREATE TRIGGER set_trainer_workout_templates_updated_at
  BEFORE UPDATE ON public.trainer_workout_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.trainer_workout_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view trainer workout templates" ON public.trainer_workout_templates;
CREATE POLICY "Admins can view trainer workout templates"
  ON public.trainer_workout_templates
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can insert trainer workout templates" ON public.trainer_workout_templates;
CREATE POLICY "Admins can insert trainer workout templates"
  ON public.trainer_workout_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_current_user_admin()
    AND (created_by IS NULL OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update trainer workout templates" ON public.trainer_workout_templates;
CREATE POLICY "Admins can update trainer workout templates"
  ON public.trainer_workout_templates
  FOR UPDATE
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can delete trainer workout templates" ON public.trainer_workout_templates;
CREATE POLICY "Admins can delete trainer workout templates"
  ON public.trainer_workout_templates
  FOR DELETE
  TO authenticated
  USING (public.is_current_user_admin());

-- 2. Create public.assigned_workouts (isolated trainer-to-client assignment inbox;
--    never mutates user workout_templates or workout_sessions)
CREATE TABLE IF NOT EXISTS public.assigned_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  template_id UUID NULL REFERENCES public.trainer_workout_templates(id) ON DELETE SET NULL,
  assigned_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 140),
  trainer_note TEXT NOT NULL DEFAULT '' CHECK (char_length(trainer_note) <= 1000),
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(exercises) = 'array'),
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'started', 'completed', 'dismissed')),
  completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_assigned_workouts_assignee_status
  ON public.assigned_workouts (assignee_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assigned_workouts_created_at
  ON public.assigned_workouts (created_at DESC);

-- Prevent non-admin assignees from mutating immutable assignment payload fields
CREATE OR REPLACE FUNCTION public.protect_assigned_workout_assignee_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF jwt_role = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin')
     OR public.is_current_user_admin() THEN
    RETURN NEW;
  END IF;

  -- Assignees may only update status ('started' | 'completed' | 'dismissed') and completed_at
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.template_id IS DISTINCT FROM OLD.template_id
     OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
     OR NEW.assignee_user_id IS DISTINCT FROM OLD.assignee_user_id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.trainer_note IS DISTINCT FROM OLD.trainer_note
     OR NEW.exercises IS DISTINCT FROM OLD.exercises THEN
    RAISE EXCEPTION 'Forbidden: assignees may only update assignment status'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status NOT IN ('started', 'completed', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid assignment status transition'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_assigned_workout_assignee_columns ON public.assigned_workouts;
CREATE TRIGGER trg_protect_assigned_workout_assignee_columns
  BEFORE UPDATE ON public.assigned_workouts
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_assigned_workout_assignee_columns();

ALTER TABLE public.assigned_workouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and assignees can view assigned workouts" ON public.assigned_workouts;
CREATE POLICY "Admins and assignees can view assigned workouts"
  ON public.assigned_workouts
  FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_admin()
    OR auth.uid() = assignee_user_id
  );

DROP POLICY IF EXISTS "Admins can assign workouts" ON public.assigned_workouts;
CREATE POLICY "Admins can assign workouts"
  ON public.assigned_workouts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_current_user_admin()
    AND (assigned_by IS NULL OR assigned_by = auth.uid())
  );

DROP POLICY IF EXISTS "Admins and assignees can update assigned workouts" ON public.assigned_workouts;
CREATE POLICY "Admins and assignees can update assigned workouts"
  ON public.assigned_workouts
  FOR UPDATE
  TO authenticated
  USING (
    public.is_current_user_admin()
    OR auth.uid() = assignee_user_id
  )
  WITH CHECK (
    public.is_current_user_admin()
    OR (
      auth.uid() = assignee_user_id
      AND status IN ('started', 'completed', 'dismissed')
    )
  );

DROP POLICY IF EXISTS "Admins can delete assigned workouts" ON public.assigned_workouts;
CREATE POLICY "Admins can delete assigned workouts"
  ON public.assigned_workouts
  FOR DELETE
  TO authenticated
  USING (public.is_current_user_admin());

-- 3. SECURITY DEFINER RPC: Sanitized Admin User Directory
CREATE OR REPLACE FUNCTION public.get_admin_user_directory(
  p_search TEXT DEFAULT '',
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  is_admin BOOLEAN,
  created_at TIMESTAMPTZ,
  total_workouts BIGINT,
  last_workout_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search TEXT := COALESCE(trim(p_search), '');
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin access required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS user_id,
    COALESCE(u.email::TEXT, '') AS email,
    COALESCE(
      NULLIF(trim(p.display_name), ''),
      NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
      NULLIF(split_part(COALESCE(u.email::TEXT, ''), '@', 1), ''),
      'Athlete'
    ) AS full_name,
    (
      COALESCE(p.is_admin, FALSE)
      OR EXISTS (
        SELECT 1
        FROM public.admin_roles ar
        WHERE ar.user_id = p.id
          AND ar.role IN ('super_admin', 'admin')
      )
    ) AS is_admin,
    p.created_at AS created_at,
    COALESCE(ws_stats.total_workouts, 0::BIGINT) AS total_workouts,
    ws_stats.last_workout_at AS last_workout_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN (
    SELECT
      ws.user_id,
      COUNT(*)::BIGINT AS total_workouts,
      MAX(ws.finished_at) AS last_workout_at
    FROM public.workout_sessions ws
    WHERE ws.deleted_at IS NULL
      AND ws.status = 'completed'
    GROUP BY ws.user_id
  ) ws_stats ON ws_stats.user_id = p.id
  WHERE v_search = ''
     OR COALESCE(u.email::TEXT, '') ILIKE ('%' || v_search || '%')
     OR COALESCE(p.display_name, '') ILIKE ('%' || v_search || '%')
     OR COALESCE(u.raw_user_meta_data->>'full_name', '') ILIKE ('%' || v_search || '%')
     OR COALESCE(u.raw_user_meta_data->>'name', '') ILIKE ('%' || v_search || '%')
  ORDER BY ws_stats.last_workout_at DESC NULLS LAST, p.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_user_directory(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_user_directory(TEXT, INT) TO authenticated;
