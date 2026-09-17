-- ==============================================================================
-- BeBig 2.0 — Milestone 2: Admin Security Foundation
-- Migration: 20260916180500_create_admin_security_foundation.sql
-- ==============================================================================

-- 1. Create admin_roles table
CREATE TABLE IF NOT EXISTS public.admin_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'coach', 'support', 'content_manager', 'developer')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for querying roles
CREATE INDEX IF NOT EXISTS idx_admin_roles_role ON public.admin_roles(role);

-- Enable RLS
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only read their own role (no INSERT/UPDATE/DELETE to prevent escalation)
CREATE POLICY "Users can view own admin role"
  ON public.admin_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Create admin_audit_logs table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  result TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor ON public.admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS: Only Super Admins and Admins can view audit logs (using subquery)
CREATE POLICY "Admins can view audit logs"
  ON public.admin_audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE admin_roles.user_id = auth.uid()
      AND admin_roles.role IN ('super_admin', 'admin')
    )
  );
-- No INSERT/UPDATE/DELETE policies - must use service_role (Edge Functions / Triggers)

-- 3. Create coach_client_relationships table (Foundation)
CREATE TABLE IF NOT EXISTS public.coach_client_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'terminated')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(coach_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_client_relationships_coach ON public.coach_client_relationships(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_client_relationships_client ON public.coach_client_relationships(client_id);

-- Enable RLS
ALTER TABLE public.coach_client_relationships ENABLE ROW LEVEL SECURITY;

-- RLS: Coaches and clients can see their own relationships
CREATE POLICY "Users can view their own coaching relationships"
  ON public.coach_client_relationships
  FOR SELECT
  USING (auth.uid() = coach_id OR auth.uid() = client_id);

-- RLS: Admins can see all relationships
CREATE POLICY "Admins can view all coaching relationships"
  ON public.coach_client_relationships
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE admin_roles.user_id = auth.uid()
      AND admin_roles.role IN ('super_admin', 'admin')
    )
  );
-- No INSERT/UPDATE/DELETE policies - managed by service_role (Super Admin/System)

-- 4. Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_admin_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_admin_roles_updated_at ON public.admin_roles;
CREATE TRIGGER set_admin_roles_updated_at
  BEFORE UPDATE ON public.admin_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_admin_updated_at();

DROP TRIGGER IF EXISTS set_coach_client_updated_at ON public.coach_client_relationships;
CREATE TRIGGER set_coach_client_updated_at
  BEFORE UPDATE ON public.coach_client_relationships
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_admin_updated_at();
