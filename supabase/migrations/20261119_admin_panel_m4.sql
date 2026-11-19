-- ==============================================================================
-- BeBig 2.0 — Admin Control Panel Milestone 4
-- Admin Delete User + Guaranteed User Display Names + Global Exercise Images
-- Migration: 20261119_admin_panel_m4.sql
-- Additive, idempotent, zero destructive table drop operations.
-- ==============================================================================

-- 1. Ensure public.profiles has full_name column (additive)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 2. SECURITY DEFINER RPC: Admin Delete User
-- Gated strictly by is_current_user_admin().
-- Blocks self-deletion (p_target_user_id = auth.uid()).
-- Blocks deleting other admin accounts (is_admin = true).
-- Cleans up dependent user rows safely and deletes from auth.users.
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_target_is_admin BOOLEAN := FALSE;
  v_target_exists BOOLEAN := FALSE;
BEGIN
  -- Security check: Caller MUST be an active administrator
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin access required'
      USING ERRCODE = '42501';
  END IF;

  -- Input validation
  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid target user ID'
      USING ERRCODE = '22023';
  END IF;

  -- Safety rule 1: Block self-deletion through admin delete
  IF p_target_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Cannot delete your own admin account via admin delete'
      USING ERRCODE = '42501';
  END IF;

  -- Check existence in auth.users
  SELECT TRUE INTO v_target_exists
  FROM auth.users
  WHERE id = p_target_user_id;

  IF NOT FOUND OR NOT v_target_exists THEN
    RAISE EXCEPTION 'Target user not found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Safety rule 2: Block deleting other administrator accounts
  SELECT (
    COALESCE(p.is_admin, FALSE)
    OR EXISTS (
      SELECT 1
      FROM public.admin_roles ar
      WHERE ar.user_id = p.id
        AND ar.role IN ('super_admin', 'admin')
    )
  ) INTO v_target_is_admin
  FROM public.profiles p
  WHERE p.id = p_target_user_id;

  IF v_target_is_admin IS TRUE THEN
    RAISE EXCEPTION 'Cannot delete another administrator account'
      USING ERRCODE = '42501';
  END IF;

  -- Clean up dependent operational tables safely prior to auth.users deletion
  DELETE FROM public.assigned_workouts
    WHERE assignee_user_id = p_target_user_id
       OR assigned_by = p_target_user_id;

  DELETE FROM public.trainer_workout_templates
    WHERE created_by = p_target_user_id;

  DELETE FROM public.app_error_logs
    WHERE user_id = p_target_user_id;

  DELETE FROM public.app_announcements
    WHERE created_by = p_target_user_id;

  -- Delete public.profiles row if cascade is not triggered immediately
  DELETE FROM public.profiles
    WHERE id = p_target_user_id;

  -- Authoritatively delete from auth.users (cascades to remaining user entities)
  DELETE FROM auth.users
    WHERE id = p_target_user_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'deleted_user_id', p_target_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

-- 3. Update get_admin_user_directory with guaranteed display names and full_name search
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
      NULLIF(trim(p.full_name), ''),
      NULLIF(trim(p.display_name), ''),
      NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
      initcap(split_part(COALESCE(u.email::TEXT, 'athlete'), '@', 1)),
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
     OR COALESCE(p.full_name, '') ILIKE ('%' || v_search || '%')
     OR COALESCE(p.display_name, '') ILIKE ('%' || v_search || '%')
     OR COALESCE(u.raw_user_meta_data->>'full_name', '') ILIKE ('%' || v_search || '%')
     OR COALESCE(u.raw_user_meta_data->>'name', '') ILIKE ('%' || v_search || '%')
     OR split_part(COALESCE(u.email::TEXT, ''), '@', 1) ILIKE ('%' || v_search || '%')
  ORDER BY ws_stats.last_workout_at DESC NULLS LAST, p.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_user_directory(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_user_directory(TEXT, INT) TO authenticated;

-- 4. Add image_url column to public.global_exercise_catalog (strictly HTTPS/public CDN URL)
ALTER TABLE public.global_exercise_catalog
  ADD COLUMN IF NOT EXISTS image_url TEXT NULL;

-- 5. Create or update public 'exercise-images' bucket in Supabase Storage
-- Max 2MB per image, compressed image mime types only
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exercise-images',
  'exercise-images',
  true,
  2097152, -- 2MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS Policies for 'exercise-images'
DROP POLICY IF EXISTS "Public read access for exercise images" ON storage.objects;
CREATE POLICY "Public read access for exercise images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'exercise-images');

DROP POLICY IF EXISTS "Admins can insert exercise images" ON storage.objects;
CREATE POLICY "Admins can insert exercise images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'exercise-images'
    AND public.is_current_user_admin()
  );

DROP POLICY IF EXISTS "Admins can update exercise images" ON storage.objects;
CREATE POLICY "Admins can update exercise images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'exercise-images'
    AND public.is_current_user_admin()
  )
  WITH CHECK (
    bucket_id = 'exercise-images'
    AND public.is_current_user_admin()
  );

DROP POLICY IF EXISTS "Admins can delete exercise images" ON storage.objects;
CREATE POLICY "Admins can delete exercise images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'exercise-images'
    AND public.is_current_user_admin()
  );
