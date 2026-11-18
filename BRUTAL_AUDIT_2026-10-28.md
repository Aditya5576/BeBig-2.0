# BeBig 2.0 — Brutal Production Audit

**Audit date:** 2026-10-28  
**Application:** Expo / React Native / TypeScript / Supabase / Vercel PWA  
**Live URL checked:** https://be-big-2-0.vercel.app (HTTP 200 via independent fetch)  
**Purpose:** Actionable work queue for Antigravity. This is an evidence-based static/configuration/test audit, not a penetration-test certificate or physical-device sign-off.

## Executive verdict

**Release confidence: RED — do not treat the current repository as a clean release candidate.**

The application has unusually strong work in local-first persistence, per-user scoping, sync conflict handling, RLS, monitoring redaction, and regression-test breadth. However, the release gate is currently broken: **21/114 test suites fail (49/1,273 tests), the documented build command fails on Windows, dependency scanning reports 71 vulnerable package nodes, account deletion/privacy surfaces are absent, local production data and secrets exist in an insufficiently ignored temp directory, and the web UI explicitly disables zoom.**

The highest-risk functional failure is **guest-to-account migration**. A failing test shows an active guest workout is not migrated through the expected save path. That can become user-visible workout loss during conversion to an account.

## Verification snapshot

| Gate | Result | Evidence |
|---|---:|---|
| Production root | PASS | Live root returned HTTP 200 and rendered BeBig shell text. |
| TypeScript | PASS | `npm run typecheck` completed successfully. |
| ESLint | WARN | 0 errors, **69 warnings**, including stale hook dependencies in active workout and timer paths. |
| Jest | **FAIL** | **21 failed / 93 passed suites; 49 failed / 1,224 passed tests; 1,273 total.** Jest also failed to exit because of open handles. |
| Web build (Windows) | **FAIL** | `npm run build:web` uses POSIX inline env syntax; Windows reports `'EXPO_PUBLIC_GIT_SHA' is not recognized`. Vercel/Linux may still build. |
| Production dependency audit | **FAIL** | `npm audit --omit=dev`: **71** vulnerable nodes: 39 critical, 13 high, 19 moderate. Audit reachability must be triaged rather than blindly accepting aggregate severity. |
| CI/CD definition | **MISSING** | No `.github` workflow found. |
| Skipped/focused tests | PASS | No `.skip` / `.only` found in tests. |

## Severity model

- **P0 Critical:** credible data exposure/loss or privilege compromise; stop release.
- **P1 High:** major user failure, security/privacy gap, or broken release control.
- **P2 Medium:** reliability, compatibility, performance, accessibility, or maintainability defect.
- **P3 Low:** cleanup/documentation/developer-experience improvement.

---

# P0 — Critical findings

## AUD-001 — Production-like user backup exists inside the repository working tree

**Evidence:** `supabase/.temp/backup_production_pre_v2.json` contains 13,200 lines of UUID-linked profile and workout-related production-style data, including display name, age, height, weight, training schedule, goals, and avatar URL. The file is currently untracked, but `.gitignore` ignores only `supabase/.temp/**` in ESLint—not Git. Git status also exposes local JWT secret files and PostgREST configs in this directory.

**Impact:** Accidental commit, IDE upload, support-bundle inclusion, malware collection, backup leakage, and privacy breach. Fitness/body-profile data is sensitive personal data even when email is absent.

**Required action:**
1. Add `supabase/.temp/` to `.gitignore` immediately.
2. Move the backup outside the repository; encrypt it at rest; define owner and deletion date.
3. Delete local `jwt.secret`, `jwt_test.secret`, PostgREST configs, and copied binaries when no longer needed.
4. Search Git history and remote branches for these filenames and representative UUIDs; if ever committed, purge history and assess notification obligations.
5. Add secret/PII scanning (Gitleaks/TruffleHog plus a custom production-backup filename rule) to pre-commit and CI.

**Change impact:** Do not delete the only recovery copy until its recovery value and an encrypted replacement are confirmed. Ignoring the directory will not remove already tracked files (`linked-project.json` is tracked).

**Acceptance:** Clean `git status`; no production export beneath repository root; scanner blocks seeded test secret; documented retention owner/date.

## AUD-002 — Guest-to-account migration regression can lose an active workout

