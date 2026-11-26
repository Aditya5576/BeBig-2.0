# BeBig 2.0 — Engineering Milestones

| Phase | Title | Status | Reference / Evidence |
|---|---|---|---|
| Phase 00 | Repository Baseline & Token-Saving Brain Governance | `OWNER APPROVED` | `AI_RULES.md`, `AI_BRAIN.md`, `AGENTS.md` |
| Phase 01 | AI Skill Installation, Custom BeBig Skills & Registry Governance | `OWNER APPROVED` (`81b653a7`) | `.agents/SKILL_REGISTRY.md`, 8 skills in `.agents/skills/` |
| Phase 02 | Offline Sync Engine Audit & Property-Based Testing (`fast-check`) | `IMPLEMENTED — READY FOR INDEPENDENT REVIEW` | `tests/OfflineSyncProperty.test.tsx` (`seed: 20261126`, `numRuns: 100`) |
| Phase 03 | Cross-Platform PWA & Mobile Web Stability (iOS Safari + Android Chrome) | `IMPLEMENTED — READY FOR INDEPENDENT REVIEW` | `tests/ExercisePickerWebMemorySafety.test.tsx`, `tests/IOSWebKitExerciseCrashGuard.test.tsx`, `tests/PWAInstallation.test.tsx`, `tests/ProductionDeployment.test.tsx`, `tests/Batch2Enhancements.test.tsx` |
| Phase 04 | Performance & Bundle Optimization (iOS Safari PWA + Android Chrome PWA + Native Parity) | `IMPLEMENTED — READY FOR INDEPENDENT REVIEW` | `npm run build:web` (`5,340.25 KB` total JS across 3 chunks), `npx --yes knip --no-exit-code` |

## Phase 02 Acceptance Test Matrix (`SYNC-01` – `SYNC-08`)

| ID | Invariant / Scenario | Verification Source | Status |
|---|---|---|---|
| `SYNC-01` | Offline workout start & set edits persist via FIFO serialized queue | `tests/OfflineSyncProperty.test.tsx`, `tests/ActiveWorkoutConcurrency.test.tsx` | `PASS` |
| `SYNC-02` | Close/reopen hydration & shadow recovery backup on primary loss | `tests/OfflineSyncProperty.test.tsx` | `PASS` |
| `SYNC-03` | Out-of-order / stale CAS revisions rejected without overwriting newer state | `tests/OfflineSyncProperty.test.tsx` | `PASS` |
| `SYNC-04` | Repeated retries with same revision are idempotent (single logical commit) | `tests/OfflineSyncProperty.test.tsx` | `PASS` |
| `SYNC-05` | 50-item discard tombstone retention cap (>50 discards) & cloud pull replay rejection | `tests/OfflineSyncProperty.test.tsx` | `PASS` |
| `SYNC-06` | Disconnect/reconnect reconciliation flushes retained outbox on recovery | `tests/OfflineSyncProperty.test.tsx`, `tests/SyncReliability.test.tsx` | `PASS` |
| `SYNC-07` | Explicit HTTP `401`/`403` auth errors abort sync safely, retain local outbox, and recover | `tests/OfflineSyncProperty.test.tsx`, `tests/SyncReliability.test.tsx` | `PASS` |
| `SYNC-08` | Head-of-line & Zod validation isolation / quarantine | `tests/SyncReliability.test.tsx`, `tests/Tier1ReliabilityAndZod.test.tsx` | `PASS` |

## Phase 03 Acceptance Test Matrix (`PWA-01` – `PWA-07`, `MEM-01` – `MEM-02`)

| ID | Invariant / Scenario | Verification Source | Status |
|---|---|---|---|
| `PWA-01` | Service Worker (`public/sw.js`) scopes cache deletion to `bebig-pwa-*` and preserves `bebig_db` | `public/sw.js`, `tests/IOSWebKitExerciseCrashGuard.test.tsx`, `tests/PWAInstallation.test.tsx` | `PASS` |
| `PWA-02` | SW update coordinator blocks mid-workout reloads and binds reload authorization to session/revision | `src/lib/pwa/pwaUpdateCoordinator.ts`, `app/_layout.tsx`, `tests/Batch2Enhancements.test.tsx` | `PASS` |
| `PWA-03` | IndexedDB origin persistence (`navigator.storage.persist()`) & `QuotaExceededError` cache eviction | `src/lib/storage/platformStorage.ts` | `PASS` |
| `PWA-04` | Web static export, SPA rewrites (`vercel.json`), and `/sw.js` `no-store` cache headers | `app.json`, `vercel.json`, `tests/ProductionDeployment.test.tsx` | `PASS` |
| `PWA-05` | Native Expo compatibility preserved alongside Web PWA guards (`BUILD-04`) | `npm run typecheck`, `npx eslint app src --no-cache` | `PASS` |
| `PWA-06` | iPhone standalone Safari PWA install, offline launch, and mid-workout update deferral | Physical iOS Safari device verification | `PENDING MANUAL` |
| `PWA-07` | Android Chrome PWA install, offline launch, and storage persistence check | Physical Android Chrome device verification | `PENDING MANUAL` |
| `MEM-01` | Zero-`<Image>` picker + `expo-image` lazy loading (`loading="lazy"`, `cachePolicy="disk"`, `recyclingKey`) | `tests/ExercisePickerWebMemorySafety.test.tsx`, `tests/IOSWebKitExerciseCrashGuard.test.tsx` | `PASS` |
| `MEM-02` | Bounded list virtualization (`windowSize=5` on Web) & `URL.revokeObjectURL` cleanup in `CustomExerciseForm` | `src/features/exercises/components/CustomExerciseForm.tsx`, `app/exercises/index.tsx`, `tests/ExercisePickerWebMemorySafety.test.tsx` | `PASS` |

## Phase 04 Acceptance Test Matrix (`PERF-01` – `PERF-04`)

| ID | Invariant / Scenario | Verification Source | Status |
|---|---|---|---|
| `PERF-01` | Web production bundle measured (`entry`: `4,801.20 KB`, lazy `export`: `536.45 KB`, lazy `guestMigrationService`: `2.59 KB`, total: `5,340.25 KB`) | `npm run build:web` (`dist/_expo/static/js/web/`) | `PASS` |
| `PERF-02` | Heavy export (`pdf-lib` + OOXML) & guest migration already dynamically imported off initial boot path; `xlsx`/`jspdf` absent | `app/settings.tsx`, `src/features/auth/store/useAuthStore.ts`, `src/features/export/services/exportService.ts` | `PASS` |
| `PERF-03` | Report-only Knip audit (`0` unused runtime deps; `28` unused files mostly Deno/SW/scripts; `2` devDeps; `51` exports) | `npx --yes knip --no-exit-code` | `PASS` |
| `PERF-04` | Physical Lighthouse & mobile PWA startup/TTI profiling on iOS Safari and Android Chrome | Physical device / Lighthouse CLI verification | `PENDING MANUAL` |
