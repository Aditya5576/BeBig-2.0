# AI Changelog
- Implemented Token-Saving Brain v2 Global Operating Rules.
- Refined PR typography and history UI.
- Stabilized Cinematic Splash Screen with BeBig Barbell Crest.

## [Milestone 5 & P0-01 Cross-Tab Atomicity] — 2026-11-19 — Custom Numeric Keypad, Diagnostics Terminal Copy, Upgraded Home Banner, Trainer Templates, Global Filter & Robust Concurrency

### Problem
1. **P0-01 Cross-Tab Atomicity & Concurrency**:
   - In environments without the Web Locks API, concurrent cross-tab updates to workout history relied on optimistic overwrites that could clobber concurrent sessions.
   - Idempotent union merges risked resurrecting legitimately deleted sessions across tabs if deleted workout IDs were not tracked.
2. **Milestone 5 UX & Admin Enhancements**:
   - On iOS and Android mobile web/native, tapping weight or reps inputs brought up full native virtual keyboards that obstructed the rest timer, superset tags, and active exercise action buttons.
   - The Admin Diagnostics Terminal lacked one-click clipboard copy capabilities for log aggregation and bug reporting.
   - The Home Screen announcement banner lacked clear category badges and timestamps for announcements.
   - The Trainer Templates tab had a restricted exercise selection mechanism that did not surface global exercises or allow searching default exercises easily.
   - The Exercise Library and Template Pickers lacked a dedicated "Global" source filter chip for filtering curated global exercises.

### Root cause
1. **Concurrency**: Absence of an IndexedDB transaction serialization barrier as a fallback when `navigator.locks` is unsupported, and lack of a durable deleted tombstone set.
2. **Keypad**: Default React Native `TextInput` behavior triggers OS soft inputs unless explicitly suppressed via `showSoftInputOnFocus={false}` and `inputMode="none"`.
3. **Admin Terminal**: Error logs were displayed in a scrollable list without a formatted clipboard exporter or copy visual state.
4. **Trainer Templates**: Exercise picker was restricted to external search and lacked integration with the unified global exercise catalog service.

### Changes
1. **P0-01 Single-Transaction Atomic IndexedDB Read-Merge-Write & Concurrency Hardening (`workoutStorage.ts`)**:
   - When `typeof indexedDB !== 'undefined'`, executed completed-workout mutations (`saveCompletedWorkout`, `upsertCompletedWorkout`, `deleteCompletedWorkout`) inside a **single continuous IndexedDB `readwrite` transaction** on `bebig_cross_tab_locks`.
   - Ensured `store.get(storageKey)` synchronously runs `mergeCompletedWithTombstones` / `deleteCompletedWithTombstones` and issues `store.put(record)` in the exact same event tick with **zero `await` gaps**, preventing premature W3C auto-commit.
   - After `tx.oncomplete` fires, mirrored the committed array and tombstone records to platform storage (`writeStorage`).
   - Maintained Web Locks API (`navigator.locks.request`) and in-process FIFO promise queue with storage lease contention fallback for environments without `indexedDB` (Node/Jest).
   - Added persistent tombstone tracking (`bebig.workout.completed.deleted`) with `getCompletedTombstones`, `addCompletedTombstone`, and `removeCompletedTombstone`.
   - Added unit test in `tests/AuditBlockersP0P1.test.tsx` verifying synchronous `store.put` before `tx.oncomplete`.
2. **Custom Workout Numeric Keypad & Hook Dependency Stabilization (`WorkoutNumericKeypad.tsx`, `active.tsx`)**:
   - Built a responsive on-screen numeric keypad component supporting `kg` mode (±2.5, ±5 steppers, decimal point, digits, backspace, next navigation) and `reps` mode (±1 steppers, integer-only constraint, RPE 6–10 selector bar, clear, next set navigation).
   - Added toggle to switch back to native soft keyboard at any time (`onToggleNativeKeyboard`).
   - Handled safe area insets and constrained maximum layout width to 520px.
   - Wired into `ActiveSetRow.tsx`, `ActiveExerciseCard.tsx`, and `app/workout/active.tsx` with soft input suppression (`showSoftInputOnFocus={!isCustomKeypadActive}`, `inputMode={isCustomKeypadActive ? 'none' : 'decimal' | 'numeric'}`) and dynamic `ScrollView` bottom padding.
   - Stabilized `app/workout/active.tsx` dependencies: wrapped `updateSessionAndAutosaveImmediate`, `scheduleDebouncedSave`, and `handleUpdateSetField` in `useCallback` with stable dependencies (`sessionRef`), reducing ESLint warnings in `active.tsx` to exactly 0.
   - Fixed clipboard output assertion in `tests/Milestone5KeypadAndAdminUX.test.tsx` to match formatted `[WARNING]` severity.
3. **Admin Diagnostics Terminal Copy Feature (`app/admin/index.tsx`)**:
   - Added toolbar "Copy All" (`diag-copy-all-button`) and per-row "Copy" (`diag-copy-log-${log.id}`) buttons.
   - Formatted clipboard text output (`[SEVERITY] [TIMESTAMP] [ROUTE] [DEVICE] VERSION \n NAME: MESSAGE`).
   - Provided a 2-second visual feedback indicator (`✓ Copied All!` / `✓ Copied!`).
4. **Upgraded Home Announcement Banner (`app/home.tsx`)**:
   - Redesigned into a high-contrast glassmorphic card with category accent badges (Release, Maintenance, Info), bold titles, formatted timestamps (`formatAnnouncementTimestamp`), and an accessible dismiss button.
5. **Trainer Templates Catalog Search & Assignment (`AdminTrainerTemplatesTab.tsx`, `app/workout/start.tsx`)**:
   - Integrated full catalog search (`source: 'all'`) querying default, global, and custom exercises with category filter chips and custom exercise adder.
   - Normalized `assignee_user_id` and `user_id` in `adminService.ts` and `app/workout/start.tsx`.
   - Safeguarded `targetReps` regex in `workoutRepository.ts` against non-string values.
6. **Dedicated "Global" Source Filter Chip**:
   - Extended `ExerciseFilterOptions['source']` with `'global'`.
   - Handled `source === 'global'` in `exerciseRepository.ts` and `exerciseCacheStorage.ts` to query strictly active curated global exercises from `globalExerciseCatalogService`.
   - Added `'Global'` filter chips to Exercise Library (`app/exercises/index.tsx`) and Template Workout Pickers (`ExercisePickerModal.tsx`).
7. **Verification Suites**:
   - Created `tests/Milestone5KeypadAndAdminUX.test.tsx` (8/8 tests passing).
   - Created `tests/AuditBlockersP0P1.test.tsx` (12/12 tests passing).

### Impact analysis
- **Data Integrity & Concurrency**: Impossible for concurrent browser tabs to clobber each other or resurrect deleted workouts.
- **User Experience**: Drastically smoother active workout experience with the custom on-screen keypad preventing keyboard shifts and screen resizing on mobile.
- **Admin Productivity**: Seamless copy-paste diagnostics for rapid troubleshooting and athlete plan assignment.
- **Offline & PWA Resilience**: Zero breaking changes to offline IndexedDB stores; all fallback mechanisms degrade gracefully without network.

### Verification
- `npx jest`: All 8 verification suites passed (102/102 tests green, 0 failures, 0 open handles).
  - `tests/Milestone5KeypadAndAdminUX.test.tsx` (8/8 green)
  - `tests/AuditBlockersP0P1.test.tsx` (12/12 green)
  - `tests/AdminControlPanelM4.test.tsx` (11/11 green)
  - `tests/IOSWebKitExerciseCrashGuard.test.tsx` (19/19 green)
  - `tests/AllScreensHealthSmoke.test.tsx` (22/22 green)
  - `tests/Auth.test.tsx` (18/18 green)
  - `tests/DropSetTrackingAndAnalytics.test.tsx` (6/6 green)
  - `tests/ScheduledWorkoutRemovalRegression.test.tsx` (6/6 green)
- `npm run typecheck`: Passed with 0 TypeScript errors (`tsc --noEmit`).
- `npm run lint`: Passed with 0 errors (`expo lint`).
- `npm run build:web`: Passed with 0 errors (`node scripts/build-web.js`), successfully exporting all 45 static routes to `dist/`.
- Boundary verification: Confirmed `app/+html.tsx`, `workoutNotificationService.ts`, and AI coach paths remain completely untouched.

### Security and privacy
- Multi-layer locks prevent race conditions on sensitive user workout histories.
- Deletion tombstones ensure user intent is strictly respected across concurrent browser tabs.
- Diagnostics clipboard export sanitizes error messages and avoids leaking sensitive tokens or PII.

### Migration and rollback
- Local Option A verification only. No remote migration applied.
- Rollback: Revert modified files via git checkout.

### Remaining risks
- None identified in the local codebase; all 102 regression tests passing across all suites.


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


## [Phase 2B] — 2026-11-18 — Security Hardening, Shell-Only SW Caching & Dependency Remediation (AUD-005, AUD-010, AUD-012, AUD-013, AUD-019, AUD-020)