**Evidence:** `tests/GuestMigration.test.tsx` fails: expected `workoutStorage.saveActiveWorkout(..., authScope)` was never called.

**Impact:** A guest who creates an account during an active workout may lose the in-progress session or find it stranded under the guest scope.

**Required action:** Reproduce with a real guest active session; make migration idempotent and transactional in ordering; preserve the guest copy until authenticated-scope readback verifies the same session ID and content; expose a retry state rather than silently clearing guest state.

**Change impact:** Migration touches guest storage, auth callbacks, active-workout tokens/tombstones, sync metadata, account switching, and completed workouts/templates/custom exercises. Run all migration, auth-hydration, account-switch, storage reliability, and sync race suites after any change.

**Acceptance:** Existing failing test passes plus new interruption tests for crash after copy/before cleanup, duplicate sign-in callbacks, network loss, storage quota failure, and two-tab conversion.

---

# P1 — High findings

## AUD-003 — Release test gate is broadly red

**Evidence:** 21 failed suites and 49 failed tests. Confirmed failure clusters include:
- `GuestMigration.test.tsx` — active guest workout migration.
- `AuthSecurityPasswordVerification.test.tsx` — expected user-facing sign-in failure state absent.
- `ProgressExercise.test.tsx` — summary metrics and notes no longer present under expected contract.
- `ExerciseThumbnail.test.tsx` — approved media renders fallback instead of image.
- `LastTimePerformance.test.tsx` — name fallback does not resolve prior performance.
- `ComprehensiveAudit.test.tsx` — hard-coded catalog count expects 12 but catalog now has 281.
- Jest teardown/open-handle errors caused by Supabase auth auto-refresh and asynchronous component work.

**Impact:** Tests cannot currently distinguish deployable code from regressions. Some failures may be stale expectations, but that itself means the safety net is untrustworthy.

**Required action:** Triage every failed suite as product regression, intended behavior change, or test-harness defect. Never bulk-update snapshots/expectations. Add a release command that fails on any suite failure and open handle.

**Acceptance:** 0 failed tests; Jest exits naturally; test console errors are either asserted or eliminated; results repeat in a clean checkout.

## AUD-004 — No enforceable CI/CD quality gate

**Evidence:** No `.github` workflow exists. Local release documentation says deployment occurs automatically from `main`.

**Impact:** A push to `main` can deploy code despite failing tests, lint warnings, vulnerable dependencies, or a broken build.

**Required action:** Protect `main`; require PR checks for clean install (`npm ci`), typecheck, lint with a warning budget, tests, web build, dependency/secret scans, and migration lint. Separate preview and production environment approvals. Add rollback/runbook links and deployment concurrency control.

**Acceptance:** Direct push blocked; required checks shown on PR; a deliberately failing test prevents deployment; production requires approved promotion or verified green main.

## AUD-005 — Dependency vulnerability backlog includes direct, high-risk packages

**Evidence:** `npm audit --omit=dev` reports 71 vulnerable nodes: 39 critical, 13 high, 19 moderate. Notable actionable paths include:
- Direct `xlsx@0.18.5`: prototype pollution and ReDoS advisories; npm reports no automatic fix.
- `shell-quote` critical command-injection path through React Native tooling.
- `node-forge`, `undici`, `source-map-js`, `glob`, `minimatch`, `decode-uri-component`, and `zod` advisories.

**Impact:** Supply-chain compromise and build/CLI exposure; some libraries may also execute in client export flows. The aggregate Expo/React Native severity is inflated by transitive tooling, so reachability matters.

**Required action:**
1. Generate a dependency reachability/SBOM review—do not run blind `npm audit fix --force`.
2. Replace vulnerable SheetJS Community npm package or pin a vendor-supported safe build; test formula injection and hostile workbook content even though current feature mainly exports files.
3. Upgrade Expo/React Native/Sentry only as a compatibility matrix, with native/web regression testing.
4. Add Renovate/Dependabot and a documented vulnerability SLA.

**Change impact:** Expo upgrades can alter Metro, router static export, notifications, auth redirects, SecureStore, native permissions, and Jest presets.

**Acceptance:** No known exploitable critical/high path, or time-bound written exception with owner, reachability evidence, compensating controls, and expiry.

