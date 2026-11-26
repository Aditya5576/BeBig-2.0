---
name: bebig-offline-sync-engine
description: >
  Enforces BeBig 2.0 offline-first persistence and sync invariants across
  IndexedDB (bebig_db), SecureStore spillover, FIFO serialized queues, CAS
  revisions, editGenerationRef autosave guards, 50-item discard tombstones,
  and foreground AppState recovery without iOS Safari Background Sync reliance.
---

# BeBig Offline Sync Engine

Apply this skill when modifying workout persistence, IndexedDB/SecureStore storage adapters, sync orchestration, or active workout autosave.

## Verified Repository Contracts

- **FIFO Queue Serialization (`src/features/workout/storage/workoutStorage.ts`)**:
  - All active session reads, writes, and creations MUST serialize through `enqueueActiveWorkoutOp` and `inMemoryLockQueues` (per-key FIFO promise queue + cross-tab Web Locks when available).
  - Never bypass the serialized queue with direct `platformStorage` writes for active workouts.
- **CAS Revision & Persistence Errors (`src/features/workout/services/workoutRepository.ts`, `workoutStorage.ts`)**:
  - Active workout writes use Compare-And-Swap (`persistedRevision` vs `incomingRevision`).
  - Surface `ActiveWorkoutPersistenceError` (`ACTIVE_WORKOUT_PERSISTENCE_FAILED`) when CAS retries are exhausted rather than silently dropping mutations.
- **Autosave Race Guard (`app/workout/active.tsx`)**:
  - Increment `editGenerationRef.current` on every user mutation (set edits, exercise adds/removals, discards).
  - Async autosave callbacks MUST capture `submittedGeneration = editGenerationRef.current` and commit/reconcile only if `editGenerationRef.current === submittedGeneration`.
- **Shadow Backups & 50-Item Discard Tombstones (`workoutStorage.ts`, `workoutRepository.ts`, `accountDeletionService.ts`)**:
  - Maintain `BASE_DISCARDED_WORKOUTS_KEY` (`bebig.workout.active.discarded`) capped at 50 most recent session IDs via `recordDiscardedSessionId`.
  - Check `isSessionDiscarded` before resurrecting local or guest active sessions; write durable `pending_delete` tombstones before clearing local records on synced deletions.
- **Sync Batching & Foreground Recovery (`src/services/sync/syncEngine.ts`, `syncLifecycleManager.ts`)**:
  - Respect `PUSH_BATCH_SIZE = 50`, `PULL_PAGE_SIZE = 50`, `MAX_PULL_RECORDS_PER_PASS = 200`, `WATERMARK_OVERLAP_MS = 5000`, and `TRIGGER_COOLDOWN_MS = 1500`.
  - Trigger sync via `AppState` (`background`/`inactive` -> `active`) and network transitions (`syncLifecycleManager.ts`). Do NOT rely on Web Background Sync APIs (unsupported on iOS Safari standalone PWAs).
  - Storage backend: `IndexedDB` (`bebig_db`, store `keyval`) on web with `QuotaExceededError` eviction of rebuildable exercise catalog caches; `expo-secure-store` (`<= 1800` bytes) with `FileSystem.documentDirectory/bebig_kv/` spillover on native.