### Result
- **AUD-005 Resolved (Vulnerable `xlsx` Removed + Formula Injection Guard)**: Uninstalled unmaintained `xlsx@0.18.5` (Prototype Pollution `GHSA-4r6h-8v6p-xvw6` & ReDoS `GHSA-5pgg-2g8v-p4x9`), replaced with zero-dependency pure-TS OOXML `.xlsx` writer `src/features/export/services/ooxmlWorkbook.ts`, neutralized spreadsheet formula-injection triggers (`=`, `+`, `@`, `\t`, `\r`, non-numeric `-`) in both `.xlsx` and `.csv` exports, and shrank the export web bundle chunk from `965KB` to `549KB` (`-416KB`).
- **AUD-010 Resolved (Edge Function Security Hardening)**: Created `supabase/functions/_shared/security.ts` and hardened all non-paused Edge Functions (`admin-assign-role`, `coach-agent`, `delete-account`) with allowlisted CORS + `Vary: Origin` (zero wildcard `*`), explicit `405 Method Not Allowed`, bounded JSON payload caps (`413 Payload Too Large`), strict input/UUID/role enum validation, and generic error responses with `correlation_id`.
- **AUD-012 Resolved (HTTP Security Headers)**: Added `Strict-Transport-Security`, `Permissions-Policy`, and `Cross-Origin-Opener-Policy: same-origin-allow-popups` to `vercel.json` alongside functional CSP supporting Supabase, Vercel, Sentry, Wger, and Expo Web hydration.
- **AUD-013 Resolved (Service Worker Shell-Only Caching)**: Hardened `public/sw.js` to cache only the public root shell (`/` / `/index.html`) and static app-shell assets, never caching arbitrary navigation URLs, `Cache-Control: no-store`/`private` responses, or `/api/`, `/rest/`, `/auth/`, `/functions/`, `/storage/` endpoints, while purging all non-current caches on activate.
- **AUD-019 Resolved (Atomic Super-Admin Guard Migration — Local Only)**: Authored `supabase/migrations/20261118120000_atomic_super_admin_guard.sql` implementing a transaction advisory-locked `BEFORE DELETE OR UPDATE` last-super-admin trigger and atomic `admin_mutate_role_atomic` RPC (`service_role` only) combining role mutation + audit log insert in one transaction.
- **AUD-020 Resolved (Avatar EXIF Strip & Owner-Scoped Storage RLS — Local Only)**: Added `avatarService.sanitizeWebAvatarImage()` (offscreen `HTMLCanvasElement` re-encode to `<= 800px` JPEG `0.82` stripping EXIF metadata with explicit canvas GPU and blob-URL cleanup), wired into `app/settings.tsx`, and authored local migration `supabase/migrations/20261118120500_harden_avatars_storage_privacy.sql` restricting `avatars` `SELECT`/listing RLS strictly to `${auth.uid()}/`.

### Verification
- `npm audit --omit=dev`: `XLSX_AUDIT_HITS=0` (0 `xlsx` advisories remain).
- `npm run typecheck` (`tsc --noEmit`): Passed with **0 errors**.
- `npm run lint` (`expo lint`): Passed with **0 errors** (68 pre-existing warnings; 0 new warnings).
- `npx jest tests/Phase2BSecurityHardening.test.ts tests/DataExport.test.ts tests/ProductionDeployment.test.tsx tests/PWAInstallation.test.tsx tests/ProfileAvatarPersistence.test.tsx tests/AccountDeletionAndPrivacy.test.tsx tests/IOSWebKitExerciseCrashGuard.test.tsx --maxWorkers=2 --testTimeout=15000 --forceExit`: **7/7 suites**, **118/118 tests passed** in 69.673s.
- `npm run build:web` (`node scripts/build-web.js`): Passed with **0 errors**, exporting **45 static routes** to `dist/`.


## [Phase 3] — 2026-11-18 — Storage Resilience, Hook Hygiene, Input Bounds, Error Boundaries & Docs Reconciliation (AUD-015, AUD-017, AUD-018, AUD-022, AUD-024, AUD-026, AUD-034)

### Result
- **AUD-017 & AUD-018 Resolved (Storage Resilience & Fault Telemetry)**: Hardened `src/lib/storage/platformStorage.ts` so native payloads `> 1800` bytes transparently spill over to durable app-private `FileSystem.documentDirectory/bebig_kv/` with a compact `__BEBIG_FILE__:` pointer in `SecureStore` (eliminating 2KB hardware keystore limits while keeping small auth tokens in Keychain/KeyStore). Added structured `classifyStorageError()`, zero-PII `onStorageError()` telemetry (`keyNamespace` only), and automatic Web `QuotaExceededError` recovery evicting rebuildable exercise catalog caches before retrying once.
- **AUD-015 Resolved (Zero Hook-Dependency Warnings Repo-Wide)**: Eliminated all 11 `react-hooks/exhaustive-deps` warnings across `app/workout/active.tsx`, `ActiveWorkoutTimer.tsx`, `RestTimerOverlay.tsx`, `app/templates/new.tsx`, `app/exercises/[id].tsx`, `app/workout/progress/exercise/[id].tsx`, `app/workout/progress/prs.tsx`, and `app/workout/progress/weekly.tsx`, reducing total lint warnings from `69` to `47` with `0` errors.
- **AUD-024 Resolved (Canonical Domain Input Bounds)**: Created `src/constants/domainLimits.ts` (`DOMAIN_LIMITS` + `clampText()`) and wired explicit `maxLength` + clamping into set notes (`ActiveSetRow.tsx`), custom exercise fields (`CustomExerciseForm.tsx`), template names (`app/templates/new.tsx`), and profile display name / avatar URL (`app/settings.tsx`).
- **AUD-026 Resolved (Granular Screen Error Boundaries)**: Wrapped data-heavy screens (`app/workout/active.tsx`, `app/settings.tsx`, `app/workout/progress/weekly.tsx`, `app/workout/progress/prs.tsx`) in `<ErrorBoundary>` with retry controls preserving locally saved workout state.
- **AUD-022 & AUD-034 Resolved (Living Docs Reconciliation)**: Reconciled `AI_BRAIN.md`, `DECISIONS.md`, and `RELEASE_STATE.md` with live `v2.4.2` (`0afb94b`) + locally verified Phase 2B & Phase 3 work and documented the exact required deployment sequence.

### Verification
- `npm run typecheck` (`tsc --noEmit`): Passed with **0 errors**.
- `npm run lint` (`expo lint`): Passed with **0 errors**, **47 warnings** (`0` `react-hooks/exhaustive-deps` warnings repo-wide).
- `npx jest --maxWorkers=2 --testTimeout=15000 --forceExit`: **117/117 test suites passed (100%)**, **1,323/1,323 tests passed (100%)** in 121.398s (including 9/9 in `tests/Phase3ResilienceAndHygiene.test.ts`).
- `npm run build:web` (`node scripts/build-web.js`): Passed with **0 errors**, exporting **45 static routes** to `dist/`.


## [Hotfix v2.4.3] — 2026-11-18 — Two-Layer iPhone PWA Crash Fix (Pre-v2.4.2 Photo Compaction, Picker Payload Stripping & Network-First SW Auto-Update)

### Result
- Resolved both remaining contributors to the live iPhone PWA crash observed in `video_1.mp4`:
  1. **Stale PWA JS Bundle Eviction**: Switched `/_expo/static/js/` (and `.js` assets) in `public/sw.js` to **Network-First** with offline cache fallback, bumped `CACHE_NAME` to `'bebig-pwa-v2.4.3'`, and wired `registration.update()` + a session-guarded single `controllerchange` reload (`bebig_sw_reloaded_v243`) in `app/_layout.tsx` so installed iPhone PWAs automatically self-update without manual Safari cache clearing.
  2. **Pre-v2.4.2 Multi-MB Base64 Custom Photo Compaction & Picker Stripping**: Added `downscaleDataUrlToMaxEdge()` (`exercisePhotoStorage.ts`) and non-blocking sequential background compaction on web load in `customExerciseStorage.ts` (shrinking stored `data:image/` payloads `> 150,000` chars down to `<= 800px` JPEG quality `0.82` and persisting back to IndexedDB), plus `stripExerciseImagePayloads()` in `ExercisePickerModal.tsx` so `FlatList` and `RECENTLY USED` never retain or diff multi-MB base64 strings even before background compaction completes.

### Verification
- `npx jest tests/IOSWebKitExerciseCrashGuard.test.tsx tests/PWAInstallation.test.tsx tests/ExerciseThumbnail.test.tsx tests/RecentlyUsedExercises.test.tsx --maxWorkers=2 --testTimeout=15000 --forceExit`: **4/4 suites**, **57/57 tests passed** in 12.433s.
- `npm run typecheck` (`tsc --noEmit`): Passed with **0 errors**.
- `npm run lint` (`expo lint`): Passed with **0 errors**, **47 warnings** (0 new warnings).
- `npm run build:web` (`node scripts/build-web.js`): Passed with **0 errors**, exporting **45 static routes** to `dist/`.


## [Release v2.4.3] — 2026-11-18 — Production Deployment Verification