## AUD-006 — Account deletion is not implemented

**Evidence:** Settings displays an `account-deletion-notice` but repository search finds no deletion workflow, privacy policy, retention policy, or deletion endpoint.

**Impact:** Users cannot self-delete cloud account data. This is a major trust, privacy, and app-store compliance risk. Signing out does not delete profiles, workouts, templates, photos, avatars, auth account, telemetry, or backups.

**Required action:** Implement re-authenticated deletion through a server/Edge Function using service authority, with explicit confirmation, queued/idempotent cleanup, tombstone strategy, storage bucket cleanup, auth-user deletion, audit record, and recovery/retention policy. Clarify guest-device erase separately.

**Change impact:** Supabase cascading deletes remove DB rows but not necessarily Storage objects or external telemetry/backups. Sync clients must not resurrect locally cached records after deletion.

**Acceptance:** E2E deletion test verifies DB, storage, auth, local cache, sync metadata, and re-login behavior; privacy copy states retention exceptions.

## AUD-007 — Privacy/legal transparency is absent

**Evidence:** No privacy policy, terms, consent/notice, retention schedule, or AI data-use disclosure found. The app processes email, body measurements, exercise history, photos, usage telemetry, and AI-coach context.

**Impact:** Clients do not know what is collected, where it is stored, who receives it (Supabase, Sentry, AI providers, Wger, Vercel), or how to exercise data rights.

**Required action:** Publish and link privacy policy/terms before sign-up and in settings. Inventory data categories, purposes, processors, retention, deletion/export, contact route, cross-border handling, age restrictions, and AI-provider data transfer. Record consent/version where legally required.

**Acceptance:** Legal links are reachable pre-auth and post-auth; data inventory maps each field and vendor; deletion/export request procedure is tested.

## AUD-008 — Web accessibility intentionally disables user zoom and gestures

**Evidence:** `app/+html.tsx` claims zoom is preserved, but viewport contains `maximum-scale=1, user-scalable=no`; JS prevents `gesturestart`, `gesturechange`, and `gestureend` globally.

**Impact:** Low-vision users cannot pinch zoom; WCAG 1.4.4 risk; browser and assistive gestures can break.

**Required action:** Remove `user-scalable=no`, `maximum-scale=1`, and blanket gesture prevention. Fix layout issues instead of blocking accessibility behavior. Test 200%/400% zoom, iOS VoiceOver, Android TalkBack, keyboard-only web, reduced motion, and dynamic text.

**Change impact:** Re-test modal sizing, active workout input layout, iOS keyboard, and fixed overlays after restoring zoom.

**Acceptance:** Zoom works without clipping or data loss; automated axe checks and manual screen-reader checklist pass.

## AUD-009 — Build script is not cross-platform and local release verification fails

**Evidence:** `build:web` uses POSIX `EXPO_PUBLIC_GIT_SHA=${VERCEL_GIT_COMMIT_SHA:-$EXPO_PUBLIC_GIT_SHA} ...`; Windows fails before Expo starts.

**Impact:** Windows developers cannot execute the documented release check, increasing dependence on unverified Vercel builds.

**Required action:** Replace inline shell syntax with a small Node script or `cross-env-shell`; preserve Vercel SHA fallback; test Windows and Linux.

**Acceptance:** `npm run build:web` produces `dist` in clean Windows and Linux environments and includes the expected SHA.

## AUD-010 — Server functions have permissive CORS and weak method/error contracts

**Evidence:** `coach-agent` and `admin-assign-role` return `Access-Control-Allow-Origin: *`. Neither explicitly rejects non-POST methods after preflight. Admin function returns raw `err.message`; role input relies mainly on DB rejection.

**Impact:** JWT authorization prevents anonymous privilege escalation, but broad browser origins expand abuse/phishing surface, error details can leak internals, and malformed bodies/methods consume resources. AI requests are quota-limited per day but not burst-, IP-, payload-, or concurrency-limited.

**Required action:** Allowlist production/preview origins where browser use requires CORS; reject methods with 405; cap body/message size; schema-validate all inputs; validate role enum and prohibit unsafe self-demotion/last-super-admin removal; return generic errors with correlation IDs; add burst/concurrency limits.

