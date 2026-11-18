-- ==============================================================================
-- BeBig 2.0 — Phase 2B: Atomic Super-Admin Guard & Transactional Role Mutation (AUD-019)
-- Migration: 20261118120000_atomic_super_admin_guard.sql
--
-- Enforces:
-- 1. Database-level invariant preventing deletion or demotion of the final
--    remaining `super_admin` via a transaction-scoped advisory lock trigger
--    (immune to concurrent race conditions).
-- 2. Atomic RPC `public.admin_mutate_role_atomic(...)` executing caller
--    authorization, role enum validation, self-demotion protection, target user
--    existence check, role mutation, and `admin_audit_logs` insertion in a
--    single ACID transaction (audit insert failure rolls back the role change).
-- ==============================================================================

-- 1. Trigger guard: NEVER allow deletion or demotion of the last super_admin
CREATE OR REPLACE FUNCTION public.enforce_last_super_admin_invariant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_super_admins INTEGER;
BEGIN
  -- Serialize concurrent super_admin mutations within the transaction
  PERFORM pg_advisory_xact_lock(hashtext('public.admin_roles:super_admin_guard'));

  -- Only enforce when removing a super_admin row or demoting a super_admin to another role
  IF (TG_OP = 'DELETE' AND OLD.role = 'super_admin')
     OR (TG_OP = 'UPDATE' AND OLD.role = 'super_admin' AND NEW.role <> 'super_admin') THEN
    SELECT COUNT(*)
      INTO remaining_super_admins
      FROM public.admin_roles
     WHERE role = 'super_admin'
       AND user_id <> OLD.user_id;

    IF remaining_super_admins < 1 THEN
      RAISE EXCEPTION 'CANNOT_REMOVE_LAST_SUPER_ADMIN: At least one super_admin must remain.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_last_super_admin_trigger ON public.admin_roles;
CREATE TRIGGER protect_last_super_admin_trigger
  BEFORE DELETE OR UPDATE ON public.admin_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_last_super_admin_invariant();

-- 2. Atomic Transactional RPC for Super-Admin Role Assignment / Removal + Audit Log
CREATE OR REPLACE FUNCTION public.admin_mutate_role_atomic(
  p_actor_id UUID,
  p_target_user_id UUID,
  p_action TEXT,
  p_role TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_role TEXT;
  v_target_exists BOOLEAN;
  v_previous_role TEXT;
BEGIN
  -- Serialize concurrent admin role mutations atomically
  PERFORM pg_advisory_xact_lock(hashtext('public.admin_roles:super_admin_guard'));

  -- Verify actor is an active super_admin
  SELECT role INTO v_actor_role
    FROM public.admin_roles
   WHERE user_id = p_actor_id;

  IF v_actor_role IS NULL OR v_actor_role <> 'super_admin' THEN
    RAISE EXCEPTION 'FORBIDDEN: Caller must hold super_admin privilege.'
      USING ERRCODE = '42501';
  END IF;

  -- Validate action
  IF p_action NOT IN ('assign', 'remove') THEN
    RAISE EXCEPTION 'INVALID_ACTION: Action must be assign or remove.'
      USING ERRCODE = '22023';
  END IF;

  -- Validate target user exists in auth.users
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id)
    INTO v_target_exists;

  IF NOT v_target_exists THEN
    RAISE EXCEPTION 'TARGET_NOT_FOUND: Target user does not exist.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Capture existing role (if any) for audit metadata
  SELECT role INTO v_previous_role
    FROM public.admin_roles
   WHERE user_id = p_target_user_id;

  -- Enforce self-mutation safety: a super_admin cannot demote or remove themselves
  IF p_actor_id = p_target_user_id AND (p_action = 'remove' OR COALESCE(p_role, '') <> 'super_admin') THEN
    RAISE EXCEPTION 'SELF_DEMOTION_FORBIDDEN: Super admins cannot demote or remove their own super_admin privilege.'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_action = 'assign' THEN
    IF p_role IS NULL OR p_role NOT IN ('super_admin', 'admin', 'coach', 'support', 'content_manager', 'developer') THEN
      RAISE EXCEPTION 'INVALID_ROLE: Unsupported admin role specified.'
        USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.admin_roles (user_id, role)
    VALUES (p_target_user_id, p_role)
    ON CONFLICT (user_id)
    DO UPDATE SET role = EXCLUDED.role, updated_at = now();

    INSERT INTO public.admin_audit_logs (
      actor_id,
      action,
      target_type,
      target_id,
      result,
      metadata
    )
    VALUES (
      p_actor_id,
      'ASSIGN_ROLE',
      'USER',
      p_target_user_id::text,
      'SUCCESS',
      jsonb_build_object(
        'role', p_role,
        'previous_role', v_previous_role
      )
    );
  ELSE
    DELETE FROM public.admin_roles
     WHERE user_id = p_target_user_id;

    INSERT INTO public.admin_audit_logs (
      actor_id,
      action,
      target_type,
      target_id,
      result,
      metadata
    )
    VALUES (
      p_actor_id,
      'REMOVE_ROLE',
      'USER',
      p_target_user_id::text,
      'SUCCESS',
      jsonb_build_object(
        'previous_role', v_previous_role
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'action', p_action,
    'target_user_id', p_target_user_id,
    'role', p_role
  );
END;
$$;

-- Restrict RPC execution strictly to service_role (Edge Functions only)
REVOKE ALL ON FUNCTION public.admin_mutate_role_atomic(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_mutate_role_atomic(UUID, UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.admin_mutate_role_atomic(UUID, UUID, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mutate_role_atomic(UUID, UUID, TEXT, TEXT) TO service_role;