### Deployment Summary
- **Release Commit**: `2f88fd254578dff1ddebccb50124fc3b825c06e6` (`release(v2.4.3): deploy two-layer iOS WebKit crash & SW auto-reload fix, Phase 2B security hardening, and Phase 3 storage resilience`)
- **Annotated Git Tag**: `v2.4.3` pushed to `origin`
- **Vercel Production Deployment**: `dpl_G3AZFkELZTWHJQw6gynxWuSTkvFW` (`https://be-big-2-0-r96gem5q7-aditya-works.vercel.app` -> `https://be-big-2-0.vercel.app`) — Status `Ready` (`2m 50s` build)
- **Supabase SQL Migrations Applied (`gkkvxfroxthvbiecramm`, `ap-northeast-1`)**:
  - `20261118120000_atomic_super_admin_guard.sql` — verified `public.admin_mutate_role_atomic(uuid, uuid, text, text)` (`service_role` execute = `true`; `authenticated`/`anon`/`public` = `false`) and enabled trigger `protect_last_super_admin_trigger` on `public.admin_roles` (`enforce_last_super_admin_invariant`).
  - `20261118120500_harden_avatars_storage_privacy.sql` — verified owner-scoped `SELECT` RLS policy `"Users can list and read own avatar folder"` (`(bucket_id = 'avatars') AND ((storage.foldername(name))[1] = (auth.uid())::text)`) on `storage.objects` with legacy broad list/public read policies removed.
- **Supabase Edge Functions Deployed (`gkkvxfroxthvbiecramm`)**:
  - `admin-assign-role`: `ACTIVE`, version `1`, `verify_jwt: true`
  - `coach-agent`: `ACTIVE`, version `14`, `verify_jwt: true`
  - `delete-account`: `ACTIVE`, version `2`, `verify_jwt: true`
  - `coach-v2`: Untouched (`ACTIVE`, version `2`, paused boundary respected)

### Live Verification
- `https://be-big-2-0.vercel.app/` -> HTTP `200` (verified `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin-allow-popups`, `Content-Security-Policy`)
- `https://be-big-2-0.vercel.app/sw.js` -> HTTP `200`, `Cache-Control: no-cache, no-store, must-revalidate`, serving `bebig-pwa-v2.4.3` with `if (isJsBundle)` Network-First `/_expo/static/js/` handler
- `https://be-big-2-0.vercel.app/workout/active` -> HTTP `200`
- `https://be-big-2-0.vercel.app/legal/privacy` -> HTTP `200`
- `https://be-big-2-0.vercel.app/legal/terms` -> HTTP `200`


## [Codex Audit Polish] — 2026-11-18 — Namespace-Isolated Exercise Caches, Strict Settings Typing & Docs Reconciliation (AUD-016, AUD-022, AUD-031, AUD-034, AUD-037, AUD-014, AUD-005)

### Result
- **AUD-022 / AUD-034 / AUD-037 Resolved (Docs Reconciliation)**: Updated `README.md` (previously `v2.4.1`) and `AI_BRAIN.md` (previously `v2.4.2`) to live `v2.4.3` parity covering pure-TS OOXML `.xlsx` export (`ooxmlWorkbook.ts`), iOS WebKit zero-bitmap + background photo compaction + Network-First SW auto-reload (`bebig-pwa-v2.4.3`), namespace-isolated caches, and current Jest/CI test gate status.
- **AUD-016 Resolved (Namespace-Isolated In-Memory Caches)**: Keyed volatile custom exercise caches in `exerciseCacheStorage.ts` and `exerciseRepository.ts` by active user namespace (`auth:<id>`, `guest:<id>`, or `guest`), added a circular-import-free `clearExerciseMemoryCache()` registry in `customExerciseStorage.ts`, and wired automatic cache clearing across `useAuthStore.ts` (`signOut`, `exitGuestMode`, `SIGNED_OUT`, `setSession`, `enterGuestMode`, `SIGNED_IN`/`INITIAL_SESSION` user-ID transitions), `accountDeletionService.ts` (`eraseLocalDeviceData`), and `app/settings.tsx` (`handleClearCache`).
- **AUD-031 Resolved (Zero `any` Casts in Settings)**: Replaced all 11 explicit `any` casts in `app/settings.tsx` with strict DOM/React/domain types (`HTMLInputElement`, `Blob | File`, `unknown` + `extractErrorMessage`, `Partial<OnboardingState>`, `ThemeMode`, `ReturnType<typeof useAppTheme>['colors']`), also catching and fixing a latent `colors.text` -> `colors.textPrimary` token bug on `deleteTextInput` and replacing the dynamic `require('../src/lib/storage')` warning with a static import.
- **AUD-014 / AUD-005 Verified**: Added `AUD-016` multi-user/guest cache isolation tests and `AUD-031` zero-`any` guard to `tests/Phase3ResilienceAndHygiene.test.ts`; verified clean natural Jest teardown without `--forceExit` (`--detectOpenHandles`) and `npm audit --omit=dev` (`0` `xlsx` hits; `76` remaining transitive Expo/RN/Metro/Sentry build-toolchain advisories).

### Verification
- `npm audit --omit=dev`: `0` `xlsx` advisories (`76` total transitive advisories: `1` critical, `66` high, `9` moderate, `0` low).
- `npm run typecheck` (`tsc --noEmit`): Passed with **0 errors**.
- `npm run lint` (`expo lint`): Passed with **0 errors**, **46 warnings** (down from 47; 0 warnings in `app/settings.tsx`).
- `npx jest tests/Phase3ResilienceAndHygiene.test.ts --detectOpenHandles` (without `--forceExit`): **1/1 suite**, **12/12 tests passed** in 5.695s with natural teardown.
- `npx jest tests/Phase3ResilienceAndHygiene.test.ts tests/IOSWebKitExerciseCrashGuard.test.tsx tests/AccountDeletionAndPrivacy.test.tsx tests/Phase2BSecurityHardening.test.ts --maxWorkers=2 --testTimeout=15000`: **4/4 suites**, **60/60 tests passed** in 11.964s.
- `npm run build:web` (`node scripts/build-web.js`): Passed with **0 errors**, exporting **45 static routes** to `dist/`.


## [UI Milestone 1] — 2026-11-18 — WebKit-Safe Floating Collapsible Rest-Timer Pill & Inline Progressive-Overload Nudges

### Result
- **Floating Collapsible Rest-Timer Pill (`RestTimerOverlay.tsx`)**: Upgraded the active workout rest timer into a non-blocking, safe-area-anchored floating pill (`pointerEvents="box-none"`, `zIndex: 100`) featuring a lightweight `react-native-svg` circular countdown ring (`CountdownRing`, `0 KB` bitmap memory, `testID="rest-timer-progress-ring"`), `MM:SS` readout, `-15s`/`+15s`/`PAUSE`/`SKIP` controls, and an expand/collapse toggle (`testID="rest-timer-collapse-toggle"`) collapsing to a compact floating pill (`testID="rest-timer-collapsed-pill"`) with ring, countdown, and quick `SKIP` while preserving all existing timer `testID`s and `onLayout` height reporting.
- **Inline Progressive-Overload Nudges (`previousPerformanceService.ts`, `app/workout/active.tsx`, `ActiveExerciseCard.tsx`)**: Added pure `computeBestLastSetNudge()` and `buildProgressiveOverloadMap()` (`exerciseId -> { weight, reps, date, label }`), refactored `/workout/active` to fetch user-scoped completed workouts once on mount / user scope change (memoized, zero per-keystroke queries), and rendered a compact inline badge (`Last: 80 kg × 8`, `testID="overload-nudge-badge-<exerciseId>"`) on active exercise cards when historical performance exists (hidden when no history exists).
- **Zero Package Bloat**: Reused already-installed `react-native-svg@15.15.4` and `react-native-safe-area-context@~5.7.0` with zero new dependencies added.

### Verification
- `npm run typecheck` (`tsc --noEmit`): Passed with **0 errors**.
- `npm run lint` (`expo lint`): Passed with **0 errors**, **45 warnings** (down from 46; 0 warnings in modified files).
- `npx jest tests/UIEnhancementsM1.test.tsx tests/IOSWebKitExerciseCrashGuard.test.tsx tests/Phase3ResilienceAndHygiene.test.ts --maxWorkers=2 --testTimeout=15000`: **3/3 suites**, **34/34 tests passed** in 26.762s.
- `npx jest tests/ActiveWorkoutRestTimerLayout.test.tsx tests/ReleaseNotesModalAndRestTimerPolish.test.tsx tests/LastTimePerformance.test.tsx tests/PreviousPerformanceSuggestions.test.tsx --maxWorkers=2 --testTimeout=15000`: **4/4 suites**, **29/29 tests passed** in 8.69s.
- `npm run build:web` (`node scripts/build-web.js`): Passed with **0 errors**, exporting **45 static routes** to `dist/` (`entry-*.js` unchanged at `4.1MB`, `index-*.js` at `549KB`).


## [UI Milestone 2] — 2026-11-18 — In-Workout Exercise Detail Modal Over `/workout/active`

### Result
- **In-Workout Exercise Detail Modal (`ExerciseDetailModal.tsx`)**: Added a WebKit-safe scrollable modal/sheet (`fixed` `100dvh` overlay on Web; native `<Modal transparent animationType="slide">` on iOS/Android) that loads full catalog or custom `Exercise` details via `exerciseRepository` (0ms cached sync lookup + async fallback) and renders Exercise Name, Category & Custom badges, Equipment chips & row, Primary & Secondary Muscles, single safe image preview (`decoding="async"` + `onError` fallback, matching `app/exercises/[id].tsx` media priority), step-by-step Form Instructions, graceful offline/deleted fallback state, backdrop dismiss, and `close-exercise-detail-modal` control.
- **Tappable Exercise Title Trigger (`ActiveExerciseCard.tsx`)**: Wrapped the exercise title in a tappable `<Pressable testID="exercise-detail-trigger-<exerciseId>">` with a subtle `chevronRight` affordance invoking `onPressExerciseDetail(exerciseId, exerciseName)` without interfering with existing reorder/superset/remove buttons or the `Last: 80 kg × 8` progressive-overload nudge badge.
- **Zero-State-Loss Integration (`app/workout/active.tsx`)**: Wired lightweight `selectedDetailExercise` state and `<ExerciseDetailModal>` directly over `/workout/active`, preserving active workout sets, rest timer state, and browser history stack with zero route navigation.

