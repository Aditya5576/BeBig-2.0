-- ==============================================================================
-- BeBig 2.0 — Milestone 4A: Admin User Management RPCs
-- Migration: 20260917103255_admin_user_management.sql
-- ==============================================================================

-- Function 1: admin_get_users
CREATE OR REPLACE FUNCTION public.admin_get_users(
    search_term TEXT DEFAULT NULL,
    filter_onboarding BOOLEAN DEFAULT NULL,
    filter_role TEXT DEFAULT NULL,
    page_limit INT DEFAULT 50,
    page_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    email VARCHAR,
    display_name TEXT,
    created_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    onboarding_completed BOOLEAN,
    role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- 1. Enforce backend authorization: Only super_admin and admin
    IF NOT EXISTS (
        SELECT 1 FROM public.admin_roles
        WHERE user_id = auth.uid() AND admin_roles.role IN ('super_admin', 'admin')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Requires admin privileges.';
    END IF;

    -- 2. Enforce bounds on pagination to prevent client unbounding
    IF page_limit IS NULL OR page_limit > 100 THEN
        page_limit := 100;
    END IF;
    IF page_limit < 1 THEN
        page_limit := 1;
    END IF;
    IF page_offset IS NULL OR page_offset < 0 THEN
        page_offset := 0;
    END IF;

    -- 3. Return securely joined data
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        p.display_name,
        u.created_at,
        u.last_sign_in_at,
        COALESCE(p.onboarding_completed, false) AS onboarding_completed,
        r.role
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.id
    LEFT JOIN public.admin_roles r ON u.id = r.user_id
    WHERE 
        (search_term IS NULL OR search_term = '' OR 
         u.email ILIKE '%' || search_term || '%' OR 
         p.display_name ILIKE '%' || search_term || '%' OR 
         u.id::text ILIKE '%' || search_term || '%')
        AND (filter_onboarding IS NULL OR COALESCE(p.onboarding_completed, false) = filter_onboarding)
        AND (filter_role IS NULL OR filter_role = '' OR r.role = filter_role)
    ORDER BY u.created_at DESC, u.id
    LIMIT page_limit OFFSET page_offset;
END;
$$;

-- Revoke public execution to ensure safety
REVOKE EXECUTE ON FUNCTION public.admin_get_users(TEXT, BOOLEAN, TEXT, INT, INT) FROM public;
REVOKE EXECUTE ON FUNCTION public.admin_get_users(TEXT, BOOLEAN, TEXT, INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_users(TEXT, BOOLEAN, TEXT, INT, INT) TO authenticated;


-- Function 2: admin_get_user_details
CREATE OR REPLACE FUNCTION public.admin_get_user_details(
    target_user_id UUID
)
RETURNS TABLE (
    id UUID,
    email VARCHAR,
    created_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    display_name TEXT,
    onboarding_completed BOOLEAN,
    height TEXT,
    weight TEXT,
    age INT,
    goal TEXT,
    experience_level TEXT,
    days_per_week INT,
    workout_duration TEXT,
    equipment TEXT,
    preferred_training_days TEXT[],
    workout_style TEXT,
    role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- 1. Enforce backend authorization: Only super_admin and admin
    IF NOT EXISTS (
        SELECT 1 FROM public.admin_roles
        WHERE user_id = auth.uid() AND admin_roles.role IN ('super_admin', 'admin')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Requires admin privileges.';
    END IF;

    -- 2. Return exact specific user details
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.created_at,
        u.last_sign_in_at,
        p.display_name,
        COALESCE(p.onboarding_completed, false) AS onboarding_completed,
        (u.raw_user_meta_data->>'height')::TEXT AS height,
        (u.raw_user_meta_data->>'weight')::TEXT AS weight,
        (u.raw_user_meta_data->>'age')::INT AS age,
        p.goal,
        p.experience_level,
        p.days_per_week,
        p.workout_duration,
        p.equipment,
        p.preferred_training_days,
        p.workout_style,
        r.role
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.id
    LEFT JOIN public.admin_roles r ON u.id = r.user_id
    WHERE u.id = target_user_id;
END;
$$;

-- Revoke public execution to ensure safety
REVOKE EXECUTE ON FUNCTION public.admin_get_user_details(UUID) FROM public;
REVOKE EXECUTE ON FUNCTION public.admin_get_user_details(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_user_details(UUID) TO authenticated;
