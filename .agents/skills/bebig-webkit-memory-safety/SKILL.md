---
name: bebig-webkit-memory-safety
description: >
  Prevents iOS WebKit and standalone PWA memory crashes (jetsam) in BeBig 2.0.
  Enforces zero-<Image> exercise pickers, bounded caches, listener/timer/objectURL
  cleanup, and incremental persistence during backgrounding.
---

# BeBig WebKit Memory Safety

Apply this skill when building or auditing media-heavy lists, exercise pickers, photo uploads, timers, or lifecycle listeners targeting iPhone standalone PWA / iOS WebKit.

## Verified Repository Contracts

- **Zero-`<Image>` Exercise Pickers (`src/features/admin/components/AdminTrainerTemplatesTab.tsx`, `src/features/exercises/components/ExerciseThumbnail.tsx`)**:
  - Never render `<Image>` bitmaps inside high-density exercise picker lists or modals (`trainer-exercise-library-picker`, `ExercisePickerModal`). Use bitmap-free vector/badge indicators to avoid iOS WebKit decoder memory spikes.
  - When `<Image>` is used in detail views or forms (`CustomExerciseForm.tsx`, `ExerciseThumbnail.tsx`), ensure static, non-autoplay rendering.
- **Object URL & Blob Cleanup (`src/features/exercises/storage/exercisePhotoStorage.ts`)**:
  - Always revoke temporary blob URLs in a `finally` block using `URL.revokeObjectURL(objectUrlToRevoke)` guarded by `typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function'`.
- **Listener & Timer Cleanup (`src/services/sync/syncLifecycleManager.ts`, `src/features/workout/components/RestTimerOverlay.tsx`)**:
  - Store `AppState.addEventListener` subscriptions and call `.remove()` on teardown (`stop()` / `useEffect` cleanup).
  - Clear all `setTimeout` / `setInterval` / `requestAnimationFrame` handles on unmount.
- **Bounded Caches & Incremental Persistence (`src/services/sync/syncEngine.ts`, `src/features/workout/storage/workoutStorage.ts`)**:
  - Keep in-memory caches and sync pages bounded (`PULL_PAGE_SIZE = 50`, `MAX_PULL_RECORDS_PER_PASS = 200`, discard tombstones capped at `50`).
  - Persist workout state incrementally on each confirmed user action rather than buffering large payloads until `pagehide`/`visibilitychange`, as iOS WebKit may terminate suspended PWA tabs without firing async unload handlers.
- **Protected Boundary**:
  - Never modify `app/+html.tsx` or `src/features/workout/services/workoutNotificationService.ts`.
