
-- ==============================================================================
-- BeBig 2.0 — Add personal fields to profiles
-- Migration: 20260919000000_add_profile_personal_fields.sql
-- ==============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS height NUMERIC,
  ADD COLUMN IF NOT EXISTS weight NUMERIC,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
