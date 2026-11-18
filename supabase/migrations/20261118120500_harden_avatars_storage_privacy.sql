-- ==============================================================================
-- BeBig 2.0 — Phase 2B: Harden Avatars Storage RLS Privacy (AUD-020)
-- Migration: 20261118120500_harden_avatars_storage_privacy.sql
--
-- Fixes overly permissive `SELECT` policy on `storage.objects` for `avatars`
-- bucket (`USING (bucket_id = 'avatars')`) which previously allowed any
-- authenticated user to enumerate all other users' avatar object paths.
--
-- Enforces strictly owner-scoped folder listing/selection:
--   `(storage.foldername(name))[1] = auth.uid()::text`
-- while preserving direct CDN rendering compatibility per DECISIONS.md.
-- ==============================================================================

DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated list access for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can list and read own avatar folder" ON storage.objects;

CREATE POLICY "Users can list and read own avatar folder"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