**Acceptance:** Security tests cover missing/expired JWT, hostile Origin, oversized JSON/message, invalid role/action, self-target, last super-admin, malformed JSON, and rate bursts.

## AUD-011 — Local sensitive workout data is unencrypted on web

**Evidence:** `platformStorage` stores data in IndexedDB or localStorage on web. This is origin-isolated but not encrypted. The same storage includes workouts, body/profile preferences, and drafts.

**Impact:** XSS, malicious browser extensions, shared OS profiles, device theft, or browser backup can expose data. CSP currently allows inline scripts/styles, weakening XSS defense.

**Required action:** Document threat model honestly; minimize stored fields; provide “erase local data”; add inactivity/session controls for shared devices; reduce XSS surface; consider WebCrypto envelope encryption only if key lifecycle is designed correctly (do not claim encryption if key is stored beside ciphertext).

**Acceptance:** Privacy copy states local storage behavior; local erase is verified; XSS/CSP hardening complete; security review records accepted residual risk.

---

# P2 — Medium findings

## AUD-012 — CSP requires unsafe inline execution and lacks modern isolation headers

**Evidence:** `vercel.json` CSP includes `'unsafe-inline'` for scripts and styles. No HSTS, `Permissions-Policy`, or `Cross-Origin-Opener-Policy` is configured despite README claiming permissions policies. Inline service-worker bootstrap in `+html.tsx` drives the script exception.

**Impact:** Reduced XSS protection and documentation drift.

**Required action:** Move inline script/style to static files or add generated nonces/hashes; add HSTS (after domain readiness), restrictive Permissions-Policy, COOP as compatibility permits, and CSP reporting. Remove unused Wger connections if architecture changes.

**Acceptance:** CSP has no `unsafe-inline` for scripts; security-header integration test checks every HTML route.

## AUD-013 — Cache policy may preserve authenticated navigation HTML on shared devices

**Evidence:** Service worker caches successful same-origin navigation responses by request URL. Header checks protect API requests, but ordinary document navigation usually carries cookies rather than Authorization headers. App data is not SSR-rendered today, limiting current exposure.

**Impact:** If future server rendering or personalized HTML is introduced, private HTML could be cached. Cached old route shells can also produce version skew.

**Required action:** Cache only a known public shell (`/`/`index.html`), never arbitrary navigation URLs; honor `Cache-Control: no-store`; document update/version recovery; add offline tests for auth callback and unknown routes.

**Change impact:** Deep-link offline fallback must still work; do not break active workout continuity.

## AUD-014 — Auth and async lifecycle leaks keep Jest alive

**Evidence:** Jest reports open handles and Supabase auto-refresh callbacks after environment teardown. Multiple tests also log state updates outside `act(...)`.

**Impact:** Flaky/slow CI, masked real lifecycle leaks, possible duplicate timers/listeners in development or hot reload.

**Required action:** Use a test Supabase client with `autoRefreshToken: false`; ensure subscriptions/timers are disposed; add `afterEach` cleanup; run representative suites with `--detectOpenHandles`.

**Acceptance:** Jest exits naturally in repeated runs; no teardown import errors; no unasserted React act warnings.

## AUD-015 — Hook-dependency warnings exist in critical paths

**Evidence:** Lint reports missing dependencies in active workout autosave/flush, session loading, router callbacks, timers, template editor, exercise detail, progress screens, and rest overlay.

**Impact:** Stale closures can write old workout state, misroute, show stale analytics, or miscalculate insets/timers.

**Required action:** Review each warning semantically; stabilize callbacks or use refs deliberately; do not blindly add dependencies that cause write loops. Restore stricter lint incrementally and fail CI on new warnings.

**Acceptance:** Zero hook warnings in auth, storage, sync, active workout, timers, and navigation; regression tests cover stale-state scenarios.

## AUD-016 — Global memory-cache clearing crosses feature and user boundaries

**Evidence:** `workoutStorage.clearMemoryCache()` calls `platformStorage.clearMemoryCache()`, which clears the single global map used by every feature. Sign-out calls this method and then repeats clears through template/custom/profile services.

**Impact:** Surprising coupling, redundant work, and potential loss of unrelated pending volatile fallback data when one feature “clears its cache.”

**Required action:** Namespace memory caches or expose one explicit app-level cache reset. Ensure persistent writes complete before sign-out/switch.

