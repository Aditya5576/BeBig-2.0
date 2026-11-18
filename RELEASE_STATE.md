# BeBig 2.0 — Release State

## Production (Live Verified — `v2.4.3`)

- **URL**: https://be-big-2-0.vercel.app
- **Live Version**: `v2.4.3` (`package.json`, `app.json`, `/sw.js` `bebig-pwa-v2.4.3`)
- **Live Release Commit**: `2f88fd254578dff1ddebccb50124fc3b825c06e6` (tag `v2.4.3`)
- **Vercel Production Deployment**: `dpl_G3AZFkELZTWHJQw6gynxWuSTkvFW` (`● Ready`, `2m 50s` build, 45 static routes, `/sw.js` serving `bebig-pwa-v2.4.3` with Network-First JS handler)
- **Previous Verified Release**: `v2.4.2` (`0afb94bcfc2fcc67d2ac7e04c167c115153e4816`, Vercel `dpl_DBpWdWmqRb1BU1jQXtFoHfdxvKYE`)
- **Supabase Production Project**: `BeBig 2.0` (`gkkvxfroxthvbiecramm`, `ap-northeast-1`)
  - Applied `v2.4.3` SQL Migrations: `20261118120000_atomic_super_admin_guard.sql`, `20261118120500_harden_avatars_storage_privacy.sql`
  - Deployed Edge Functions: `admin-assign-role` (`ACTIVE`, v1, `verify_jwt: true`), `coach-agent` (`ACTIVE`, v14, `verify_jwt: true`), `delete-account` (`ACTIVE`, v2, `verify_jwt: true`), `coach-v2` (paused, untouched at v2)
- **Deployment Method**: Automatic Vercel deployment on `main` branch push + explicit Supabase CLI deployments

## Deployed Features in Production (`v2.4.3`)
- **Two-Layer Live iPhone PWA Crash & SW Auto-Reload Fix (`v2.4.3`)**:
  - **Layer 1 (JS Bundle Freshness + Automatic SW Recovery)**: Bumped `public/sw.js` cache to `bebig-pwa-v2.4.3`, added **Network-First** caching for `/_expo/static/js/` and `.js` bundles, and wired `reg.update()` + `controllerchange` single-reload recovery (`sessionStorage` guard `bebig_sw_reloaded_v243`) in `app/_layout.tsx`.
  - **Layer 2 (Zero-Bitmap Picker + Legacy Photo Compaction)**: Stripped `images` and `imageUrl` payloads from `ExercisePickerModal` (`FlatList` & `RECENTLY USED`) via `stripExerciseImagePayloads()` and added non-blocking sequential background compaction (`compactOversizedCustomExercises` / `downscaleDataUrlToMaxEdge`) for legacy oversized (`>150KB`) custom exercise photos on web.
- **Phase 2B Security Hardening (`AUD-005`, `AUD-010`, `AUD-012`, `AUD-013`, `AUD-019`, `AUD-020`)**:
  - `AUD-005`: Removed `xlsx@0.18.5`; replaced with zero-dependency pure-TS OOXML writer (`ooxmlWorkbook.ts`) + formula-injection neutralization (`-416KB` export bundle).
  - `AUD-010`: Shared allowlisted CORS (`Vary: Origin`), `405` guards, bounded JSON caps, and `correlation_id` error redaction across `admin-assign-role`, `coach-agent`, and `delete-account`.
  - `AUD-012`: Hardened `vercel.json` with HSTS (`max-age=63072000; includeSubDomains`), `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and functional CSP.
  - `AUD-013`: Shell-only Service Worker navigation caching + `Cache-Control: no-store/private` bypass + `/functions/` & `/storage/` exclusion in `public/sw.js`.
  - `AUD-019`: Applied `20261118120000_atomic_super_admin_guard.sql` (`protect_last_super_admin_trigger` + `service_role`-only `admin_mutate_role_atomic` RPC).
  - `AUD-020`: Applied `20261118120500_harden_avatars_storage_privacy.sql` (owner-scoped `SELECT` RLS on `storage.objects`) + web JPEG EXIF stripping (`avatarService.sanitizeWebAvatarImage()`).
- **Phase 3 Storage Resilience, Hook Hygiene & Input Bounds (`AUD-015`, `AUD-017`, `AUD-018`, `AUD-022`, `AUD-024`, `AUD-026`, `AUD-034`)**:
  - `AUD-017` / `AUD-018`: Native `SecureStore` >1800B `FileSystem` spillover, structured zero-PII storage error classification, and web `QuotaExceededError` catalog cache eviction + retry.
  - `AUD-015`: Eliminated all `react-hooks/exhaustive-deps` warnings across active workout, timer, template, exercise detail, and progress screens.
  - `AUD-024` / `AUD-026`: Centralized `DOMAIN_LIMITS` + `clampText` input bounds and added granular `<ErrorBoundary>` wrappers across `/workout/active`, `/settings`, `/workout/progress/weekly`, and `/workout/progress/prs`.
- **Carry-Forward Features (`v2.4.2`)**: Self-Service Account Deletion (`AUD-006`), Legal & Terms routes (`AUD-007`), Erase Local Device Data (`AUD-011`), Active-Workout Guest Migration (`AUD-002`), CI Quality Gate (`AUD-004`), Secret & Backup Containment (`AUD-001`), Cross-Platform Web Build (`AUD-009`).

## Permanent Exclusions & Deferred Boundaries

- **`AUD-008`** (`app/+html.tsx` viewport zoom lock): Permanently excluded by policy.
- **M2 Timer Notifications Audit & AI Coach V2** (`app/coach/`, `src/features/coach/`, `supabase/functions/coach-v2/`): Paused / deferred.

## Release Rule

1. Verify locally (`typecheck`, `lint`, full Jest suite, `build:web`).
2. Obtain explicit user approval before committing, pushing, running migrations, or deploying Edge Functions.
3. Validate live production URL, Service Worker cache version, and physical iPhone PWA behavior after release.

> **Important**: Do not delete or overwrite this state file during normal development.
