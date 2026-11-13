-- ==============================================================================
-- BeBig 2.0 — Phase 2, Milestone M1: Exercise Demonstration Media CDN Bucket
-- Migration: 20261112120000_create_exercise_demos_bucket.sql
-- ==============================================================================
-- Creates the public 'exercise-demos' bucket in Supabase Storage with:
-- 1. Public = true for direct CDN image/GIF delivery without token latency.
-- 2. 10MB file size ceiling (10 * 1024 * 1024 bytes) for high-res demonstration media.
-- 3. Strict MIME type restrictions: image/png, image/jpeg, image/webp, image/gif.
-- 4. Public read-only SELECT policy on storage.objects.
-- 5. Service-role-only write policies (INSERT, UPDATE, DELETE) for ingest scripts.
-- ==============================================================================

-- 1. Create or update 'exercise-demos' bucket in Supabase Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exercise-demos',
  'exercise-demos',
  true,
  10485760, -- 10MB (10 * 1024 * 1024 bytes)
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

-- 2. Row Level Security Policies on storage.objects for 'exercise-demos'

-- Policy A: Public read access for CDN delivery
DROP POLICY IF EXISTS "Public read access for exercise demos" ON storage.objects;
CREATE POLICY "Public read access for exercise demos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'exercise-demos');

-- Policy B: Service role only insert access
DROP POLICY IF EXISTS "Service role can insert exercise demos" ON storage.objects;
CREATE POLICY "Service role can insert exercise demos"
  ON storage.objects
  FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'exercise-demos');

-- Policy C: Service role only update access
DROP POLICY IF EXISTS "Service role can update exercise demos" ON storage.objects;
CREATE POLICY "Service role can update exercise demos"
  ON storage.objects
  FOR UPDATE
  TO service_role
  USING (bucket_id = 'exercise-demos')
  WITH CHECK (bucket_id = 'exercise-demos');

-- Policy D: Service role only delete access
DROP POLICY IF EXISTS "Service role can delete exercise demos" ON storage.objects;
CREATE POLICY "Service role can delete exercise demos"
  ON storage.objects
  FOR DELETE
  TO service_role
  USING (bucket_id = 'exercise-demos');