**Acceptance:** Unit test proves clearing workout cache cannot delete unrelated volatile keys unless a deliberate global reset is invoked.

## AUD-017 — SecureStore is being used as a general workout database

**Evidence:** Native `platformStorage` writes serialized active/completed workouts and other collections to Expo SecureStore.

**Impact:** Keychain/Keystore is optimized for small secrets, not growing workout histories or photos/large JSON. Platform size/performance constraints can cause write failures and latency. Current code throws for writes, but several callers swallow errors.

**Required action:** Keep auth tokens/keys in SecureStore; migrate domain data to SQLite with schema/versioned transactions and backup policy. Provide migration/readback/rollback tests.

**Change impact:** Highest-risk migration in the app; must preserve active workout, guest scope, tombstones, sync watermarks, and account-switch isolation.

## AUD-018 — Several persistence errors are silently swallowed

**Evidence:** Workout token/tombstone helpers and cleanup paths contain empty catches. Auth initialization also converts any exception to unauthenticated state without diagnostics.

**Impact:** Storage corruption/quota/security errors become invisible, and recovery behavior can appear as logout or lost resume state.

**Required action:** Classify errors, capture sanitized telemetry, expose recoverable UI, and fail closed only where appropriate. Never log workout notes or credentials.

**Acceptance:** Inject quota, parse, permission, and unavailable-storage faults; app gives deterministic recovery and monitoring tags without PII.

## AUD-019 — Admin role mutation is not fully invariant-protected

**Evidence:** Edge function allows a super admin to assign/remove any target role. It does not explicitly prevent removal/demotion of the final super admin or define self-mutation policy. Audit-log insert failure does not abort the role change.

**Impact:** Administrative lockout and incomplete forensic record.

**Required action:** Put role change and audit event in one transaction/RPC; lock/count super admins; prevent removing the last one; decide and enforce self-change rules; validate target existence and role enum.

**Acceptance:** Concurrent tests prove at least one super admin always remains and every successful role mutation has an audit record.

## AUD-020 — Public avatar bucket exposes permanent profile images

**Evidence:** `avatars` bucket is public and profile stores a permanent public URL. Authenticated users can list all avatar objects, though write/delete is folder-isolated.

**Impact:** Anyone with URL can view an avatar indefinitely; authenticated users can enumerate paths. This may be acceptable for public social profiles, but BeBig is not documented as one.

**Required action:** Make bucket private unless public avatars are a product requirement; use signed URLs with expiry and refresh handling; restrict SELECT/list policy to own folder. Strip EXIF metadata and validate decoded image content, not only MIME/size.

**Acceptance:** Cross-user list/read tests match documented privacy expectation; malicious polyglot and oversized decoded image tests pass.

## AUD-021 — AI coach needs stronger safety, privacy, and abuse controls

**Evidence:** Coach function forwards user message plus workout context to one of four external AI providers. It has a 20/day quota but no visible consent/disclosure, payload cap, per-minute throttling, or explicit “not medical advice” boundary in audited surfaces.

**Impact:** Sensitive workout/body data sharing, prompt abuse, cost spikes, and unsafe health guidance.

**Required action:** Obtain explicit AI disclosure/consent, minimize context, prohibit credentials/PII, cap message/history sizes, add burst and budget limits, define provider retention settings, add safety filters, and clearly state non-medical scope with emergency guidance exclusions.

**Acceptance:** Red-team tests for prompt injection, self-harm/eating-disorder content, injury/medical claims, oversized payloads, quota races, provider failover, and data leakage.

## AUD-022 — Architecture and release documentation are materially stale

**Evidence:** `ARCHITECTURE.md` calls offline persistence/cloud sync future work, while README and source say it is live. It says the client must never call Wger directly, but `AI_BRAIN.md` and source confirm direct client fetches. `RELEASE_STATE.md` lists an old branch/HEAD and “pending uncommitted” work inconsistent with current v2.4.1 files.

**Impact:** Engineers make wrong change-impact decisions and may delete live systems or implement duplicate architecture.

**Required action:** Rewrite docs from source truth; tag planned vs implemented; add architecture decision records for direct Wger, storage engine, sync, and admin surfaces. Automate version consistency checks.

