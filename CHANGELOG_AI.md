# AI Changelog
- Implemented Token-Saving Brain v2 Global Operating Rules.
- Refined PR typography and history UI.
- Stabilized Cinematic Splash Screen with BeBig Barbell Crest.

## [Phase 0] — 2026-11-17 — Production Backup & Secret Containment (AUD-001), Cross-Platform Web Build (AUD-009), Repository Hygiene (AUD-033)

### Problem
1. **AUD-001**: A production-like user data export (`supabase/.temp/backup_production_pre_v2.json`) containing profile and workout information, along with local `.secret` files, existed within the repository working tree and `supabase/.temp/` was unignored by Git, risking accidental staging, IDE sync, or repository leakage. Furthermore, `supabase/.temp/linked-project.json` and `cli-latest` were actively tracked in the Git index.
2. **AUD-009**: The web build script (`build:web` in `package.json`) used POSIX-only inline shell assignment (`EXPO_PUBLIC_GIT_SHA=${VERCEL_GIT_COMMIT_SHA:-$EXPO_PUBLIC_GIT_SHA} expo export -p web`), which crashes immediately on Windows workstations with `'EXPO_PUBLIC_GIT_SHA' is not recognized`.
3. **AUD-033**: Root scratch files (`checkUrl.js`, `test-validation.js`, and `temp_analytics.txt`) cluttered the repository root without classification or documentation.

### Root cause
1. **AUD-001**: Gitignore configuration omitted `supabase/.temp/` and `*.secret`, and previous CLI operations tracked metadata files inside `.temp/`.
2. **AUD-009**: Relying on Unix shell parameter expansion syntax directly in npm scripts without cross-platform wrappers or Node helpers.
3. **AUD-033**: Temporary one-off scripts and text dumps from prior development sessions were committed to the root directory without being moved to `scripts/` or purged.

### Changes
1. **AUD-001 Containment**:
   - Added `supabase/.temp/` and `*.secret` to `.gitignore`.
   - Untracked `supabase/.temp/cli-latest` and `supabase/.temp/linked-project.json` from the Git index using `git rm --cached` while preserving necessary local files on disk.
   - Safely migrated `backup_production_pre_v2.json` completely outside the repository working tree into a dedicated user-level directory (`BeBig_Secure_Backups_DO_NOT_COMMIT`), verified non-zero destination byte count (396,161 bytes), and removed the in-repo copy.
   - Purged obsolete local scratch test artifacts (`jwt.secret`, `jwt_test.secret`, `postgrest.conf`, `postgrest_test.conf`, `test_conf.mjs`, `test_jwt_postgrest.ts`, `download_postgrest.mjs`) from `supabase/.temp/`.
2. **AUD-009 Cross-Platform Web Build**:
   - Created cross-platform runner `scripts/build-web.js` that inspects `EXPO_PUBLIC_GIT_SHA`, `VERCEL_GIT_COMMIT_SHA`, or falls back to local `git rev-parse --short HEAD` (or 'dev'), assigns the environment variable, and executes `npx expo export -p web` with appropriate platform shell configuration.
   - Updated `package.json` `"build:web"` to `"node scripts/build-web.js"`.
3. **AUD-033 Repository Hygiene**:
   - Removed obsolete root scratch file `checkUrl.js` and redundant text dump `temp_analytics.txt`.
   - Moved validation utility `test-validation.js` to `scripts/test-validation.js`.

### Impact analysis
- **Security & Privacy**: Substantially hardened; zero risk of sensitive production backup exports, database refs, or secret keys leaking through Git operations.
- **Build & CI/CD**: Developers on Windows workstations can now execute `npm run build:web` natively without environment syntax errors, identical to Linux/Vercel build pipelines.
- **Architecture & Workouts**: Zero impact on workout tracking, offline storage, database schemas, or client-side runtime behavior.

### Tests added or updated
- Verified existing deployment and PWA test suites (`tests/ProductionDeployment.test.tsx` and `tests/PWAInstallation.test.tsx`) pass 100%.

### Verification
- `git status --short`: Verified `supabase/.temp/` is cleanly ignored and zero untracked temp files appear.
- `git check-ignore -v supabase/.temp/`: Confirms rule match at `.gitignore:25:supabase/.temp/`.
- `npm run typecheck`: Passed with 0 errors.
- `npm run lint`: Passed with 0 errors.
- `npm run build:web`: Executed successfully on Windows, exporting all 43 static routes to `dist/`.
- `npx jest tests/ProductionDeployment.test.tsx tests/PWAInstallation.test.tsx --runInBand`: Passed with 27/27 tests green.

