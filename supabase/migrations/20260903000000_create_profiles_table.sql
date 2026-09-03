-- ==============================================================================
-- BeBig 2.0 — Milestone 3: Profiles Table & Row Level Security (RLS)
-- Migration: 20260903000000_create_profiles_table.sql
-- ==============================================================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  goal TEXT CHECK (goal IN ('build_muscle', 'gain_strength', 'lose_fat')),
  experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  days_per_week INTEGER CHECK (days_per_week BETWEEN 2 AND 7),
  workout_duration TEXT CHECK (workout_duration IN ('30_min', '45_min', '60_min', '90_plus_min')),
  training_location TEXT DEFAULT 'gym' NOT NULL,
  equipment TEXT CHECK (equipment IN ('full_gym', 'limited_equipment')),
  preferred_training_days TEXT[] DEFAULT '{}' NOT NULL,
  workout_style TEXT CHECK (workout_style IN ('push_pull_legs', 'upper_lower', 'full_body')),
  onboarding_completed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Create index on primary lookup
CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles(id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: Strictly enforce that users can only access their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 5. Auto-update updated_at timestamp trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
