-- ==============================================================================
-- BeBig 2.0 — Milestone 10: Sync Tables & Row Level Security (RLS)
-- Migration: 20260905000000_create_sync_tables.sql
-- ==============================================================================

-- 1. Helper Trigger Function: Maintain timestamps, future clock clamp, LWW conflict resolution & tombstone protection
CREATE OR REPLACE FUNCTION public.handle_sync_entity_mutation()
RETURNS TRIGGER AS $$
BEGIN
  -- Apply 5-minute future-clock clamp on client_updated_at to prevent permanent future locks
  NEW.client_updated_at = LEAST(COALESCE(NEW.client_updated_at, now()), now() + interval '5 minutes');

  -- On UPDATE (fired during direct updates and during ON CONFLICT (id) DO UPDATE in upserts):
  IF TG_OP = 'UPDATE' THEN
    -- Invariant 0: Stable identity and creation metadata are immutable
    NEW.id = OLD.id;
    NEW.user_id = OLD.user_id;
    NEW.created_at = OLD.created_at;

    -- Invariant 1: Existing cloud tombstone can NEVER be cleared or resurrected.
    -- Once a cloud record is deleted (OLD.deleted_at IS NOT NULL), incoming mutations cannot resurrect it.
    IF OLD.deleted_at IS NOT NULL THEN
      RETURN OLD;
    END IF;

    -- Invariant 2: Last-Write-Wins (LWW) rule against a live cloud record (OLD.deleted_at IS NULL).
    -- An incoming record with an older client_updated_at must never overwrite a newer cloud record.
    IF NEW.client_updated_at < OLD.client_updated_at THEN
      RETURN OLD;
    END IF;

    -- Invariant 3: Deterministic tie-breaking when client_updated_at timestamps are identical.
    -- Exception: A valid incoming tombstone (NEW.deleted_at IS NOT NULL) beats a live record (OLD.deleted_at IS NULL).
    -- For all other ties (e.g. live edit vs live edit), the cloud record wins deterministically.
    IF NEW.client_updated_at = OLD.client_updated_at AND NEW.deleted_at IS NULL THEN
      RETURN OLD;
    END IF;
  END IF;

  -- On INSERT, or valid winning UPDATE:
  -- Always enforce server-managed updated_at as synchronization watermark
  NEW.updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create public.workout_sessions table
CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_template_id TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status = 'completed'),
  total_duration INTEGER NOT NULL DEFAULT 0 CHECK (total_duration >= 0),
  total_volume NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_volume >= 0),
  completed_sets_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_sets_count >= 0),
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create public.workout_templates table
CREATE TABLE IF NOT EXISTS public.workout_templates (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create public.custom_exercises table
CREATE TABLE IF NOT EXISTS public.custom_exercises (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  category_name TEXT NOT NULL,
  primary_muscles JSONB NOT NULL DEFAULT '[]'::jsonb,
  secondary_muscles JSONB NOT NULL DEFAULT '[]'::jsonb,
  equipment JSONB NOT NULL DEFAULT '[]'::jsonb,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Attach mutation triggers to all three tables
DROP TRIGGER IF EXISTS trg_workout_sessions_sync ON public.workout_sessions;
CREATE TRIGGER trg_workout_sessions_sync
  BEFORE INSERT OR UPDATE ON public.workout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_sync_entity_mutation();

DROP TRIGGER IF EXISTS trg_workout_templates_sync ON public.workout_templates;
CREATE TRIGGER trg_workout_templates_sync
  BEFORE INSERT OR UPDATE ON public.workout_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_sync_entity_mutation();

DROP TRIGGER IF EXISTS trg_custom_exercises_sync ON public.custom_exercises;
CREATE TRIGGER trg_custom_exercises_sync
  BEFORE INSERT OR UPDATE ON public.custom_exercises
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_sync_entity_mutation();

-- 6. Indexes for synchronization and querying

-- workout_sessions indexes
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_id ON public.workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_sync ON public.workout_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_history ON public.workout_sessions(user_id, finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_deleted_at ON public.workout_sessions(user_id, deleted_at) WHERE deleted_at IS NOT NULL;

-- workout_templates indexes
CREATE INDEX IF NOT EXISTS idx_workout_templates_user_id ON public.workout_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_templates_sync ON public.workout_templates(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_templates_deleted_at ON public.workout_templates(user_id, deleted_at) WHERE deleted_at IS NOT NULL;

-- custom_exercises indexes
CREATE INDEX IF NOT EXISTS idx_custom_exercises_user_id ON public.custom_exercises(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_exercises_sync ON public.custom_exercises(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_custom_exercises_deleted_at ON public.custom_exercises(user_id, deleted_at) WHERE deleted_at IS NOT NULL;

-- 7. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_exercises ENABLE ROW LEVEL SECURITY;

-- Note on Deletion Policy:
-- Hard DELETE is strictly prohibited in V1 to ensure synchronization safety across devices.
-- Deletions must be performed as soft-delete updates setting `deleted_at = now()`.
-- With RLS enabled, omitting FOR DELETE policies ensures any direct DELETE statement is rejected by PostgreSQL.

-- 8. RLS Policies: workout_sessions
CREATE POLICY "Users can view own workout sessions"
  ON public.workout_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workout sessions"
  ON public.workout_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workout sessions"
  ON public.workout_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 9. RLS Policies: workout_templates
CREATE POLICY "Users can view own workout templates"
  ON public.workout_templates
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workout templates"
  ON public.workout_templates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workout templates"
  ON public.workout_templates
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 10. RLS Policies: custom_exercises
CREATE POLICY "Users can view own custom exercises"
  ON public.custom_exercises
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own custom exercises"
  ON public.custom_exercises
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own custom exercises"
  ON public.custom_exercises
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

