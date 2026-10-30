-- ==============================================================================
-- BeBig 2.0 — Custom Exercise Photos: Private Storage Bucket & Schema Migration
-- Migration: 20261016120000_create_exercise_photos_bucket.sql
-- ==============================================================================

-- 1. Ensure public.custom_exercises table has photo_path column
ALTER TABLE public.custom_exercises
  ADD COLUMN IF NOT EXISTS photo_path TEXT DEFAULT NULL;

-- 2. Create private 'exercise-photos' bucket (public = false) with 5MB limit
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exercise-photos',
  'exercise-photos',
  false,
  5242880, -- 5MB (5 * 1024 * 1024 bytes)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 3. Row Level Security Policies on storage.objects

-- Policy A: Authenticated users can view / generate signed URLs ONLY for photos in their own folder (${userId}/*)
DROP POLICY IF EXISTS "Users can access own exercise photos" ON storage.objects;
CREATE POLICY "Users can access own exercise photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'exercise-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy B: Authenticated users can upload photos ONLY to their own folder (${userId}/*)
DROP POLICY IF EXISTS "Users can upload own exercise photos" ON storage.objects;
CREATE POLICY "Users can upload own exercise photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'exercise-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy C: Authenticated users can update ONLY photos in their own folder (${userId}/*)
DROP POLICY IF EXISTS "Users can update own exercise photos" ON storage.objects;
CREATE POLICY "Users can update own exercise photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'exercise-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'exercise-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy D: Authenticated users can delete ONLY photos in their own folder (${userId}/*)
DROP POLICY IF EXISTS "Users can delete own exercise photos" ON storage.objects;
CREATE POLICY "Users can delete own exercise photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'exercise-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