## AUD-023 — No formal database migration verification/rollback strategy

**Evidence:** Timestamped SQL migrations exist, but no CI migration linter, ephemeral database test, schema snapshot, rollback/runbook, or production drift check was found.

**Impact:** RLS/policy or trigger changes can expose data or break sync only after deployment.

**Required action:** Test migrations against a fresh and upgraded ephemeral Supabase/Postgres instance; run RLS adversarial tests with user A/user B/anon/service role; back up and rehearse restore; use forward-fix plans for irreversible migrations.

## AUD-024 — Input/domain limits are incomplete

**Evidence:** Workout name is capped at 50, but many persisted names/descriptions/notes and JSON arrays lack consistent client and DB length/count limits. AI message body also lacks caps.

**Impact:** Storage bloat, rendering degradation, oversized sync payloads, expensive AI requests, and potential denial of service.

**Required action:** Define one domain limit table: names, notes, instructions, sets/exercise, exercises/workout, templates/user, photos, export size, and AI context. Enforce at UI, runtime validation, and DB/check constraints.

## AUD-025 — Performance telemetry and budgets are not release-grade

**Evidence:** Some Jest “benchmarks” use millisecond `Date` timing in a synthetic environment; a catalog-count assertion is stale. No bundle-size, Lighthouse, Web Vitals, memory, cold-start, or sync-volume budget is enforced.

**Impact:** Regressions such as iOS Jetsam can recur despite passing unit tests.

**Required action:** Add bundle analysis, Lighthouse/Web Vitals, iPhone Safari memory scenarios, low-end Android cold start, 10k-workout history, 1k custom exercises, large export, and offline sync backlog benchmarks with budgets.

## AUD-026 — Error boundary coverage is narrow

**Evidence:** Root Sentry wrapping exists and exercise picker/list use boundaries, but key workout, settings/export, and analytics feature subtrees do not have granular recovery boundaries.

**Impact:** One render failure can still blank an active workout or other major screen.

**Required action:** Add boundaries around data-heavy subtrees while preserving unsaved workout state and offering retry/navigation. Test thrown render errors and corrupted persisted data.

## AUD-027 — Mobile platform configuration and testing gaps

**Evidence:** Android predictive back is explicitly disabled despite architecture promising predictive-back behavior. Expo Go warns notification behavior differs from development builds. No native E2E framework or device matrix was found.

**Impact:** Back navigation, notifications, permissions, background timers, image picker, and SecureStore behavior may differ from Jest/PWA.

**Required action:** Validate development/release builds on supported iOS/Android versions; document why predictive back is disabled or restore/test it; add Maestro/Detox smoke flows.

## AUD-028 — Public source maps and monitoring release linkage are not verified

**Evidence:** Sentry release/commit setup exists, but no audited Metro/Sentry build configuration or CI upload proof was found. No check ensures browser source maps are private or stripped.

**Impact:** Unreadable production stack traces or accidental source disclosure.

**Required action:** Verify authenticated source-map upload, release association, and Vercel artifact exclusion. Trigger a controlled test error per environment.

## AUD-029 — Missing operational readiness artifacts

**Evidence:** No incident runbook, SLO/error-budget definition, backup restore drill, status communication procedure, dependency SLA, or environment ownership file was found.

**Impact:** Longer outages and unsafe emergency fixes.

**Required action:** Define availability/sync-data-loss SLOs, alerts, owners, severity matrix, rollback, Supabase/Vercel/Sentry failure playbooks, and quarterly restore exercise.

## AUD-030 — Offline/service-worker behavior needs adversarial version-skew tests

**Evidence:** Service worker calls `skipWaiting()` and `clients.claim()` while intentionally avoiding forced reload. Old tabs may execute old JS against changed cache/schema until refreshed.

**Impact:** Multi-tab and mid-workout deployments can produce mixed versions, stale assets, or schema mismatch.

**Required action:** Add app/storage schema versions and compatibility gates; test deploy during active workout, two tabs, offline old build, cache eviction, interrupted service-worker install, and rollback.

## AUD-031 — Broad `any` usage weakens change-impact guarantees

**Evidence:** Production routes and service code use many `any` casts, especially router targets, errors, styles, file objects, and Edge Function payloads. Supabase functions are excluded from TypeScript project checks.

