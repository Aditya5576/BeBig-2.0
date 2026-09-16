-- ==============================================================================
-- BeBig 2.0 — Milestone 11: Avatars Storage Bucket & Row Level Security (RLS)
-- Migration: 20260913000000_create_avatars_storage_bucket.sql
-- ==============================================================================

-- 1. Ensure public.profiles table has avatar_url and display_name columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 2. Create 'avatars' bucket in Supabase Storage with 2MB limit and image-only MIME types
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB (2 * 1024 * 1024 bytes)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 3. Row Level Security Policies on storage.objects

-- Policy A: Authenticated list access for avatars
-- Anonymous file listing via PostgREST SELECT is blocked. Public CDN image URLs work directly via bucket public=true.
DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated list access for avatars" ON storage.objects;
CREATE POLICY "Authenticated list access for avatars"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

-- Policy B: Authenticated users can upload an avatar ONLY to their own folder (${userId}/*)
-- Uses storage.foldername helper to extract the top-level directory and match auth.uid()
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy C: Authenticated users can update ONLY their own avatar in their own folder
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy D: Authenticated users can delete ONLY their own avatar in their own folder
-- Strictly prevents deleting other users' objects or files outside their own folder
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