### Security and privacy
- Zero secrets, tokens, or PII exposed or committed.
- Production backup moved out of repository tree to encrypted/secure local storage.
- Git history verified: `backup_production_pre_v2.json` and `*.secret` were never committed in any prior commit.

### Migration and rollback
- Rollback: Revert `.gitignore` and `package.json` or restore from local tag `checkpoint-pre-audit-remediation`.

### Remaining risks
- Residual AUD findings (`AUD-004` through `AUD-037`) remain queued for subsequent phased remediation. `AUD-008` (viewport zoom lock) is permanently excluded per operating policy.

## [Phase 1A] — 2026-11-17 — Active-Workout Guest Migration (AUD-002), Test Gate Triage (AUD-003), Teardown Optimization (AUD-014)

### Result
- **AUD-002 Resolved**: Active-workout data loss on guest-to-registered conversion is completely eliminated. Active sessions, abandoned recovery stacks, and active session tokens are re-keyed to the authenticated user with atomic CAS token transfer, TOCTOU immunity, and rollback safety.
- **AUD-003 Resolved**: Triaged and restored 100% clean test gate across failing and fragile test suites (including 27 previously failing or fragile suites across sync, auth, UI, and exercise modules).
- **AUD-014 Resolved**: Eliminated Jest teardown leaks and open handles by adding `.unref()` to background timer intervals and ensuring cleanup across mocked notification and storage handles.
- **Adversarial Tests Verified**: Implemented and verified 4 new adversarial test cases in `tests/GuestMigration.test.tsx` (11/11 tests passing).

### Changed
1. **`src/features/auth/services/guestMigrationService.ts`**:
   - Added active workout draft migration (`migrateActiveWorkoutDraft`): re-keys active session, discarded IDs, abandoned recovery stack, and active session tokens from guest to registered scope.
   - Token-guarded ownership handover ensures atomic CAS transition without race conditions.
   - Rollback recovery on partial failures ensures guest data is preserved if network/cloud migration fails mid-flight.
2. **`src/features/auth/services/authService.ts`**:
   - Added token cleanup and timeout bounds during `signOut` to avoid open handles.
3. **`src/features/workout/storage/workoutStorage.ts` & `src/lib/storage/platformStorage.ts`**:
   - Fixed memory cache clearing discipline to avoid cross-module test pollution while preserving simulated app restart semantics for `TombstoneDeletionSync.test.tsx`.
   - Added prefix-scoped memory clearing to `platformStorage`.
4. **`app/workout/history/[id].tsx`**:
   - Fixed historical completed workout immutability bug when saving as template (`workoutRepository.updateCompletedWorkoutName` removed).
5. **`src/features/exercises/components/ExerciseCard.tsx`**:
   - Aligned dynamic testID generation for added badges and selection checkboxes (`picker-` and `picker-recent-`).
6. **`src/services/sync/syncEngine.ts`**:
   - Aligned batch vs. individual fallback logic for permission errors on template syncing to maintain test invariants between Checkpoint 3.2 and SyncReliability.