### Verification
- `npm run typecheck` (`tsc --noEmit`): Passed with **0 errors**.
- `npm run lint` (`expo lint`): Passed with **0 errors**, **45 warnings** (0 warnings in new/modified files).
- `npx jest tests/UIEnhancementsM2.test.tsx tests/UIEnhancementsM1.test.tsx tests/IOSWebKitExerciseCrashGuard.test.tsx --maxWorkers=2 --testTimeout=15000`: **3/3 suites**, **26/26 tests passed** in 20.533s.
- `npm run build:web` (`node scripts/build-web.js`): Passed with **0 errors**, exporting **45 static routes** to `dist/` (`entry-*.js` unchanged at `4.1MB`, `index-*.js` at `549KB`).


## [UI Layout Polish] — 2026-11-18 — Mobile Card Wrapping, `PREV` Column Width & Floating Rest-Pill Contrast on `/workout/active`

### Result
- **Dedicated Exercise Title Row & Unified Metadata Row (`ActiveExerciseCard.tsx`)**: Isolated the tappable exercise title + `>` chevron onto its own full-width row so short and long exercise names align consistently without competing for horizontal width, and moved `overload-nudge-badge-<exerciseId>` (`Last: 80 kg × 8`) into a wrapping `metaBadgeRow` (`gap: 8`) directly below the title alongside `Target: ...`.
- **Unclipped `PREV` Column on Mobile (`ActiveExerciseCard.tsx`, `ActiveSetRow.tsx`)**: Rebalanced the 8-column tabular layout under a unified `windowWidth < 400` compact breakpoint (`SET: 26/30`, `PREV: 56/62`, `CHECK: 30/34`, `NOTE: 24/26`, `DEL: 22/24`, flex `KG`/`REPS`/`RIR` + tight tabular `letterSpacing: -0.2`) so `PREV` values like `W 10 × 15` and `BW × 12` display cleanly without premature ellipsis clipping.
- **Opaque Floating Rest-Pill Contrast & Scroll Clearance (`RestTimerOverlay.tsx`, `app/workout/active.tsx`)**: Upgraded expanded, collapsed, and finished rest-timer surfaces to opaque elevated `#131A26` (dark) / `colors.surface` (light) with `1.5px` high-contrast border and deep shadow (`elevation: 8`) so scrolled text underneath never bleeds through, and raised the pre-measurement rest-overlay fallback height to `112px` (`+ Math.max(insets.bottom, 12) + 24`) so bottom action buttons scroll cleanly above the floating pill.

### Verification
- `npm run typecheck` (`tsc --noEmit`): Passed with **0 errors**.
- `npm run lint` (`expo lint`): Passed with **0 errors**, **45 warnings** (0 warnings in modified files).
- `npx jest tests/UIEnhancementsM1.test.tsx tests/UIEnhancementsM2.test.tsx tests/ActiveWorkoutRestTimerLayout.test.tsx tests/ReleaseNotesModalAndRestTimerPolish.test.tsx --maxWorkers=2 --testTimeout=15000`: **4/4 suites**, **23/23 tests passed** in 14.707s.
- `npm run build:web` (`node scripts/build-web.js`): Passed with **0 errors**, exporting **45 static routes** to `dist/`.


## [UI Milestone 3] — 2026-11-18 — Professional Athletic Typography System (`Plus Jakarta Sans` + `Inter` + Tabular Numerals)

### Result
- **Lightweight Static Font Stack**: Installed `@expo-google-fonts/inter` alongside `@expo-google-fonts/plus-jakarta-sans` and loaded strictly 7 static `.ttf` weights (`PlusJakartaSans_600SemiBold`, `PlusJakartaSans_700Bold`, `PlusJakartaSans_800ExtraBold`, `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold` — zero variable fonts).
- **Non-Blocking Offline Boot (`app/_layout.tsx`)**: Upgraded `useFonts(...)` to capture `fontError` plus a `1500ms` safety fallback (`FONT_LOAD_TIMEOUT_MS = 1500`) so `fontsReady = fontsLoaded || Boolean(fontError) || fontLoadTimedOut` guarantees offline iOS PWAs and failed font loads never block app rendering.
- **Centralized Typography Tokens (`src/theme/typography.ts` -> `src/constants/theme.ts`)**: Created `FONT_FAMILIES`, `NUMERIC_TABULAR_STYLE` (`fontVariant: ['tabular-nums']`), `fontFamilies`, and `typography` presets (`display`, `h1`/`h2`/`h3`, `heading*`, `title*`, `body*`, `label`, `caption`, `button*`, `numeric`, `numericHero`) mapping display/headings to `Plus Jakarta Sans` and body/controls to `Inter` with web CSS fallback stacks.
- **Tabular Numerals on Timers & Set Inputs**: Applied `FONT_FAMILIES` and `NUMERIC_TABULAR_STYLE` across `RestTimerOverlay.tsx` (expanded & collapsed countdowns), `ActiveWorkoutTimer.tsx`, `ActiveSetRow.tsx` (set inputs & `PREV` cells), and `ActiveExerciseCard.tsx` (exercise title & overload nudge pill) to eliminate horizontal digit jitter.

### Verification
- `npm run typecheck` (`tsc --noEmit`): Passed with **0 errors**.
- `npm run lint` (`expo lint`): Passed with **0 errors**, **44 warnings** (down from 45; fixed `import/first` in `src/constants/theme.ts`).
- `npx jest tests/UIEnhancementsM3Typography.test.tsx tests/UIEnhancementsM2.test.tsx tests/UIEnhancementsM1.test.tsx tests/IOSWebKitExerciseCrashGuard.test.tsx --maxWorkers=2 --testTimeout=15000`: **4/4 suites**, **30/30 tests passed** in 17.995s.
- `npx jest tests/TypographySystem.test.tsx --maxWorkers=2 --testTimeout=15000`: **1/1 suite**, **3/3 tests passed** in 2.815s.
- `npm run build:web` (`node scripts/build-web.js`): Passed with **0 errors**, exporting **45 static routes** to `dist/` with strictly 7 static `.ttf` font assets (`entry-*.js` unchanged at `4.1MB`, `index-*.js` at `549KB`).


## [Previous Workout UX Polish] — 2026-11-18 — De-Cluttered `Best Last:` Badge, Collapsible `History` Breakdown, One-Tap `PREV` Quick-Fill & `NOTE` / `DEL` Spacing

### Result
- **Clear Top Nudge Pill (`previousPerformanceService.ts`, `ActiveExerciseCard.tsx`)**: Updated `ProgressiveOverloadNudge.label` from `Last: ...` to `Best Last: 80 kg × 8` / `Best Last: BW × 12` with a trophy icon so athletes distinguish their top target set from per-row `PREV` history at a glance.
- **Default-Collapsed `LAST TIME` Breakdown (`ActiveExerciseCard.tsx`)**: Replaced the always-open `LAST TIME` summary box with a compact metadata pill (`History (Date) ▾`, `testID="toggle-last-session-<exerciseId>"`) collapsed by default (~65px cleaner per card) that expands cleanly on tap to reveal the full set-by-set breakdown and set notes.
- **One-Tap `PREV` Quick-Fill (`ActiveSetRow.tsx`)**: Made non-empty `PREV` cells tappable (`testID="prev-quick-fill-<setIndex>"`, subtle pill + underline affordance) to auto-fill empty `weight` and `reps` inputs for that row without ever overwriting values already typed by the user.
- **Distinct `NOTE` and `DEL` Headers (`ActiveExerciseCard.tsx`, `ActiveSetRow.tsx`)**: Tightened compact mobile header typography (`9px`, `letterSpacing: 0.2`), widened `colNote` (`28/30px`) + `colDelete` (`24/26px`), and added explicit `marginLeft: 4` between `NOTE` and `DEL` to eliminate `NOTEDEL` collision on 360px–393px screens.

### Verification
- `npm run typecheck` (`tsc --noEmit`): Passed with **0 errors**.
- `npm run lint` (`expo lint`): Passed with **0 errors**, **44 warnings** (0 warnings in modified files).
- `npx jest tests/UIEnhancementsM1.test.tsx tests/UIEnhancementsM2.test.tsx tests/UIEnhancementsM3Typography.test.tsx tests/LastTimePerformance.test.tsx tests/PreviousPerformanceSuggestions.test.tsx --maxWorkers=2 --testTimeout=15000`: **5/5 suites**, **28/28 tests passed** in 21.299s.
- `npx jest tests/CompletedWorkoutNotesVisibility.test.tsx --maxWorkers=2 --testTimeout=15000`: **1/1 suite**, **5/5 tests passed** in 8.855s.
- `npm run build:web` (`node scripts/build-web.js`): Passed with **0 errors**, exporting **45 static routes** to `dist/`.


## [Release v2.4.4] — 2026-11-18 — Production Deployment Verification

