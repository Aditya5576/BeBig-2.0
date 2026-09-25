-- ==============================================================================
-- BeBig 2.0 ?" Milestone 12: AI Usage Quota & Rate Limiting
-- Migration: 20260926000000_create_ai_quota.sql
-- ==============================================================================

-- 1. Create ai_usage_quotas table
CREATE TABLE IF NOT EXISTS public.ai_usage_quotas (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_date DATE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Note: We DO NOT enable RLS for direct client access.
-- The table is strictly hidden from direct REST API operations.
-- Only the SECURITY DEFINER function will interact with it.

-- 2. Revoke default public access
REVOKE ALL ON public.ai_usage_quotas FROM PUBLIC;
REVOKE ALL ON public.ai_usage_quotas FROM anon;
REVOKE ALL ON public.ai_usage_quotas FROM authenticated;

-- Service role must still have access for admin tasks
GRANT ALL ON public.ai_usage_quotas TO service_role;

-- 3. Create the highly-secure, atomic RPC function
-- This function runs with elevated privileges (SECURITY DEFINER) but explicitly 
-- relies on auth.uid() internally to ensure users can only increment their own quota.
CREATE OR REPLACE FUNCTION public.check_and_increment_ai_quota()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_current_date DATE;
  v_new_count INTEGER;
  v_limit INTEGER := 20; -- Server-defined quota limit (20 requests per UTC day)
BEGIN
  -- 1. Extract and verify authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 2. Determine current UTC date
  v_current_date := (now() AT TIME ZONE 'UTC')::DATE;

  -- 3. Atomic upsert to lock the row and safely increment
  INSERT INTO public.ai_usage_quotas (user_id, window_date, request_count, updated_at)
  VALUES (v_user_id, v_current_date, 1, now())
  ON CONFLICT (user_id) DO UPDATE SET
    request_count = CASE 
      WHEN ai_usage_quotas.window_date = v_current_date THEN ai_usage_quotas.request_count + 1
      ELSE 1 
    END,
    window_date = v_current_date,
    updated_at = now()
  RETURNING request_count INTO v_new_count;

  -- 4. Check limit (if they just requested and hit 21, deny it, but leave it recorded to log abuse)
  IF v_new_count > v_limit THEN
    RETURN json_build_object(
      'allowed', false,
      'count', v_new_count,
      'limit', v_limit
    );
  END IF;

  -- 5. Allowed
  RETURN json_build_object(
    'allowed', true,
    'count', v_new_count,
    'limit', v_limit
  );
END;
$$;

-- 4. Grant execute permissions explicitly to authenticated users
REVOKE EXECUTE ON FUNCTION public.check_and_increment_ai_quota() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_ai_quota() FROM anon;
GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_quota() TO authenticated;