**Impact:** Route renames, malformed payloads, and shape changes bypass compile-time detection.

**Required action:** Type router hrefs, theme colors, error normalization, upload abstractions, and Edge Function request/response schemas. Create a separate Deno typecheck/lint task for `supabase/functions`.

## AUD-032 — Direct Wger runtime dependency contradicts resilience goals

**Evidence:** Client provider fetches Wger directly; CSP allows Wger. Architecture says client must never depend on Wger runtime availability.

**Impact:** Rate limits/outages/schema changes affect catalog freshness and search; privacy/network metadata goes to third party.

**Required action:** Decide explicitly: either own an ingestion/cache backend or document client cache/fallback SLA. Add contract tests and circuit breaker/backoff.

---

# P3 — Low findings

## AUD-033 — Repository hygiene and stale utility scripts

`checkUrl.js`, `test-validation.js`, `temp_analytics.txt`, and tracked `supabase/.temp/linked-project.json` appear workstation-specific or one-off. Classify, move to `scripts/` with documentation/tests, or remove. Never retain environment-specific URLs and temp artifacts without ownership.

## AUD-034 — Version/release metadata can drift

Version is duplicated across `package.json`, `app.json`, service-worker cache name, README, and release notes. Add a check or derive generated artifacts from one source.

## AUD-035 — Lint policy disables multiple modern React safety rules globally

`eslint.config.js` disables refs, state-in-effect, purity, immutability, and memoization rules for the whole project. Scope exceptions to files with rationale; otherwise new unsafe patterns are invisible.

## AUD-036 — Release startup intentionally blocks interaction for 3.55 seconds

The cold-boot overlay captures all pointer events. This creates a measurable UX and accessibility penalty and may appear frozen on slow font/theme initialization. Measure retention/TTI and provide reduced-motion/skip behavior.

## AUD-037 — README overclaims verified behavior

Claims such as “100% parity,” “complete offline independence,” “production-grade,” and security-policy completeness are not supported while tests/build/privacy gates are red. Rewrite claims to verified capabilities and supported environments.

---

# Change-impact map for Antigravity

Use this before editing. A change is incomplete until immediate dependents are rechecked.

| Change area | Likely affected systems | Mandatory regression checks |
|---|---|---|
| Auth/session storage | route gate, guest mode, account switch, Supabase refresh, monitoring identity, sync lifecycle | Auth, hydration race, PWA persistence, callback, account switch, sign-out, unauthorized deep link |
| Guest migration | active workout, completed history, templates, exercises/photos, onboarding, sync metadata | crash/interruption, duplicate callback, retry, partial copy, two tabs, user A→B isolation |
| Workout storage/schema | active autosave, resume/discard/finish, exports, analytics, sync payloads, history, PRs | malformed legacy record, quota failure, app kill, background flush, concurrent tabs, migration rollback |
| Sync LWW/tombstones | all three cloud entity types, watermarks, user switching, deletions | clock skew, equal timestamps, offline delete/edit, pagination >200, network/auth failure, cross-user RLS |
| Exercise IDs/catalog | templates, history matching, last-time performance, photos/media, search, analytics | ID rename/alias, name fallback, duplicate names, removed exercise, catalog cache migration |
| Routing/Vercel rewrites | static export, deep links, auth callback, service worker offline shell | direct refresh on every dynamic route, unknown route, asset URL, offline deep link, preview domain |
| Service worker/cache | active workout continuity, release version, static assets, auth callback | deploy mid-workout, old tab/new build, rollback, offline, cache corruption/eviction, private response no-store |
| Expo/React Native upgrade | Metro, router, native modules, notifications, SecureStore, Sentry, Jest | full web/native build, physical-device auth, notifications, image picker, background/foreground, E2E smoke |
| RLS/migration | profiles, sync, admin, quotas, storage buckets | anon/user A/user B/admin/service-role matrix; fresh install and upgrade path |
| Export/XLSX/PDF | lazy loading, Unicode, memory, formula injection, file sharing | 0/1/10k records, malicious text beginning `= + - @`, emoji, huge notes, low-memory device |

# Required test matrix