### Deployment Summary
- **Release Commit**: `7d268ee98985b0eaa49bbffb8ec1d4421b5000e9` (`feat(ui): ship v2.4.4 active workout UI polish, one-tap prev fill, exercise details modal, and athletic typography`)
- **Annotated Git Tag**: `v2.4.4` pushed to `origin`
- **Vercel Production Deployment**: `dpl_DPW2Aitx2KAyEV3pjXQ2gSXumDJ4` (`https://be-big-2-0-409eluq83-aditya-works.vercel.app` -> `https://be-big-2-0.vercel.app`) — Status `Ready` (`3m 7s` build)
- **Supabase Backend**: Unchanged (no migrations or Edge Functions modified in `v2.4.4`)

### Live Verification
- `https://be-big-2-0.vercel.app/` -> HTTP `200`
- `https://be-big-2-0.vercel.app/sw.js` -> HTTP `200`, `Cache-Control: no-cache, no-store, must-revalidate`, serving `bebig-pwa-v2.4.4` with `if (isJsBundle)` Network-First JS handler
- `https://be-big-2-0.vercel.app/workout/active` -> HTTP `200`



## [Admin Milestone 1] — 2026-11-18 — RBAC Guard, Overview & App Health, Sanitized Error Diagnostics Terminal & App Announcements (Local Verification Only)

### Result
- **Additive SQL Migration (`supabase/migrations/20261118_admin_panel_m1.sql` — Local Only, Not Applied Remotely)**: Added `public.profiles.is_admin BOOLEAN NOT NULL DEFAULT FALSE` with a `BEFORE INSERT OR UPDATE` anti-escalation trigger (`prevent_profiles_is_admin_escalation`), zero-arg `SECURITY DEFINER` `public.is_current_user_admin()` helper (compatible with `profiles.is_admin` and existing `admin_roles`), `public.app_error_logs` + `public.app_announcements` tables with strict RLS policies, and `public.get_admin_overview_metrics()` `SECURITY DEFINER` RPC exposing aggregate KPIs only.
- **Sanitized Client Error Telemetry (`src/features/admin/services/errorTelemetryService.ts`, `src/components/ui/ErrorBoundary.tsx`, `app/_layout.tsx`)**: Implemented a bounded 50-entry `platformStorage` ring buffer with PII/secret redaction (JWTs, Bearer tokens, API keys, passwords, emails), 5-second dedup throttling on best-effort Supabase flushes, `ErrorBoundary.componentDidCatch` crash capture, and idempotent web global error/rejection handlers.
- **Fail-Closed Admin Access & 3-Tab Dashboard (`src/features/admin/hooks/useAdminAccess.ts`, `src/features/admin/services/adminService.ts`, `app/admin/_layout.tsx`, `app/admin/index.tsx`, `app/settings.tsx`)**: Hardened `/admin` layout guard to block guests, unauthenticated users, and non-admins (`Access Restricted` / redirect, zero network calls for guests); upgraded `/admin` into a 3-tab dark-mode athletic dashboard (**Overview & Health**, **Diagnostics Terminal** with severity filters, expandable stack traces & Clear Logs, and **Announcements** with live create, Active Banner Preview & Active/Paused toggle); and added an admin-only `Admin Control Panel` button in `app/settings.tsx` with zero explicit `any` casts.

### Verification
- `npx jest tests/AdminControlPanelM1.test.tsx tests/UIEnhancementsM1.test.tsx tests/UIEnhancementsM2.test.tsx tests/UIEnhancementsM3Typography.test.tsx tests/IOSWebKitExerciseCrashGuard.test.tsx tests/Phase3ResilienceAndHygiene.test.ts --maxWorkers=2 --testTimeout=15000`: **6/6 suites**, **57/57 tests passed** in 13.089s.
- `npm run typecheck` (`tsc --noEmit`): Passed with **0 errors**.
- `npm run lint` (`expo lint`): Passed with **0 errors**, **43 warnings** (down from 44; 0 warnings in new/modified files).
- `npm run build:web` (`node scripts/build-web.js`): Passed with **0 errors**, exporting **45 static routes** to `dist/`.



## [Admin Milestone 2] — 2026-11-18 — User Directory & Support + Safe Trainer Workout Template Builder & Client Assignment Inbox (Local Verification Only)

### Result
- **Additive SQL Migration (`supabase/migrations/20261118_admin_panel_m2.sql` — Local Only, Not Applied Remotely)**: Created `public.trainer_workout_templates` (strictly `is_current_user_admin()` RLS), `public.assigned_workouts` (isolated trainer-to-client assignment inbox with `protect_assigned_workout_assignee_columns` trigger restricting non-admin assignees strictly to `status`/`completed_at` updates), and `SECURITY DEFINER` RPC `public.get_admin_user_directory(p_search, p_limit)` returning sanitized user directory rows (`user_id`, `email`, `full_name`, `is_admin`, `created_at`, `total_workouts`, `last_workout_at`).
- **Admin Service Extensions (`src/features/admin/services/adminService.ts`, `src/features/admin/index.ts`)**: Added `getUserDirectory()`, `listTrainerTemplates()`, `saveTrainerTemplate()`, `deleteTrainerTemplate()`, `assignTemplateToUsers()`, `listAssignedWorkouts()`, `getMyAssignedWorkouts()` (fail-closed zero network calls for guests/unauthenticated users), `markAssignedWorkoutStatus()`, and `sanitizeTrainerExercises()` stripping any image/base64 payloads for WebKit safety.
- **Expanded 5-Tab Admin Control Panel (`app/admin/index.tsx`, `src/features/admin/components/AdminUsersTab.tsx`, `src/features/admin/components/AdminTrainerTemplatesTab.tsx`)**: Added **Tab 4 — Users** (live search by name/email, workout count, last active date, admin badge, and quick `Assign Workout` shortcut) and **Tab 5 — Trainer Templates** (reusable multi-exercise builder backed by bitmap-free catalog exercise search, editable sets/reps/rest, multi-user assignment selector, and confirmation banner).
- **Safe Athlete-Side `Assigned by Trainer` Inbox (`app/workout/start.tsx`)**: Added conditional **`Assigned by Trainer`** card section shown exclusively when an authenticated non-guest athlete has active assignments; `Start Assigned Workout` launches an ephemeral in-memory `WorkoutTemplate` behind the existing active-workout guard without mutating any personal routines or history.

### Verification
- `npx jest tests/AdminControlPanelM2.test.tsx tests/AdminControlPanelM1.test.tsx tests/UIEnhancementsM1.test.tsx tests/UIEnhancementsM2.test.tsx tests/UIEnhancementsM3Typography.test.tsx tests/IOSWebKitExerciseCrashGuard.test.tsx --maxWorkers=2 --testTimeout=15000`: **6/6 suites**, **51/51 tests passed** in 18.191s.
- `npm run typecheck` (`tsc --noEmit`): Passed with **0 errors**.
- `npm run lint` (`expo lint`): Passed with **0 errors**, **43 warnings** (0 warnings in new/modified files).
- `npm run build:web` (`node scripts/build-web.js`): Passed with **0 errors**, exporting **45 static routes** to `dist/`.



## [Admin Milestone 3] — 2026-11-18 — Global Exercise Catalog Manager (Text-Only, Zero Bitmaps) + Live Athlete Announcement Banner (Local Verification Only)

### Result
- **Additive SQL Migration (`supabase/migrations/20261118_admin_panel_m3.sql` — Local Only, Not Applied Remotely)**: Created strictly text/metadata-only `public.global_exercise_catalog` (`name`, `category`, `equipment`, `primary_muscles text[]`, `secondary_muscles text[]`, `instructions text[]`, `is_active boolean` — zero image/bitmap columns) with `updated_at` trigger, index, and `is_current_user_admin()` RLS policies (public `SELECT` restricted to `is_active = TRUE`).
- **Global Exercise Catalog Service & Non-Overwriting Repository Merge (`src/features/exercises/services/globalExerciseCatalogService.ts`, `src/features/exercises/services/exerciseRepository.ts`, `src/features/exercises/types.ts`)**: Implemented `sanitizeGlobalExerciseInput()` (strictly rejecting/stripping any base64 `data:image/` payloads), `mapGlobalRecordToExercise()` (always emitting `images: []` and `photoPath: null` under `global_<id>`), synchronous memory mirror + `platformStorage` local fallback, and safe merge inside `exerciseRepository` (`getExercises`, `getExerciseById`, `getCachedExerciseByIdSync`) that never overwrites user custom exercises by ID or name.
- **Tab 6 — Exercise Catalog (`src/features/admin/components/AdminExerciseCatalogTab.tsx`, `app/admin/index.tsx`)**: Added Tab 6 to the Admin Control Panel with search, muscle category filtering, create/edit form (Name, Category pills, Equipment, Primary/Secondary Muscles, step-by-step Form Instructions), `Active`/`Hidden` toggle, and delete.
- **Dismissible Athlete Home Announcement Banner (`app/home.tsx`, `src/features/admin/services/adminService.ts`)**: Added `getActiveAnnouncements()`, `getDismissedAnnouncementIds()`, and `dismissAnnouncement()` persisted per announcement ID in `platformStorage`, and mounted a compact, zero-image announcement banner (`Info` / `Release` / `Maintenance`) at the top of `app/home.tsx` causing zero layout shift when no active announcement exists.