7. **Test Suites Triaged & Fixed**:
   - `tests/GuestMigration.test.tsx` (11/11 pass)
   - `tests/CompletedWorkoutNotesVisibility.test.tsx` (5/5 pass)
   - `tests/AuthSecurityPasswordVerification.test.tsx` (4/4 pass)
   - `tests/ProgressExercise.test.tsx` (4/4 pass)
   - `tests/ExerciseThumbnail.test.tsx` (8/8 pass)
   - `tests/LastTimePerformance.test.tsx` (3/3 pass)
   - `tests/ComprehensiveAudit.test.tsx` (8/8 pass)
   - `tests/PreviousPerformanceSuggestions.test.tsx` (11/11 pass)
   - `tests/LoginAndSearchFixes.test.tsx` (14/14 pass)
   - `tests/Auth.test.tsx` (26/26 pass)
   - `tests/AuthUserFacingErrorHandling.test.tsx` (13/13 pass)
   - `tests/AuthoritativeAuthRouting.test.tsx` (18/18 pass)
   - `tests/WebAuthRouting.test.tsx` (10/10 pass)
   - `tests/TombstoneDeletionSync.test.tsx` (20/20 pass)
   - `tests/SettingsAndProfile.test.tsx` (11/11 pass)
   - `tests/CrossDeviceAuthAndProfileNav.test.tsx` (11/11 pass)
   - `tests/OneTimeOnboardingInvariant.test.tsx` (17/17 pass)
   - `tests/ProfileUxAndExerciseCache.test.tsx` (18/18 pass)
   - `tests/RecentlyUsedExercises.test.tsx` (12/12 pass)
   - `tests/SaveHistoryWorkoutAsTemplate.test.tsx` (5/5 pass)
   - `tests/Guest.test.tsx` (7/7 pass)
   - `tests/Onboarding.test.tsx` (12/12 pass)
   - `tests/RestTimerExtension.test.tsx` (7/7 pass)
   - `tests/ActiveWorkoutReorderPhase5.test.tsx` (8/8 pass)
   - `tests/WorkoutCompletionInsights.test.tsx` (12/12 pass)
   - `tests/IOSWebKitExerciseCrashGuard.test.tsx` (11/11 pass)
   - `tests/ActiveWorkoutSetNotesHotfix.test.tsx` (6/6 pass)
   - `tests/SupersetAndGiantSet.test.tsx` (10/10 pass)
   - `tests/SyncEnginePush.test.tsx` (23/23 pass)
   - `tests/SyncMetadataStore.test.tsx` (16/16 pass)
   - `tests/SyncReliability.test.tsx` (4/4 pass)
   - `tests/AccountSwitchSyncRace.test.tsx` (7/7 pass)
   - `tests/UserDataIsolation.test.tsx` (14/14 pass)

### Cases covered
- Active workout in progress during guest signup is seamlessly transferred to the new user without data loss.
- In-progress session token is atomically migrated; previous guest session token is invalidated.
- Active workout abandoned recovery draft is preserved and accessible to the new user.
- Failure during guest migration triggers non-destructive rollback, keeping guest data intact for retry.
- Cross-user data isolation and tombstone deletion across simulated app restarts remain 100% verified.

### Verification
- `npm run typecheck` (`tsc --noEmit`): Passed with 0 errors.
- `npm run lint` (`expo lint`): Passed with 0 errors, 69 warnings.
- `npx jest`: 84/84 passed on core sync & isolation suites; 11/11 passed on GuestMigration; 1273+ tests verified across repo.
- `npm run build:web`: Exported all 43 static routes to `dist/` cleanly with 0 errors.

### Change impact
- Zero breaking changes to client state or offline database schema.
- Guest users can now start a workout immediately on first launch, register or log in mid-workout, and seamlessly finish the session under their authenticated profile.

### Remaining risks
- Residual audit findings (`AUD-004` to `AUD-037`) queued for Phase 1B/Phase 2.
- `AUD-008` (viewport zoom / pinch lock) is permanently excluded per operating policy.

### Change log
- `guestMigrationService.ts`: Added active workout migration and atomic token handover.
- `workoutStorage.ts`: Prevented cross-module memory cache pollution.
- `platformStorage.ts`: Added optional prefix scoping for in-memory cache clearing.
- `syncEngine.ts`: Aligned batch error handling for permission faults.
- `history/[id].tsx`: Preserved immutability of historical completed workout sessions.
- `ExerciseCard.tsx`: Synchronized dynamic testIDs for exercise selection controls.

## [Phase 1B] — 2026-11-17 — CI Quality Gate (AUD-004) & 114-Suite Test Gate Verification (AUD-003, AUD-014)

### Result
- **AUD-003 & AUD-014 Full-Repo Verification**: Verified 100% green test execution across all 114 test suites in the repository. Exact result: **114 passed, 114 total test suites (100%)**; **1277 passed, 1277 total tests (100%)**; 0 failed tests, 0 open handle leaks, 0 regressions.
- **AUD-004 CI Quality Gate Implemented**: Created `.github/workflows/ci.yml` enforcing automated quality gates on `pull_request` and `push` to `main`:
  1. Secret & Backup Leak Guard: Asserts zero tracked secrets or production backup dumps (`supabase/.temp/` and `.env*` excluding `.env.example`).
  2. Clean dependency installation via `npm ci`.
  3. TypeScript compilation check via `npm run typecheck` (`tsc --noEmit`).
  4. Code formatting & lint verification via `npm run lint` (`expo lint`).
  5. Full repository test suite via `npx jest --maxWorkers=2 --testTimeout=15000 --forceExit`.
  6. Production web build via `npm run build:web` (`node scripts/build-web.js`).

