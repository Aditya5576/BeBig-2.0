---
name: bebig-backend-security
description: >
  Enforces BeBig 2.0 Supabase RLS cross-account isolation, verified JWT auth in
  Deno Edge Functions, private storage ownership, PII scrubbing, and bare-metal
  Postgres 16/17 migration compatibility without Docker.
---

# BeBig Backend Security

Apply this skill when editing `supabase/migrations/`, `supabase/functions/`, or client-side Supabase auth/storage/telemetry code.

## Verified Repository Contracts

- **Supabase RLS Cross-Account Isolation (`supabase/migrations/20260903000000_create_profiles_table.sql`, `20260905000000_create_sync_tables.sql`)**:
  - Every user-owned table (`profiles`, `workout_sessions`, `workout_templates`, `custom_exercises`, etc.) MUST have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` and explicit `SELECT`/`INSERT`/`UPDATE`/`DELETE` policies scoped to `auth.uid() = user_id` (or `id` on `profiles`).
- **Verified JWT Auth in Deno Edge Functions (`supabase/functions/admin-assign-role/index.ts`, `delete-account/index.ts`, `coach-agent/index.ts`)**:
  - Require `req.headers.get('Authorization')` and return `401` if missing.
  - Verify the caller's JWT via `supabaseAdmin.auth.getUser(token)` or `supabaseClient.auth.getUser()` before executing privileged `SUPABASE_SERVICE_ROLE_KEY` operations.
  - Never trust client-supplied `userId` without matching it against the verified `user.id` from `getUser()`.
- **Private Storage Ownership (`supabase/migrations/20260913000000_create_avatars_storage_bucket.sql`)**:
  - Enforce `storage.objects` RLS policies scoping uploads, updates, and deletes to the authenticated owner's folder/UID.
- **PII Scrubbing (`supabase/functions/_shared/coach/server/adapters/index.ts`)**:
  - Truncate and sanitize error messages and telemetry payloads before logging so credentials, bearer tokens, emails, and health/PII fields are never emitted to logs.
- **Bare-Metal Postgres 16/17 Compatibility (No Docker)**:
  - Author idempotent SQL migrations (`IF NOT EXISTS`, `DROP POLICY IF EXISTS ...`) compatible with bare-metal Postgres 16/17 and Supabase CLI without requiring local Docker containers.
- **Protected Boundaries**:
  - Never modify `supabase/functions/coach-agent/` or `supabase/functions/coach-v2/`.