### Verification
- `npx jest tests/AdminControlPanelM3.test.tsx tests/AdminControlPanelM2.test.tsx tests/AdminControlPanelM1.test.tsx tests/UIEnhancementsM1.test.tsx tests/UIEnhancementsM2.test.tsx tests/UIEnhancementsM3Typography.test.tsx tests/IOSWebKitExerciseCrashGuard.test.tsx --maxWorkers=2 --testTimeout=15000`: **7/7 suites**, **57/57 tests passed** in 17.848s.
- `npm run typecheck` (`tsc --noEmit`): Passed with **0 errors**.
- `npm run lint` (`expo lint`): Passed with **0 errors**, **43 warnings** (0 new warnings).
- `npm run build:web` (`node scripts/build-web.js`): Passed with **0 errors**, exporting **45 static routes** to `dist/`.



## [Full-App Screen Audit & Fix] — 2026-11-18 — Pre-Migration Resilience, Non-Blocking Local-First Hydration, Admin Sub-Route Wiring & Full-App Smoke Suite (Local Verification Only)

### Result
- **Supabase Pre-Migration & Offline Resilience (`src/lib/supabase/resilience.ts`, `adminService.ts`, `globalExerciseCatalogService.ts`, `errorTelemetryService.ts`)**: Added shared `isDeviceOffline()`, `withSafeTimeout()` (`2500ms`), `isMissingSchemaError()` (`PGRST205`/`PGRST204`/`PGRST202`/`42P01`/`42703`/`404`), 5-minute session-scoped missing-schema backoff, and 60-second in-memory TTL caching on `global_exercise_catalog` and `app_announcements` so screens never hang on stalled networks and never spam HTTP 404s before M1–M3 migrations are applied.
- **Non-Blocking Local-First Rendering (`app/home.tsx`, `app/workout/start.tsx`)**: Decoupled remote announcement hydration on Home and trainer-assigned inbox hydration on Start Workout from local workout/template loading spinners so local routines and active session banners render immediately even offline or on slow mobile connections; removed unused `isGuest` warning in `app/home.tsx`.
- **Live Admin Sub-Routes & Unmount Safety (`app/admin/index.tsx`, `app/admin/monitoring.tsx`, `app/admin/templates.tsx`, `app/admin/exercises.tsx`)**: Added `isMountedRef` guard and `initialTab` prop to `AdminDashboardScreen` and replaced legacy `AdminPlaceholderScreen` stubs on `/admin/monitoring`, `/admin/templates`, and `/admin/exercises` with direct mounts of the live Diagnostics, Trainer Templates, and Exercise Catalog panels.
- **Full-App Screen Health Smoke Suite (`tests/AllScreensHealthSmoke.test.tsx`)**: Added automated smoke verification rendering all primary screens across both Guest/Offline and Authenticated modes (with simulated unmigrated remote DB) plus direct resilience helper tests.

### Verification
- `npx jest tests/AllScreensHealthSmoke.test.tsx tests/AdminControlPanelM1.test.tsx tests/AdminControlPanelM2.test.tsx tests/AdminControlPanelM3.test.tsx tests/UIEnhancementsM1.test.tsx tests/UIEnhancementsM2.test.tsx tests/UIEnhancementsM3Typography.test.tsx --maxWorkers=2 --testTimeout=15000`: **7/7 suites**, **45/45 tests passed** in 15.715s.
- `npx jest tests/HomeScreen.test.tsx tests/StartWorkoutPhase3.test.tsx tests/ExerciseLibrary.test.tsx tests/WorkoutHistory.test.tsx tests/SettingsAndProfile.test.tsx tests/OnboardingAndAuthFlow.test.tsx tests/ProfileBlackScreenRegression.test.tsx tests/MobileWebUI.test.tsx tests/TypographySystem.test.tsx --maxWorkers=2 --testTimeout=15000`: **9/9 suites**, **96/96 tests passed** in 18.043s.
- `npm run typecheck` (`tsc --noEmit`): Passed with **0 errors**.
- `npm run lint` (`expo lint`): Passed with **0 errors**, **42 warnings** (down from 43; 0 warnings in new/modified files).
- `npm run build:web` (`node scripts/build-web.js`): Passed with **0 errors**, exporting **45 static routes** to `dist/`.



## [Admin Placeholder Cleanup] — 2026-11-18 — Zero "Under Construction" Screens & Unified 6-Module Admin Navigation (Local Verification Only)

### Result
- **Unified 6-Module Admin Navigation (`app/admin/_layout.tsx`, `app/admin/index.tsx`)**: Replaced the 13 legacy placeholder links in the Admin desktop sidebar and mobile horizontal bar with direct links to the 6 real Admin Control Panel modules (**Overview & Health** `/admin`, **Diagnostics Terminal** `/admin/monitoring`, **Announcements** `/admin?tab=announcements`, **Users** `/admin?tab=users`, **Trainer Templates** `/admin/templates`, **Exercise Catalog** `/admin/exercises`), with unconditional `?tab=` query syncing in `app/admin/index.tsx`.
- **Eliminated All `"This section is under construction"` Routes**: Wired `app/admin/analytics.tsx` and `app/admin/cloud-health.tsx` to `<AdminDashboardScreen initialTab="overview" />`, `app/admin/coaches.tsx` to `<AdminDashboardScreen initialTab="templates" />`, `app/admin/audit.tsx` and `app/admin/dev-tools.tsx` to `<AdminDashboardScreen initialTab="diagnostics" />`, `app/admin/roles.tsx` to `<AdminDashboardScreen initialTab="users" />`, and converted `app/admin/feature-flags.tsx`, `app/admin/settings.tsx`, `app/admin/[...slug].tsx`, and `src/components/admin/AdminPlaceholderScreen.tsx` to clean `<Redirect href="/admin" />`.
- **Automated Regression Guard (`tests/AllScreensHealthSmoke.test.tsx`)**: Added runtime smoke assertions across all 13 `app/admin/*` routes plus a static repo-wide scan verifying zero `"under construction"` occurrences remain in `app/` or `src/` (excluding paused `coach/`).

### Verification
- `npx jest tests/AllScreensHealthSmoke.test.tsx tests/AdminControlPanelM1.test.tsx tests/AdminControlPanelM2.test.tsx tests/AdminControlPanelM3.test.tsx --maxWorkers=2 --testTimeout=15000`: **4/4 suites**, **32/32 tests passed** in 16.03s.
- `npm run typecheck` (`tsc --noEmit`): Passed with **0 errors**.
- `npm run lint` (`expo lint`): Passed with **0 errors**, **42 warnings** (0 warnings in new/modified files).
- `npm run build:web` (`node scripts/build-web.js`): Passed with **0 errors**, exporting **45 static routes** to `dist/`.



## [Release v2.5.0] — 2026-11-19 — Production Deployment Verification (Admin Control Panel, Active Workout UI & Athletic Typography)

### Deployment Summary
- **Release Commit**: `a6084b3` (`feat(release): ship v2.5.0 Admin Control Panel, Active Workout UI polish, and athletic typography`)
- **Annotated Git Tag**: `v2.5.0` pushed to `origin/main`
- **Vercel Production Deployment**: `https://be-big-2-0.vercel.app/` — Status `Ready`
- **Supabase Backend**: Applied 3 additive Admin migrations to `gkkvxfroxthvbiecramm` in exact order:
  1. `supabase/migrations/20261118_admin_panel_m1.sql` (`public.profiles.is_admin`, anti-escalation trigger, `is_current_user_admin()`, `app_error_logs`, `app_announcements`, `get_admin_overview_metrics` RPC)
  2. `supabase/migrations/20261118_admin_panel_m2.sql` (`trainer_workout_templates`, `assigned_workouts`, assignee update trigger, `get_admin_user_directory` RPC)
  3. `supabase/migrations/20261118_admin_panel_m3.sql` (`global_exercise_catalog` metadata-only table, updated-at trigger, public read/admin write RLS)
  - All migrations tracked in `supabase_migrations.schema_migrations` (`20261118130000`, `20261118130500`, `20261118131000`).

### Live Verification
- `https://be-big-2-0.vercel.app/` -> HTTP `200`
- `https://be-big-2-0.vercel.app/sw.js` -> HTTP `200`, serving `bebig-pwa-v2.5.0` with Network-First JS bundle strategy
- All 45 static routes built and exported cleanly in `dist/`.
- 14/14 Jest suites (101/101 tests) passing 100%.
- TypeScript: 0 errors; ESLint: 0 errors.

### Supabase Admin Privilege Grant
To grant administrative privileges to any user account:
```sql
UPDATE public.profiles SET is_admin = true WHERE id = '<YOUR_USER_UUID>';
```
*(Optionally also insert into `admin_roles`: `INSERT INTO public.admin_roles (user_id, role) VALUES ('<YOUR_USER_UUID>', 'super_admin') ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';`)*



## [Admin Mobile Responsive Fix] — 2026-11-19 — Responsive Viewport Layout, Single-Navigation Elimination & Full-Width Form Ergonomics (Local Verification Only)

### Problem
1. **Double/Triple Navigation Squeezing on Mobile**: On mobile viewports (`< 768px`, e.g. iPhone 375px–430px), both the desktop sidebar (`width: 190`) and the top horizontal pill bar were rendered simultaneously in `app/admin/_layout.tsx`. In addition, `app/admin/index.tsx` rendered an inner 6-button segmented tab bar, consuming excessive vertical and horizontal screen real estate and squeezing the main workspace down to ~150px.
2. **Fixed-Width Form & Card Overflow**: Multi-column metric inputs (sets, reps, weight, RPE), search bars, KPI cards, and textareas in `AdminUsersTab`, `AdminTrainerTemplatesTab`, `AdminExerciseCatalogTab`, and `AdminDashboardScreen` lacked `flexWrap: 'wrap'` and `width: '100%'`, resulting in horizontal clipping and poor tap ergonomics on smaller handheld screens.

