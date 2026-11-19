# BeBig 2.0 — Release State

## Production (Live Release — `v2.6.0`)

- **URL**: https://be-big-2-0.vercel.app
- **Live Version**: `v2.6.0` (`package.json`, `app.json`, `/sw.js` `bebig-pwa-v2.6.0`)
- **Previous Verified Releases**: `v2.5.2` (`96849ee`), `v2.5.1` (`2d74de3`), `v2.5.0` (`68c7c38`), `v2.4.4` (`6be31bb`), `v2.4.3` (`2f88fd2`), `v2.4.2` (`0afb94b`)
- **Supabase Production Project**: `BeBig 2.0` (`gkkvxfroxthvbiecramm`, `ap-northeast-1`)
  - Applied SQL Migrations:
    - `20261118120000_atomic_super_admin_guard.sql`
    - `20261118120500_harden_avatars_storage_privacy.sql`
    - `20261118_admin_panel_m1.sql` (RBAC guard, `app_error_logs`, `app_announcements`)
    - `20261118_admin_panel_m2.sql` (`trainer_workout_templates`, `assigned_workouts`)
    - `20261118_admin_panel_m3.sql` (`global_exercise_catalog`, `get_admin_user_directory`, active announcements banner)
    - `20261119_admin_panel_m4.sql` (`admin_delete_user` RPC, `profiles.full_name`, `exercise-images` storage bucket)
    - `20261119_wger_exercise_catalog.sql` (`public.wger_exercise_catalog` table with 14 columns, RLS read policy for anon/authenticated, service_role write policy)
  - Deployed Edge Functions:
    - `sync-wger-catalog` (`ACTIVE`, v1, `verify_jwt: false` with `CRON_SECRET` / bearer auth, canonical licensing filter)
    - `admin-assign-role` (`ACTIVE`, v1, `verify_jwt: true`)
    - `coach-agent` (`ACTIVE`, v14, `verify_jwt: true`)
    - `delete-account` (`ACTIVE`, v3, `verify_jwt: true`)
    - `coach-v2` (paused, untouched at v2)
- **Deployment Method**: Automatic Vercel deployment on `main` branch push + explicit Supabase CLI deployments

## Key Enhancements in `v2.6.0` (Server-Side Wger Catalog, expo-image Caching, Zod Validation & CI Hardening)

- **Tier 2 Server-Side Wger Catalog & Ingestion**:
  - `public.wger_exercise_catalog` remote PostgreSQL table with full attribution fields (`license_name`, `license_author`, `attribution_text`).
  - `sync-wger-catalog` Edge Function with exact canonical allowlist (`CC-BY-SA 4/3`, `CC-BY 4/3`, `CC0`), author attribution preservation, and initial verified 20-exercise batch ingestion.
- **`expo-image` Transition**:
  - Migrated legacy `<Image>` to `expo-image` across `app/exercises/[id].tsx`, `src/features/exercises/components/ExerciseThumbnail.tsx`, `app/home.tsx`, and `app/settings.tsx`.
  - Automatic memory and disk caching (`cachePolicy="disk"`), smooth cross-dissolve transitions, and placeholder fallbacks on load failures.
- **Tier 1 Reliability & Hygiene**:
  - Zod boundary validation for untrusted external payloads (`wgerMapper.ts`).
  - Strict HTTPS URL validation for external images (`WgerExerciseProvider.ts`).
  - Safe JSON metadata parsing (`syncMetadataStore.ts`).
  - Bounded Sentry error logging with scrubbed PII (`errorMonitoring.ts`).
  - Hardened GitHub Actions CI workflow (`.github/workflows/ci.yml`) with parallel typecheck, lint, test, and security audit jobs.
- **Codex Audit Resolution (`P1`, `P2`, `P3`)**:
  - `P1`: Exact canonical license set matching in `wgerLicense.ts` and `sync-wger-catalog/index.ts` (rejected substring tricks and author inference).
  - `P2`: Added `onError` fallback handlers and placeholder badges in exercise detail and settings avatar preview.
  - `P3`: Aligned error monitoring test to release version and eliminated whitespace/import issues.

## Deployed Features in Production (`v2.6.0`)

- **Admin Control Panel Full Milestones (M1-M4)**:
  - Role-Based Access Control (`super_admin` / `admin` via `admin_roles`), system diagnostics terminal, athlete announcements.
  - User Directory with search, profile inspection, and two-step athlete deletion (`admin_delete_user`).
  - Trainer Workout Template Builder with client assignment and offline caching.
  - Global Exercise Catalog with offscreen canvas image downscaling to `exercise-images` bucket.
  - Responsive layout eliminating double/triple navigation bars on mobile (`width < 768px`).
- **Two-Layer Live iPhone PWA Crash & SW Auto-Reload Fix (`v2.4.3`)**:
  - `bebig-pwa-v2.5.2` Service Worker with Network-First JS bundle caching.
  - Zero-bitmap picker + legacy photo compaction preventing WebKit GPU memory spikes.
- **Carry-Forward Features**: Self-Service Account Deletion (`AUD-006`), Legal & Terms routes (`AUD-007`), Erase Local Device Data (`AUD-011`), Active-Workout Guest Migration (`AUD-002`), CI Quality Gate (`AUD-004`), Secret & Backup Containment (`AUD-001`), Cross-Platform Web Build (`AUD-009`).

## Permanent Exclusions & Deferred Boundaries

- **`AUD-008`** (`app/+html.tsx` viewport zoom lock): Permanently excluded by policy.
- **M2 Timer Notifications Audit & AI Coach V2** (`app/coach/`, `src/features/coach/`, `supabase/functions/coach-v2/`): Paused / deferred.

## Release Rule

1. Verify locally (`typecheck`, `lint`, full Jest suite, `build:web`).
2. Obtain explicit user approval before committing, pushing, running migrations, or deploying Edge Functions.
3. Validate live production URL, Service Worker cache version, and physical iPhone PWA behavior after release.

> **Important**: Do not delete or overwrite this state file during normal development.