## User/account states
- First install; returning guest; returning authenticated user; expired token; revoked user; offline auth bootstrap.
- User A sign-out → User B sign-in without process restart.
- Guest migration with active workout and with each data category independently corrupted.
- Password reset, email confirmation, OAuth cancel/error/replay, callback on preview/custom/native schemes.

## Workout/data integrity
- Kill app after every mutation boundary: edit set, complete set, add/remove/reorder, finish, discard.
- Two tabs/devices edit same entity; delete/edit conflict; clock ±24h; duplicate/replayed sync batch.
- Storage full/unavailable/private browsing/cleared mid-session.
- Extreme values, decimals, zero, negative, NaN, huge counts, Unicode/RTL/emoji notes.

## Offline/network
- Cold start offline; go offline mid-save/push/pull; flaky 2G; captive portal; DNS failure; 401/403/429/500.
- Outbox >50 and pull >200; interrupted pagination; watermark overlap duplicates.
- Wger/Supabase/Sentry/AI provider unavailable independently.

## Platforms
- iOS Safari tab and installed PWA; Chrome Android tab/PWA; desktop Chromium/Firefox/Safari.
- Native iOS/Android development and release builds; low-memory devices; orientation/accessibility font scale.
- Notifications allowed/denied/revoked; background/terminated; timezone/DST changes.

## Security/privacy
- User A attempts every User B row/object path.
- CSP/XSS probes in names/notes/descriptions/avatar URLs and exported files.
- Oversized request/upload, MIME spoof/polyglot image, EXIF leak, path encoding/traversal.
- Admin RPC/function authorization and last-super-admin invariant.
- Account export/delete and post-delete resurrection attempt.

# Prioritized execution plan

## Phase 0 — Immediate containment (today)
1. Resolve `AUD-001`: remove/secure production backup and temp secrets; harden `.gitignore`; scan history.
2. Freeze production feature deployment except urgent fixes.
3. Open tracked issues for all P0/P1 items with owners and deadlines.

## Phase 1 — Restore release truth (1–3 days)
1. Fix/triage all 49 failing tests and Jest open handles.
2. Fix cross-platform build script.
3. Add protected-branch CI gates and a clean-checkout release job.
4. Triage dependency advisories, beginning with `xlsx` and reachable critical/high paths.

## Phase 2 — User trust and security (week 1)
1. Implement account deletion and local erase.
2. Publish privacy/terms/AI disclosure.
3. Restore zoom; perform accessibility baseline.
4. Harden Edge Functions, CORS, role mutation, input limits, storage bucket privacy, and CSP.

## Phase 3 — Reliability foundation (weeks 2–3)
1. Plan SecureStore→SQLite domain-data migration.
2. Add migration/RLS integration tests and native E2E smoke tests.
3. Add performance/bundle/memory budgets and observability runbooks.
4. Reconcile architecture/release documentation with source truth.

# Definition of done for the remediation program

- No P0/P1 finding remains open without explicit risk acceptance and expiry.
- Clean checkout passes typecheck, zero-budget lint, all tests, web build, native smoke builds, dependency/secret scans, and migration tests.
- CI blocks production deployment on any failed gate.
- Guest conversion, account switching, active-workout crash recovery, offline sync, deletion, and cross-user isolation pass adversarial E2E tests.
- Privacy/terms/delete/export are live and reachable.
- Physical-device sign-off covers supported iOS/Android and iOS installed PWA.
- Rollback and backup restore have been exercised, not merely documented.

# Positive controls worth preserving

- Strict TypeScript passes.
- Per-user storage scopes and dedicated user-isolation/race tests exist.
- Sync engine implements batching, watermarks, LWW reconciliation, tombstones, guest skip, and concurrency guards.
- Supabase sync/profile tables use RLS with ownership checks.
- Admin data RPCs authorize inside `SECURITY DEFINER` functions and set `search_path`.
- Monitoring defaults to no PII and recursively redacts common credentials.
- Service worker deliberately bypasses cross-origin/API/auth-header requests.
- Avatar/exercise photo writes use user-owned paths.
- Test suite breadth is strong (1,273 tests), even though the current baseline is red.

---

**Audit rule for Antigravity:** Do not “fix” this report by deleting failing tests, weakening assertions, suppressing warnings, or changing documentation alone. For every remediation, state the invariant, affected dependents, rollback plan, and fresh verification evidence.