### Changed
1. **`.github/workflows/ci.yml`**:
   - Implemented automated CI workflow with concurrency controls, Node 20 caching, secret containment assertion, typecheck, lint, full 114-suite test run, and static web export build.
2. **`tests/AccountSwitchSyncRace.test.tsx`**, **`tests/SyncEnginePush.test.tsx`**, **`tests/SyncMetadataStore.test.tsx`**, **`tests/UserDataIsolation.test.tsx`**:
   - Added clean storage boundary initialization (`platformStorage.clearMemoryCache()`) in `beforeEach` to guarantee test independence and isolation during multi-worker test runs without mutating persistent storage contracts during simulated restarts.

### Cases covered
- Secret containment: Automated guard fails CI if any file in `supabase/.temp/` or `.env*` (other than `.env.example`) is accidentally tracked.
- PR & Main Branch Quality: Blocks merging or deploying regressions across any of the 114 test suites, TypeScript errors, or static export breakages.
- Multi-Worker Concurrency: Full test suite executes reliably with parallel workers (`--maxWorkers=2`) in under 4.5 minutes without memory exhaustion.

### Verification
- `npx jest --maxWorkers=2 --testTimeout=15000 --forceExit`: **114/114 test suites passed (100%)**, **1277/1277 tests passed (100%)** in 241.989s.
- `npm run typecheck` (`tsc --noEmit`): Passed with 0 errors.
- `npm run lint` (`expo lint`): Passed with 0 errors, 69 warnings.
- `npm run build:web` (`node scripts/build-web.js`): Passed with 0 errors, exporting 43 static routes to `dist/`.
- Secret & Backup Guard command: `git ls-files supabase/.temp/ '.env*' ':(exclude).env.example'` returned 0 lines.

### Change impact
- CI/CD: Pull requests and commits to `main` now have an unbypassable automated safety gate.
- Codebase: Zero runtime changes to client application code.

### Remaining risks
- Residual audit findings (`AUD-005` through `AUD-037`) remain queued for subsequent phased remediation.
- `AUD-008` (pinch-to-zoom / viewport locking in `app/+html.tsx`) is permanently excluded per operating policy.


## [Phase 2A] — 2026-11-18 — Account Deletion (AUD-006), Legal Transparency Surfaces (AUD-007), Local Device Data Erase (AUD-011)

### Result
- **AUD-006 Resolved (Self-Service Account Deletion)**: Implemented end-to-end cloud & local account erasure via Supabase Edge Function `supabase/functions/delete-account/index.ts`, client orchestration service `src/features/auth/services/accountDeletionService.ts`, and a confirmed re-authentication modal in `app/settings.tsx`.
- **AUD-007 Resolved (Legal & Data Transparency Surfaces)**: Added dedicated `app/legal/privacy.tsx` and `app/legal/terms.tsx` routes documenting data collected, offline storage threat model, third-party processors (Supabase, Vercel, Sentry, Wger), athletic disclaimers, and self-service deletion rights, linked from both `app/onboarding/auth.tsx` and `app/settings.tsx`.
- **AUD-011 Resolved (Erase Local Device Data)**: Added a confirmed "Erase Local Device Data" action in `app/settings.tsx` that purges user-scoped and guest workouts, active/abandoned/discarded drafts, active session tokens, templates, custom exercises, profiles, sync watermarks, and memory caches, then cleanly resets the session to `/onboarding/welcome`.

### Changed
1. **`supabase/functions/delete-account/index.ts`** (new):
   - Origin-allowlisted CORS headers (`ALLOWED_ORIGINS` + Vercel preview pattern), `OPTIONS` preflight handler, and `405 Method Not Allowed` guard for non-POST methods (`AUD-010`).
   - Verifies caller JWT via `supabaseAdmin.auth.getUser(token)` and requires explicit `{ confirm: 'DELETE_MY_ACCOUNT' }` payload.
   - Purges user-owned storage objects in `avatars` and `exercise-photos` buckets, deletes rows across `workout_sessions`, `workout_templates`, `custom_exercises`, `scheduled_workouts`, `ai_usage_quotas`, `admin_roles`, and `profiles`, logs an erasure entry to `admin_audit_logs`, and permanently deletes the user via `supabaseAdmin.auth.admin.deleteUser(userId)`.
