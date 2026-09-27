-- ==============================================================================
-- BeBig 2.0 - Milestone SCHED-1: Scheduled Workouts
-- Migration: 20260926131100_create_scheduled_workouts_table.sql
-- ==============================================================================

-- 1. Create public.scheduled_workouts table
CREATE TABLE IF NOT EXISTS public.scheduled_workouts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id TEXT NULL REFERENCES public.workout_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TEXT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'skipped')),
  completed_session_id TEXT NULL REFERENCES public.workout_sessions(id) ON DELETE SET NULL,
  notes TEXT NULL,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Attach mutation trigger for sync engine compatibility
DROP TRIGGER IF EXISTS trg_scheduled_workouts_sync ON public.scheduled_workouts;
CREATE TRIGGER trg_scheduled_workouts_sync
  BEFORE INSERT OR UPDATE ON public.scheduled_workouts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_sync_entity_mutation();

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_workouts_user_id ON public.scheduled_workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_workouts_sync ON public.scheduled_workouts(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_workouts_deleted_at ON public.scheduled_workouts(user_id, deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_workouts_date ON public.scheduled_workouts(user_id, scheduled_date);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.scheduled_workouts ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
CREATE POLICY "Users can insert their own scheduled workouts"
  ON public.scheduled_workouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own scheduled workouts"
  ON public.scheduled_workouts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled workouts"
  ON public.scheduled_workouts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled workouts"
  ON public.scheduled_workouts FOR DELETE
  USING (auth.uid() = user_id);

-- Note on Deletion Policy:
-- Hard DELETE is strictly prohibited in V1 to ensure synchronization safety across devices.
-- Deletions must be performed as soft-delete updates setting `deleted_at = now()`.