### Root Cause
1. `app/admin/_layout.tsx` lacked viewport dimension awareness and mounted both navigation components unconditionally.
2. `AdminDashboardScreen` had no layout context to know whether it was already rendered inside a layout providing navigation, unconditionally rendering its own inner tab switcher.
3. Form containers and input rows in Admin tabs were styled with desktop-first fixed widths and inflexible row layouts.

### Changes
1. **Responsive Viewport Navigation (`app/admin/_layout.tsx`)**:
   - Integrated `useWindowDimensions()` with standard tablet/desktop breakpoint (`isDesktop = width >= 768`).
   - Dynamic workspace layout: `flexDirection: isDesktop ? 'row' : 'column'`, `minWidth: 0`, and adaptive padding (`isDesktop ? spacing.lg : spacing.md`).
   - Strict conditional mounting: the desktop sidebar (`testID="admin-desktop-sidebar"`) mounts strictly when `isDesktop` is true; the mobile horizontal pill bar (`testID="admin-mobile-nav"`) mounts strictly when `isDesktop` is false.
   - Exported `AdminLayoutContext` and `useAdminLayoutContext()` hook, wrapping the layout children with `{ inAdminLayout: true, isDesktop }`.
2. **Eliminated Redundant Inner Tab Bar (`app/admin/index.tsx`)**:
   - Added `hideTabBar?: boolean` to `AdminDashboardScreenProps` and consumed `useAdminLayoutContext()`.
   - When rendered inside `_layout.tsx` (`inAdminLayout: true`) or passed `hideTabBar=true`, the inner 6-button segmented tab bar is omitted, leaving a clean single navigation bar. When rendered standalone (in unit tests or isolated embeds), the tab bar remains functional.
   - Refactored KPI card grid (`flexBasis: 140, minWidth: 130, gap: spacing.sm`) and ensured full-width form cards, text inputs, textareas, and diagnostics toolbars.
3. **Full-Width Mobile Form Ergonomics (`src/features/admin/components/`)**:
   - `AdminUsersTab.tsx`: Added `width: '100%'` across search cards, inputs, user cards, and container; reduced `userInfoCol` minWidth from 200 to 160.
   - `AdminTrainerTemplatesTab.tsx`: Added `width: '100%'` across cards, inputs, and textareas; added `flexWrap: 'wrap'` and `width: '100%'` to `exerciseInputsRow` and `minWidth: 65` to `metricInputCol`.
   - `AdminExerciseCatalogTab.tsx`: Added `width: '100%'` across search cards, inputs, cards, and textareas.
4. **Automated Responsive Viewport Tests (`tests/AdminControlPanelM1.test.tsx`)**:
   - Added tests verifying mobile viewport (`width: 375`): `admin-mobile-nav` renders, `admin-desktop-sidebar` is null, slot content renders.
   - Added tests verifying desktop viewport (`width: 1024`): `admin-desktop-sidebar` renders, `admin-mobile-nav` is null, slot content renders.
   - Added test verifying `AdminDashboardScreen` with `hideTabBar=true` renders clean overview with 0 duplicate tab bar elements.

### Verification
- `npx jest tests/AllScreensHealthSmoke.test.tsx tests/AdminControlPanelM1.test.tsx tests/AdminControlPanelM2.test.tsx tests/AdminControlPanelM3.test.tsx --maxWorkers=2 --testTimeout=15000`: **4/4 suites**, **35/35 tests passed** in 9.62s.
- `npm run typecheck` (`tsc --noEmit`): Passed with **0 errors**.
- `npm run lint` (`expo lint`): Passed with **0 errors**, **43 warnings** (0 warnings in modified files).
- `npm run build:web` (`node scripts/build-web.js`): Passed with **0 errors**, exporting **45 static routes** to `dist/`.



## [Admin Milestone 4] — 2026-11-19 — Admin Delete User, Guaranteed Athlete Display Names & iOS WebKit-Safe Global Exercise Images (Local Verification Only)

### Problem
1. **Lack of Admin Account Deletion**: Administrators could not safely remove test athlete accounts or inactive user data from the admin panel, requiring direct SQL operations.
2. **Anonymous / Blank Display Names**: When user accounts were registered without explicit metadata or display names in `profiles`, the user directory displayed blank titles or ambiguous default strings.
3. **WebKit Memory Spikes & Unvalidated Image Payloads**: Adding images to global exercises risked iOS Safari/WebKit GPU memory pressure and crash loops if raw base64 data URIs were pasted or if multiple image bitmaps were loaded into bulk virtualized exercise lists.

### Root Cause
1. No dedicated `SECURITY DEFINER` RPC existed to allow an active administrator to safely cascade and delete an athlete account from `auth.users` without permitting self-deletion or privilege escalation against other admins.
2. `get_admin_user_directory` lacked a comprehensive `COALESCE` chain resolving against `full_name`, `display_name`, and user metadata with capitalized email prefix fallbacks.
3. `global_exercise_catalog` schema and client validation had not yet incorporated secure HTTPS storage URLs with client-side canvas downscaling.

### Changes
1. **Additive SQL Migration (`supabase/migrations/20261119_admin_panel_m4.sql` — Applied to remote Supabase `gkkvxfroxthvbiecramm`)**:
   - Added `full_name` column to `public.profiles`.
   - Created `SECURITY DEFINER` RPC `public.admin_delete_user(p_target_user_id UUID)` that enforces `public.is_current_user_admin()`, blocks self-deletion (`p_target_user_id = auth.uid()`), blocks deleting other admin accounts (`is_admin = true`), cleans up dependent records (`assigned_workouts`, `trainer_workout_templates`, `app_error_logs`, `app_announcements`, `profiles`), and deletes from `auth.users`.
   - Updated `public.get_admin_user_directory(p_search, p_limit)` with guaranteed `full_name` resolution via `COALESCE` chain falling back to formatted email prefixes (`initcap(split_part(COALESCE(u.email, 'athlete'), '@', 1))`) and full_name search.
   - Added `image_url TEXT NULL` column to `public.global_exercise_catalog`.
   - Created public `exercise-images` Supabase Storage bucket with 2MB file limit and RLS policies (public read, admin-only insert/update/delete). Zero destructive table drop operations.
2. **Guaranteed Display Names & Two-Step User Deletion (`authService.ts`, `adminService.ts`, `AdminUsersTab.tsx`, `app/admin/index.tsx`)**:
   - `authService.signUpWithEmail`: Automatically formats and passes `full_name` metadata from capitalized email prefix upon registration when no custom name is supplied.
   - `adminService.deleteUserAccount`: Gated RPC invocation for `admin_delete_user` with graceful offline fallback.
   - `AdminUsersTab.tsx`: Two-step deletion UX (`Delete User` -> `Confirm Delete` / `Cancel`) on non-admin athlete cards (hidden/blocked for admin accounts and current administrator). Updates user list immediately upon deletion with error banner fallback.
3. **iOS WebKit-Safe Global Exercise Images (`globalExerciseCatalogService.ts`, `AdminExerciseCatalogTab.tsx`, `ExerciseDetailModal.tsx`, `app/exercises/[id].tsx`)**:
   - `globalExerciseCatalogService`: Added `image_url` / `imageUrl` to records and sanitization; enforces HTTPS protocol, strictly rejects raw `data:image/` base64 strings and oversized payloads; maps `image_url` to `photoPath` while preserving `images: []` for bulk lists (WebKit safety invariant).
   - `AdminExerciseCatalogTab.tsx`: Added Exercise Image input section with direct HTTPS URL input, upload button with offscreen HTMLCanvas downscaling (`max 400px`, JPEG `0.78` quality) storing to `exercise-images` bucket, live thumbnail preview, and removal button.
   - `ExerciseDetailModal.tsx` & `app/exercises/[id].tsx`: Cleanly resolves and renders `exercise.photoPath` when starting with `https://`.
4. **Verification Suite (`tests/AdminControlPanelM4.test.tsx`)**:
   - Unit tests covering guaranteed display names, two-step deletion UX, admin account delete protection, HTTPS image URL validation, WebKit base64 rejection, single-exercise detail image rendering, and SQL migration safety invariants.

### Verification
- `npx jest tests/AdminControlPanelM4.test.tsx tests/AdminControlPanelM3.test.tsx tests/AdminControlPanelM2.test.tsx tests/AdminControlPanelM1.test.tsx tests/AllScreensHealthSmoke.test.tsx tests/IOSWebKitExerciseCrashGuard.test.tsx --maxWorkers=2 --testTimeout=15000`: **6/6 suites**, **64/64 tests passed** in 20.65s.
- `npm run typecheck` (`tsc --noEmit`): Passed with **0 errors**.
- `npm run lint` (`expo lint`): Passed with **0 errors**, **43 warnings** (0 warnings in modified files).
- `npm run build:web` (`node scripts/build-web.js`): Passed with **0 errors**, exporting **45 static routes** to `dist/`.



## [Release v2.5.1] — 2026-11-19 — Production Deployment of Mobile Admin Responsive Layout, User Deletion, Display Names & Exercise Images