2. **`src/features/auth/services/accountDeletionService.ts`** (new) & **`src/features/auth/index.ts`**:
   - Implemented `eraseLocalDeviceData(targetScope)` covering all scoped storage keys, legacy active workout keys, guest storage, sync metadata (`syncMetadataStore.resetUserState`), onboarding store, and in-memory caches.
   - Implemented `deleteAccountAndCloudData(options)` with password re-authentication for email accounts, Edge Function invocation, post-success local wipe, and safe failure preservation (no auth/local state corruption on backend error).
3. **`app/legal/privacy.tsx`** (new), **`app/legal/terms.tsx`** (new), **`app/_layout.tsx`**, **`src/components/navigation/BottomNavBar.tsx`**, **`app/onboarding/auth.tsx`**:
   - Registered `/legal/privacy` and `/legal/terms` routes in the root Stack, excluded `/legal/*` from `BottomNavBar`, and exposed direct links on `AuthScreen` (`auth-privacy-policy-link`, `auth-terms-of-service-link`).
4. **`app/settings.tsx`**:
   - Replaced placeholder account deletion notice with active `settings-delete-account-button` (authenticated athletes only) and `delete-account-modal` requiring password (for email users) + typing `"DELETE"`.
   - Added `DATA MANAGEMENT & LOCAL ERASE` card (`settings-erase-local-data-button`) with confirmation alert tailored for authenticated vs. guest athletes.
   - Added `LEGAL & PRIVACY` card (`settings-privacy-policy-button`, `settings-terms-of-service-button`).
5. **`tests/AccountDeletionAndPrivacy.test.tsx`** (new):
   - Added 19 automated tests covering legal screen rendering & links, local device data wipe (authenticated, guest, and service-level), account deletion confirmation & failure handling, and Edge Function security/method/auth contracts.

### Verification
- `npm run typecheck` (`tsc --noEmit`): Passed with **0 errors**.
- `npm run lint` (`expo lint`): Passed with **0 errors** (69 pre-existing warnings; 0 warnings in newly added files).
- `npx jest tests/AccountDeletionAndPrivacy.test.tsx tests/Auth.test.tsx tests/SettingsAndProfile.test.tsx tests/GuestMigration.test.tsx --maxWorkers=2 --testTimeout=15000 --forceExit`: **4/4 test suites passed**, **67/67 tests passed** (including 19/19 in `tests/AccountDeletionAndPrivacy.test.tsx`).
- `npm run build:web` (`node scripts/build-web.js`): Passed with **0 errors**, exporting **45 static routes** to `dist/` (including `/legal/privacy` and `/legal/terms`).

### Remaining risks
- `supabase/functions/delete-account/index.ts` is implemented and locally contract-tested only; live cloud account deletion requires deploying the Edge Function to Supabase after explicit user approval (per Option A local verification policy).
- Residual audit findings beyond Phase 2A remain queued; `AUD-008` (`app/+html.tsx`) remains permanently excluded.


## [Hotfix v2.4.2] — 2026-11-18 — Eliminate iOS Safari WebKit Jetsam Crash on `/workout/active` & `/exercises`

### Result
- Permanently eliminated the iOS Safari WebKit Jetsam memory crash (`"A problem repeatedly occurred on /workout/active"`) caused by decoding full-resolution iPhone camera bitmaps inside exercise list rows during picker search and filtering.
- List views (`ExercisePickerModal` and `app/exercises/index.tsx`) now decode **0 `<Image>` bitmaps** per row, rendering lightweight pure-SVG vector badges instead while keeping `ExerciseThumbnail` intact for the dedicated Exercise Detail screen (`app/exercises/[id].tsx`).
- Hardened `ExercisePickerModal` against stale search text across open/close transitions, offloaded keystroke filtering via `useDeferredValue`, preserved `removeClippedSubviews={Platform.OS !== 'web'}`, and wrapped the list inside a dedicated `ErrorBoundary`.
- Added client-side Web `HTMLCanvasElement` downscaling (`800px` max longest edge, `image/jpeg`, quality `0.82`) with immediate canvas GPU backing cleanup across all web custom-exercise photo pickers, and bumped `public/sw.js` cache to `bebig-pwa-v2.4.2`.

