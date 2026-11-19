# BeBig 2.0 — Release State

## Production (Release `v2.5.2`)

- **URL**: https://be-big-2-0.vercel.app
- **Live Version**: `v2.5.2` (`package.json`, `app.json`, `/sw.js` `bebig-pwa-v2.5.2`)
- **Previous Verified Releases**: `v2.5.1` (`2d74de3`), `v2.5.0` (`68c7c38`), `v2.4.4` (`6be31bb`), `v2.4.3` (`2f88fd2`), `v2.4.2` (`0afb94b`)
- **Supabase Production Project**: `BeBig 2.0` (`gkkvxfroxthvbiecramm`, `ap-northeast-1`)
  - Applied SQL Migrations:
    - `20261118120000_atomic_super_admin_guard.sql`
    - `20261118120500_harden_avatars_storage_privacy.sql`
    - `20261118_admin_panel_m1.sql` (RBAC guard, `app_error_logs`, `app_announcements`)
    - `20261118_admin_panel_m2.sql` (`trainer_workout_templates`, `assigned_workouts`)
    - `20261118_admin_panel_m3.sql` (`global_exercise_catalog`, `get_admin_user_directory`, active announcements banner)
    - `20261119_admin_panel_m4.sql` (`admin_delete_user` RPC, `profiles.full_name`, `exercise-images` storage bucket)
  - Deployed Edge Functions: `admin-assign-role` (`ACTIVE`, v1, `verify_jwt: true`), `coach-agent` (`ACTIVE`, v14, `verify_jwt: true`), `delete-account` (`ACTIVE`, v3, `verify_jwt: true`), `coach-v2` (paused, untouched at v2)
- **Deployment Method**: Automatic Vercel deployment on `main` branch push + explicit Supabase CLI deployments

## Key Enhancements in `v2.5.2` (Astra Audit Hardening & Milestone 5)

- **`P0-01`**: Single-transaction atomic IndexedDB read-merge-write (`bebig_cross_tab_locks`) with zero await gaps inside transaction callbacks + Web Locks / storage lease contention fallback + deleted tombstone tracking.
- **`P0-02`**: Unified monotonic sequence CAS (`Math.max(revision, version)`) across `workoutStorage.ts` and `workoutRepository.ts` with explicit conflict return (`{ ok: false, conflict: true, persistedRevision, incomingRevision }`).
- **`P1-01`**: Complete local erasure of scoped completed workouts (`BASE_COMPLETED_WORKOUTS_KEY`) in `accountDeletionService.ts` with loud failure reporting if any key survives.
- **`P1-02`**: Zero-shift pagination in recursive cloud storage cleanup (`deleteUserStorageFolder`) across `avatars`, `exercise-photos`, and `exercise-demos` with fail-fast HTTP 500 error abort before auth deletion.
- **`P2-01`**: Upgraded `shell-quote` to `1.12.0` (`>= 1.11.0`) in `package-lock.json` resolving critical security vulnerability without breaking expo dependencies.
- **Milestone 5 Features**: Custom workout numeric keypad (`WorkoutNumericKeypad.tsx`) with kg and reps modes, admin diagnostics terminal copy all / copy row, upgraded home announcements banner, trainer templates catalog search with assigned workout normalization, and dedicated "Global" exercise filter.
- **`P3-02`**: Aligned `Auth.test.tsx` and `DropSetTrackingAndAnalytics.test.tsx` assertions to current production UI behavior.
- **`P3-03`**: Reconciled release state documentation and eliminated all contradictory legacy sections.

## Deployed Features in Production (`v2.5.2`)

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