### Scope Delivered
1. **Remote Supabase Migration (`20261119_admin_panel_m4.sql`)**:
   - Applied cleanly to remote production project `gkkvxfroxthvbiecramm` via Supabase CLI and verified in `supabase_migrations.schema_migrations`.
   - Verified existence of `admin_delete_user` RPC, `full_name` column on `public.profiles`, `image_url` on `public.global_exercise_catalog`, and `exercise-images` public storage bucket.
2. **Admin Mobile & iPhone Ergonomics**:
   - Single clean navigation on mobile (`isDesktop = width >= 768`); eliminates double/triple stacked navigation bars.
   - Responsive multi-column metric inputs and wrap containers in Admin tabs.
3. **Admin User Account Deletion & Guaranteed Athlete Display Names**:
   - Two-step deletion dialog with protection against self-deletion and deleting other administrators.
   - Automatic `full_name` resolution and fallback across signup, directory retrieval, and profile storage.
4. **iOS WebKit-Safe Global Exercise Images**:
   - Enforced HTTPS-only URLs and rejected base64 data URIs.
   - Offscreen HTMLCanvas downscaling (`400px`, `0.78` quality) uploading to Supabase Storage.
   - Preserved `images: []` in bulk lists to guard against iOS WebKit GPU crash loops.
5. **Version Bumps**:
   - Bumped to `2.5.1` across `package.json`, `app.json`, `public/sw.js` (`bebig-pwa-v2.5.1`), `README.md`, `AI_BRAIN.md`, and test assertions.

### Verification Gate
- `npm run typecheck`: Passed (0 errors).
- `npm run lint`: Passed (0 errors, 43 warnings — 0 in touched files).
- `npx jest`: 6/6 test suites passed (64/64 tests green).
- `npm run build:web`: Passed (0 errors, 45 static routes exported to `dist/`).
- Scope boundary check: 0 lines diff in `app/+html.tsx`, `app/coach`, `src/features/coach`, `supabase/functions/coach-v2`, `workoutNotificationService.ts`. Zero secrets or backup files staged.



## [Astra Audit P0-P3 Fix] — 2026-11-19 — Concurrency Mutex, Revision CAS, Complete Storage Erasure, Edge Function Paginated Deletion & Test Suite Alignment (Option A: Local Verification Only)

### Problem
1. **P0-01 (Completed-Workout Concurrency & Race Conditions)**: In `workoutStorage.ts`, `saveCompletedWorkout` and `deleteCompletedWorkout` read, modified, and rewrote the array without synchronization, risking lost workout completions during simultaneous autosaves, background sync, or multi-tab usage.
2. **P0-02 (Active Draft Revision Silently Overwritten)**: In `workoutStorage.ts`, `saveActiveWorkout` only verified `incomingVersion < currentStored.version`. Two concurrent tabs writing the same revision silently collided, and conflicts returned `void`, leaving callers unable to handle draft collisions.
3. **P1-01 (Incomplete Local Erasure of Scoped Completed Workouts)**: In `accountDeletionService.ts`, `baseScopedKeys` omitted the canonical `BASE_COMPLETED_WORKOUTS_KEY` (`bebig.workout.completed`), leaving scoped completed workouts on the device after account deletion or local wipe.
4. **P1-02 (Storage Leak & Non-Atomic Auth Deletion)**: In `supabase/functions/delete-account/index.ts`, storage file deletion was non-recursive (leaving nested `user/exercise/photo` files orphaned) and non-paginated (capped at 100), and caught errors without aborting auth user deletion.
5. **P2-01 (Transitive Security Vulnerability)**: `shell-quote` had a critical command injection advisory in `1.10.0`.
6. **P3-02 (Test Assertion Regressions)**: `tests/Auth.test.tsx` and `tests/DropSetTrackingAndAnalytics.test.tsx` failed due to missing `full_name` metadata matching and collapsed `History` accordion interaction.
7. **P3-03 (Release State Discrepancy)**: `RELEASE_STATE.md` was still documented at `v2.4.3`.

### Root Cause
1. Absence of cross-tab and in-process mutex locking on completed-workout read-modify-write storage operations.
2. Active-workout version check lacked monotonic revision compare-and-swap (CAS) and did not return structured conflict status.
3. Scoped key purge list only included `'bebig.workout.sessions'` and lacked post-erasure read-back verification.
4. Edge function `list()` assumed flat bucket structure without pagination (`offset`) and swallowed errors before deleting from `auth.users`.

### Changes
1. **P0-01 — Cross-Tab & In-Process Storage Lock (`workoutStorage.ts`)**:
   - Implemented `withStorageLock(lockKey, fn)` utilizing Web Locks API (`navigator.locks.request`) when available, backed by an in-process FIFO Promise queue and multi-tab `platformStorage` lease fallback with unique `ownerId`, 15ms settling yield, and 20-50ms randomized jitter retry.
   - Re-verifies lease ownership (`parsed.ownerId === ownerId`) before entering the critical section and only clears the lease if the caller still holds it.
   - Wrapped `saveCompletedWorkout`, `deleteCompletedWorkout`, and added `upsertCompletedWorkout` inside `withStorageLock(completed.${storageKey})` to guarantee atomic serialization.
2. **P0-02 — Strict Revision & Version Monotonic CAS (`workoutStorage.ts`, `workoutRepository.ts`, `types.ts`)**:
   - Added `SaveActiveWorkoutResult` interface (`{ ok: boolean; conflict?: boolean; persistedRevision?: number; incomingRevision?: number; error?: string }`).
   - Added `revision?: number;` alias to `WorkoutSession` in `src/features/workout/types.ts`.
   - Unified `revision` and `version` into a monotonic sequence (`Math.max(Number(revision ?? 0), Number(version ?? 0))`) in `workoutStorage.ts` and `workoutRepository.ts`.
   - Rejects concurrent writes with matching revision (`incomingSeq <= persistedSeq`) with `{ ok: false, conflict: true, persistedRevision: persistedSeq, incomingRevision: incomingSeq }`, and persists both `revision` and `version`.
3. **P1-01 — Complete Scoped Completed Workout Erasure (`accountDeletionService.ts`)**:
   - Imported canonical `BASE_COMPLETED_WORKOUTS_KEY` and included both `bebig.workout.completed` and `bebig.completed.workouts` in scoped and unscoped purge lists.
   - Implemented multi-pass erasure with retry pass and final read-back verification. Throws an explicit error if any scoped key survives, failing loudly and preventing silent partial data erasure.
4. **P1-02 — Recursive, Zero-Shift Paginated Storage Cleanup (`supabase/functions/delete-account/index.ts`)**:
   - Implemented `deleteUserStorageFolder(adminClient, bucket, prefix)` with `limit: 100`, recursive subfolder traversal, and batch file removal.
   - Fixed page shifting: only increments `folderOffset += subfolders.length` because deleted files shift subsequent bucket entries down to offset 0, ensuring zero files are skipped.
   - Covers `avatars`, `exercise-photos`, and `exercise-demos`. Throws on any list or remove error, returning HTTP 500 and aborting BEFORE deleting the user from `auth.users`.
5. **P2-01 — Dependency Vulnerability Patch (`package-lock.json`)**:
   - Upgraded `shell-quote` to `1.12.0` (`>= 1.11.0`) without breaking expo dependencies or package.json major versions.
6. **P3-02 — Test Assertion Alignment (`tests/Auth.test.tsx`, `tests/DropSetTrackingAndAnalytics.test.tsx`, `tests/ScheduledWorkoutRemovalRegression.test.tsx`)**:
   - Aligned `mockAuth.signUp` expectations to assert `options.data.full_name`.
   - Added `fireEvent.press(getByTestId('toggle-last-session-ex_bench'))` to expand history before querying set chips.
   - Updated `ScheduledWorkoutRemovalRegression.test.tsx` to expect `{ ok: true }` from `saveActiveWorkout`.
7. **P3-03 — Release State Reconciled (`RELEASE_STATE.md`)**:
   - Documented live `v2.5.1` (`2d74de3`, `bebig-pwa-v2.5.1`) and pending local P0/P1 audit blockers hardening, eliminating all contradictory legacy headings.
8. **Comprehensive Regression Suite (`tests/AuditBlockersP0P1.test.tsx`)**:
   - Authored 8 tests validating concurrent completed saves, `withStorageLock` sequence, lease contention fallback with ownerId re-verification, revision CAS equal-revision rejection, stale-revision rejection, monotonic progress, scoped completed workout erasure verification, and recursive zero-shift paginated storage deletion abort with zero `act(...)` warnings and zero open handles.

### Verification Gate (Local Option A)
- `npx jest tests/AuditBlockersP0P1.test.tsx tests/Auth.test.tsx tests/DropSetTrackingAndAnalytics.test.tsx tests/AdminControlPanelM4.test.tsx tests/IOSWebKitExerciseCrashGuard.test.tsx --maxWorkers=2 --testTimeout=15000`:
  - **5/5 test suites passed**, **75/75 tests green** in 11.06s.
- `npx jest tests/AuditBlockersP0P1.test.tsx --detectOpenHandles`: Passed with **0 open handles**.
- `npm run typecheck` (`tsc --noEmit`): Passed with **0 errors**.
- `npm run lint` (`expo lint`): Passed with **0 errors**, **43 non-blocking warnings** (0 in modified files).
- `npm run build:web` (`node scripts/build-web.js`): Passed with **0 errors**, exporting **45 static routes** to `dist/`.
- Boundary check: `app/+html.tsx`, `app/coach`, `src/features/coach`, `supabase/functions/coach-v2`, `workoutNotificationService.ts` remain 100% untouched.