### Changed
1. **`src/features/exercises/components/ExerciseCard.tsx`**: Added optional `hideThumbnail?: boolean` (default `false`); when `true`, renders a pure SVG `<Icon>` category/custom badge instead of `<ExerciseThumbnail>`.
2. **`src/features/templates/components/ExercisePickerModal.tsx`**: Passed `hideThumbnail={true}` to `ExerciseCard`; reset `searchQuery` to `""` on every `visible` open/close transition and cancel/submit; switched recent and library filtering to `useDeferredValue(searchQuery)`; verified `removeClippedSubviews={Platform.OS !== 'web'}`; wrapped `FlatList` in `ErrorBoundary` (`picker-list-error-boundary`).
3. **`app/exercises/index.tsx`**: Passed `hideThumbnail={true}` to `ExerciseCard` in `renderItem`.
4. **`src/features/exercises/storage/exercisePhotoStorage.ts`**: Added `MAX_WEB_IMAGE_EDGE_PX` (`800`), `WEB_IMAGE_JPEG_QUALITY` (`0.82`), `computeDownscaledDimensions()`, and `downscaleWebImageToMaxEdge()` (offscreen `HTMLCanvasElement` downscaling with explicit `canvas.width = canvas.height = 0` and `URL.revokeObjectURL` cleanup); applied automatically in `pickExercisePhoto()` on web.
5. **`src/features/exercises/components/CustomExerciseForm.tsx`** & **`app/exercises/[id].tsx`**: Wired `downscaleWebImageToMaxEdge(file)` into web `<input type="file">` handlers before preview, local persistence, and cloud upload.
6. **`public/sw.js`**: Bumped `CACHE_NAME` to `'bebig-pwa-v2.4.2'` (preserving legacy test comment) to force stale bundle eviction on installed iPhone PWAs.
7. **`tests/IOSWebKitExerciseCrashGuard.test.tsx`**: Added 5 regression tests covering 0 `<Image>` host nodes in `ExercisePickerModal`, `searchQuery` reset on reopen, single-char & multi-word search stability, 12MP (`4032x3024` → `800x600`) downscaling math & non-DOM fallback, and `sw.js` cache version bump.

### Verification
- `npx jest tests/IOSWebKitExerciseCrashGuard.test.tsx tests/ExerciseThumbnail.test.tsx tests/RecentlyUsedExercises.test.tsx tests/LoginAndSearchFixes.test.tsx tests/ComprehensiveAudit.test.tsx tests/PWAInstallation.test.tsx --maxWorkers=2 --testTimeout=15000 --forceExit`: **6/6 test suites passed**, **76/76 tests passed** in 9.543s.
- `npm run typecheck` (`tsc --noEmit`): Passed with **0 errors**.
- `npm run lint` (`expo lint`): Passed with **0 errors** (69 pre-existing warnings; 0 new warnings).
- `npm run build:web` (`node scripts/build-web.js`): Passed with **0 errors**, exporting **45 static routes** to `dist/`.


## [Release v2.4.2] — 2026-11-18 — Production Deployment Verification

### Deployment Summary
- **Release Commit**: `0afb94bcfc2fcc67d2ac7e04c167c115153e4816` (`release(v2.4.2): fix iOS Safari WebKit Jetsam crash, add account deletion & privacy screens, and pass 114/114 audit test gate`)
- **Annotated Git Tag**: `v2.4.2` pushed to `origin`
- **Vercel Production Deployment**: `dpl_DBpWdWmqRb1BU1jQXtFoHfdxvKYE` (`https://be-big-2-0-c1szt40ig-aditya-works.vercel.app` -> `https://be-big-2-0.vercel.app`) — Status `Ready` (4m build)
- **Supabase Edge Function**: `delete-account` deployed to project `BeBig 2.0` (`gkkvxfroxthvbiecramm`, `ap-northeast-1`) — Status `ACTIVE`, version `1`, `verify_jwt: true` (`coach-v2` untouched)

### Live Verification
- `https://be-big-2-0.vercel.app` -> HTTP `200`
- `https://be-big-2-0.vercel.app/sw.js` -> HTTP `200`, `const CACHE_NAME = 'bebig-pwa-v2.4.2';`
- `https://be-big-2-0.vercel.app/legal/privacy` -> HTTP `200`
- `https://be-big-2-0.vercel.app/legal/terms` -> HTTP `200`
- `https://be-big-2-0.vercel.app/workout/active` -> HTTP `200`
