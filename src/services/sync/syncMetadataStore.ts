/**
 * BeBig 2.0 — Sync Metadata Store & Crash Recovery Scanner
 *
 * User-isolated persistence for sync lifecycle metadata, keyset cursors,
 * and deterministic crash-recovery reconciliation between local entity storage
 * and cloud synchronization outbox.
 *
 * Invariants:
 * 1. Metadata is stored exclusively for authenticated users under `bebig.sync.metadata.<userId>`.
 * 2. Guests never create or access sync metadata.
 * 3. Active/in-progress workouts are NEVER scanned or included in sync metadata.
 * 4. Local entity storage remains the source of truth for the UI.
 */

import { getCurrentUserScope, UserScope } from '../../features/auth/utils/userScope';
import { workoutStorage } from '../../features/workout/storage/workoutStorage';
import { templateStorage } from '../../features/templates/storage/templateStorage';
import { customExerciseStorage } from '../../features/exercises/storage/customExerciseStorage';
import { platformStorage } from '../../lib/storage';
import {
  EntitySyncMetadata,
  KeysetCursor,
  RecoveryScanResult,
  SyncEntityType,
  SyncMetadataState,
  WatermarkState,
  createInitialSyncMetadataState,
  createInitialWatermarkState,
} from './types';

export const BASE_SYNC_METADATA_KEY = 'bebig.sync.metadata';

/**
 * Composite key helper to prevent identity collisions across different entity types.
 */
export function getRecordKey(entityType: SyncEntityType, id: string): string {
  return `${entityType}:${id}`;
}

/**
 * In-memory parsed state cache keyed by authenticated user ID.
 */
const memoryCache = new Map<string, SyncMetadataState>();

/**
 * Low-level storage reader delegating to platformStorage.
 */
async function readStorage(key: string): Promise<string | null> {
  return platformStorage.getItem(key);
}

/**
 * Low-level storage writer delegating to platformStorage.
 */
async function writeStorage(key: string, value: string): Promise<void> {
  await platformStorage.setItem(key, value);
}

/**
 * Low-level storage deleter delegating to platformStorage.
 */
async function deleteStorage(key: string): Promise<void> {
  await platformStorage.removeItem(key);
}

/**
 * Resolves the authenticated user ID and storage key.
 * Strictly rejects guest sessions and unauthenticated callers.
 */
export function getSyncMetadataKey(scope?: UserScope | null): string | null {
  const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
  if (!resolvedScope || resolvedScope.ownerType !== 'authenticated' || !resolvedScope.ownerId) {
    return null;
  }
  return `${BASE_SYNC_METADATA_KEY}.${resolvedScope.ownerId}`;
}

export const syncMetadataStore = {
  /**
   * Clears the in-memory cache across all users.
   */
  clearMemoryCache(): void {
    memoryCache.clear();
  },

  /**
   * Resets and purges persistent and cached metadata for a specific user or the current user.
   */
  async resetUserState(userId?: string): Promise<void> {
    const targetUserId = userId || getCurrentUserScope()?.ownerId;
    if (!targetUserId) return;

    memoryCache.delete(targetUserId);
    const key = `${BASE_SYNC_METADATA_KEY}.${targetUserId}`;
    await deleteStorage(key);
  },

  /**
   * Retrieves the full SyncMetadataState for the active authenticated user.
   * Returns null if the caller is unauthenticated or in guest mode.
   */
  async getState(scope?: UserScope | null): Promise<SyncMetadataState | null> {
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
    if (!resolvedScope || resolvedScope.ownerType !== 'authenticated' || !resolvedScope.ownerId) {
      return null;
    }

    const userId = resolvedScope.ownerId;

    // Check memory cache first
    if (memoryCache.has(userId)) {
      return memoryCache.get(userId)!;
    }

    const key = getSyncMetadataKey(resolvedScope);
    if (!key) return null;

    try {
      const raw = await readStorage(key);
      if (!raw) {
        const initialState = createInitialSyncMetadataState();
        memoryCache.set(userId, initialState);
        return initialState;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.records || !parsed.watermarks) {
        const fallback = createInitialSyncMetadataState();
        memoryCache.set(userId, fallback);
        return fallback;
      }

      const state: SyncMetadataState = {
        records: parsed.records || {},
        watermarks: {
          workout: parsed.watermarks.workout || createInitialWatermarkState(),
          template: parsed.watermarks.template || createInitialWatermarkState(),
          custom_exercise: parsed.watermarks.custom_exercise || createInitialWatermarkState(),
        },
        activeStreamEntity: parsed.activeStreamEntity || null,
      };

      memoryCache.set(userId, state);
      return state;
    } catch {
      const fallback = createInitialSyncMetadataState();
      memoryCache.set(userId, fallback);
      return fallback;
    }
  },

  /**
   * Persists the SyncMetadataState for the active authenticated user.
   */
  async saveState(state: SyncMetadataState, scope?: UserScope | null): Promise<void> {
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
    if (!resolvedScope || resolvedScope.ownerType !== 'authenticated' || !resolvedScope.ownerId) {
      return;
    }

    const userId = resolvedScope.ownerId;
    memoryCache.set(userId, state);

    const key = getSyncMetadataKey(resolvedScope);
    if (!key) return;

    try {
      await writeStorage(key, JSON.stringify(state));
    } catch {
      // Handled in memory
    }
  },

  /**
   * Retrieves metadata for a specific entity record.
   */
  async getRecord(
    entityType: SyncEntityType,
    id: string,
    scope?: UserScope | null,
  ): Promise<EntitySyncMetadata | null> {
    const state = await this.getState(scope);
    if (!state) return null;

    const recordKey = getRecordKey(entityType, id);
    return state.records[recordKey] || null;
  },

  /**
   * Sets or updates metadata for a specific entity record.
   */
  async setRecord(metadata: EntitySyncMetadata, scope?: UserScope | null): Promise<void> {
    const state = await this.getState(scope);
    if (!state) return;

    const recordKey = getRecordKey(metadata.entityType, metadata.id);
    state.records[recordKey] = metadata;
    await this.saveState(state, scope);
  },

  /**
   * Removes metadata for a specific entity record.
   */
  async removeRecord(
    entityType: SyncEntityType,
    id: string,
    scope?: UserScope | null,
  ): Promise<void> {
    const state = await this.getState(scope);
    if (!state) return;

    const recordKey = getRecordKey(entityType, id);
    if (state.records[recordKey]) {
      delete state.records[recordKey];
      await this.saveState(state, scope);
    }
  },

  /**
   * Retrieves all pending records (pending_upload or pending_delete), optionally filtered by entityType.
   */
  async getPendingRecords(
    entityType?: SyncEntityType,
    scope?: UserScope | null,
  ): Promise<EntitySyncMetadata[]> {
    const state = await this.getState(scope);
    if (!state) return [];

    const allRecords = Object.values(state.records);
    return allRecords.filter((rec) => {
      const matchesType = !entityType || rec.entityType === entityType;
      const isPending =
        rec.syncStatus === 'pending_upload' || rec.syncStatus === 'pending_delete';
      return matchesType && isPending;
    });
  },

  /**
   * Marks a record as pending upload with an updated client timestamp.
   */
  async markPendingUpload(
    entityType: SyncEntityType,
    id: string,
    clientUpdatedAt?: string,
    scope?: UserScope | null,
  ): Promise<EntitySyncMetadata | null> {
    const state = await this.getState(scope);
    if (!state) return null;

    const recordKey = getRecordKey(entityType, id);
    const existing = state.records[recordKey];

    const updated: EntitySyncMetadata = {
      entityType,
      id,
      clientUpdatedAt: clientUpdatedAt || new Date().toISOString(),
      deletedAt: null,
      syncStatus: 'pending_upload',
      lastSyncedServerUpdatedAt: existing?.lastSyncedServerUpdatedAt,
    };

    state.records[recordKey] = updated;
    await this.saveState(state, scope);
    return updated;
  },

  /**
   * Marks a record as pending delete (tombstone) with an updated client timestamp.
   */
  async markPendingDelete(
    entityType: SyncEntityType,
    id: string,
    clientUpdatedAt?: string,
    deletedAt?: string,
    scope?: UserScope | null,
  ): Promise<EntitySyncMetadata | null> {
    const state = await this.getState(scope);
    if (!state) return null;

    const recordKey = getRecordKey(entityType, id);
    const existing = state.records[recordKey];
    const now = new Date().toISOString();

    const updated: EntitySyncMetadata = {
      entityType,
      id,
      clientUpdatedAt: clientUpdatedAt || now,
      deletedAt: deletedAt || clientUpdatedAt || now,
      syncStatus: 'pending_delete',
      lastSyncedServerUpdatedAt: existing?.lastSyncedServerUpdatedAt,
    };

    state.records[recordKey] = updated;
    await this.saveState(state, scope);
    return updated;
  },

  /**
   * Marks a record as successfully synced to the cloud.
   */
  async markSynced(
    entityType: SyncEntityType,
    id: string,
    serverUpdatedAt: string,
    deletedAt?: string | null,
    scope?: UserScope | null,
  ): Promise<EntitySyncMetadata | null> {
    const state = await this.getState(scope);
    if (!state) return null;

    const recordKey = getRecordKey(entityType, id);
    const existing = state.records[recordKey];

    const updated: EntitySyncMetadata = {
      entityType,
      id,
      clientUpdatedAt: existing?.clientUpdatedAt || new Date().toISOString(),
      deletedAt: deletedAt !== undefined ? deletedAt : existing?.deletedAt || null,
      syncStatus: 'synced',
      lastSyncedServerUpdatedAt: serverUpdatedAt,
    };

    state.records[recordKey] = updated;
    await this.saveState(state, scope);
    return updated;
  },

  /**
   * Marks a record as errored (poison pill quarantine).
   */
  async markError(
    entityType: SyncEntityType,
    id: string,
    scope?: UserScope | null,
  ): Promise<EntitySyncMetadata | null> {
    const state = await this.getState(scope);
    if (!state) return null;

    const recordKey = getRecordKey(entityType, id);
    const existing = state.records[recordKey];
    if (!existing) return null;

    const updated: EntitySyncMetadata = {
      ...existing,
      syncStatus: 'error',
    };

    state.records[recordKey] = updated;
    await this.saveState(state, scope);
    return updated;
  },

  /**
   * Retrieves the watermark state for a given entity type.
   */
  async getWatermark(
    entityType: SyncEntityType,
    scope?: UserScope | null,
  ): Promise<WatermarkState> {
    const state = await this.getState(scope);
    if (!state) return createInitialWatermarkState();

    return state.watermarks[entityType] || createInitialWatermarkState();
  },

  /**
   * Updates the watermark state for a given entity type.
   */
  async setWatermark(
    entityType: SyncEntityType,
    watermark: Partial<WatermarkState>,
    scope?: UserScope | null,
  ): Promise<void> {
    const state = await this.getState(scope);
    if (!state) return;

    const current = state.watermarks[entityType] || createInitialWatermarkState();
    state.watermarks[entityType] = {
      ...current,
      ...watermark,
    };
    await this.saveState(state, scope);
  },

  /**
   * Retrieves the active stream entity phase, if an in-flight multi-entity pass paused.
   */
  async getActiveStreamEntity(scope?: UserScope | null): Promise<SyncEntityType | null> {
    const state = await this.getState(scope);
    return state?.activeStreamEntity ?? null;
  },

  /**
   * Updates the active stream entity phase.
   */
  async setActiveStreamEntity(
    activeEntity: SyncEntityType | null,
    scope?: UserScope | null,
  ): Promise<void> {
    const state = await this.getState(scope);
    if (!state) return;

    state.activeStreamEntity = activeEntity;
    await this.saveState(state, scope);
  },

  /**
   * Deterministic Crash-Recovery Scanner
   *
   * Reconciles existing local entity storage against SyncMetadataStore:
   * 1. Local entity exists + metadata missing -> create pending_upload.
   * 2. Local entity exists + pending_delete tombstone -> remove entity from local storage, preserve tombstone.
   * 3. Local entity exists + metadata exists + entity has newer timestamp -> update metadata clientUpdatedAt & pending_upload.
   * 4. Metadata pending_upload + local entity missing -> remove orphan metadata.
   * 5. Metadata tombstone + local entity missing -> preserve tombstone.
   *
   * Invariants:
   * - Only completed workouts participate. Active workouts are never scanned or modified.
   * - Only user-owned templates participate.
   * - Only user-owned custom exercises participate (isCustom === true).
   */
  async reconcileLocalEntities(scope?: UserScope | null): Promise<RecoveryScanResult> {
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
    if (!resolvedScope || resolvedScope.ownerType !== 'authenticated' || !resolvedScope.ownerId) {
      return {
        scannedCount: 0,
        repairedMissingMetadata: 0,
        repairedUnflushedDeletions: 0,
        repairedStaleMetadata: 0,
        cleanedOrphanPending: 0,
      };
    }

    const state = await this.getState(resolvedScope);
    if (!state) {
      return {
        scannedCount: 0,
        repairedMissingMetadata: 0,
        repairedUnflushedDeletions: 0,
        repairedStaleMetadata: 0,
        cleanedOrphanPending: 0,
      };
    }

    let scannedCount = 0;
    let repairedMissingMetadata = 0;
    let repairedUnflushedDeletions = 0;
    let repairedStaleMetadata = 0;
    let cleanedOrphanPending = 0;

    // --------------------------------------------------------------------------
    // 1. Reconcile Completed Workouts (Active Workouts are strictly excluded)
    // --------------------------------------------------------------------------
    const completedWorkouts = await workoutStorage.getCompletedWorkouts(resolvedScope);
    const localWorkoutsMap = new Map<string, any>();

    for (const w of completedWorkouts) {
      scannedCount++;
      localWorkoutsMap.set(w.id, w);
      const recordKey = getRecordKey('workout', w.id);
      const meta = state.records[recordKey];
      const entityTimestamp =
        (w as any).updatedAt || w.finishedAt || w.startedAt || new Date().toISOString();

      if (!meta) {
        // Rule 1: Local entity exists + metadata missing
        state.records[recordKey] = {
          entityType: 'workout',
          id: w.id,
          clientUpdatedAt: entityTimestamp,
          deletedAt: null,
          syncStatus: 'pending_upload',
        };
        repairedMissingMetadata++;
      } else if (meta.syncStatus === 'pending_delete' || meta.deletedAt !== null) {
        // Rule 2: Local entity exists + pending_delete tombstone
        await workoutStorage.deleteCompletedWorkout(w.id, resolvedScope);
        repairedUnflushedDeletions++;
      } else {
        // Rule 3: Local entity exists + metadata exists + entity has newer timestamp
        const entityTimeMs = new Date(entityTimestamp).getTime();
        const metaTimeMs = new Date(meta.clientUpdatedAt).getTime();
        if (entityTimeMs > metaTimeMs) {
          state.records[recordKey] = {
            ...meta,
            clientUpdatedAt: entityTimestamp,
            syncStatus: 'pending_upload',
          };
          repairedStaleMetadata++;
        }
      }
    }

    // Check for orphan workout metadata where entity is missing
    for (const [key, meta] of Object.entries(state.records)) {
      if (meta.entityType !== 'workout') continue;
      if (!localWorkoutsMap.has(meta.id)) {
        if (meta.syncStatus === 'pending_upload') {
          // Rule 4: Metadata pending_upload + local entity missing
          delete state.records[key];
          cleanedOrphanPending++;
        }
        // Rule 5: Metadata tombstone + local entity missing -> preserve
      }
    }

    // --------------------------------------------------------------------------
    // 2. Reconcile Workout Templates (User-owned only)
    // --------------------------------------------------------------------------
    const templates = await templateStorage.getTemplates(resolvedScope);
    const localTemplatesMap = new Map<string, any>();

    for (const t of templates) {
      if (t.ownerType && t.ownerType !== 'authenticated') continue;
      scannedCount++;
      localTemplatesMap.set(t.id, t);
      const recordKey = getRecordKey('template', t.id);
      const meta = state.records[recordKey];
      const entityTimestamp = t.updatedAt || t.createdAt || new Date().toISOString();

      if (!meta) {
        // Rule 1: Local entity exists + metadata missing
        state.records[recordKey] = {
          entityType: 'template',
          id: t.id,
          clientUpdatedAt: entityTimestamp,
          deletedAt: null,
          syncStatus: 'pending_upload',
        };
        repairedMissingMetadata++;
      } else if (meta.syncStatus === 'pending_delete' || meta.deletedAt !== null) {
        // Rule 2: Local entity exists + pending_delete tombstone
        await templateStorage.deleteTemplate(t.id, resolvedScope);
        repairedUnflushedDeletions++;
      } else {
        // Rule 3: Local entity exists + metadata exists + entity has newer timestamp
        const entityTimeMs = new Date(entityTimestamp).getTime();
        const metaTimeMs = new Date(meta.clientUpdatedAt).getTime();
        if (entityTimeMs > metaTimeMs) {
          state.records[recordKey] = {
            ...meta,
            clientUpdatedAt: entityTimestamp,
            syncStatus: 'pending_upload',
          };
          repairedStaleMetadata++;
        }
      }
    }

    // Check for orphan template metadata
    for (const [key, meta] of Object.entries(state.records)) {
      if (meta.entityType !== 'template') continue;
      if (!localTemplatesMap.has(meta.id)) {
        if (meta.syncStatus === 'pending_upload') {
          // Rule 4: Metadata pending_upload + local entity missing
          delete state.records[key];
          cleanedOrphanPending++;
        }
        // Rule 5: Metadata tombstone + local entity missing -> preserve
      }
    }

    // --------------------------------------------------------------------------
    // 3. Reconcile Custom Exercises (User-owned isCustom only, no Wger)
    // --------------------------------------------------------------------------
    const customExercises = await customExerciseStorage.getCustomExercises(resolvedScope);
    const localExercisesMap = new Map<string, any>();

    for (const e of customExercises) {
      if (!e.isCustom) continue;
      scannedCount++;
      localExercisesMap.set(e.id, e);
      const recordKey = getRecordKey('custom_exercise', e.id);
      const meta = state.records[recordKey];
      const entityTimestamp = (e as any).updatedAt || e.createdAt || new Date().toISOString();

      if (!meta) {
        // Rule 1: Local entity exists + metadata missing
        state.records[recordKey] = {
          entityType: 'custom_exercise',
          id: e.id,
          clientUpdatedAt: entityTimestamp,
          deletedAt: null,
          syncStatus: 'pending_upload',
        };
        repairedMissingMetadata++;
      } else if (meta.syncStatus === 'pending_delete' || meta.deletedAt !== null) {
        // Rule 2: Local entity exists + pending_delete tombstone
        await customExerciseStorage.deleteCustomExercise(e.id, resolvedScope);
        repairedUnflushedDeletions++;
      } else {
        // Rule 3: Local entity exists + metadata exists + entity has newer timestamp
        const entityTimeMs = new Date(entityTimestamp).getTime();
        const metaTimeMs = new Date(meta.clientUpdatedAt).getTime();
        if (entityTimeMs > metaTimeMs) {
          state.records[recordKey] = {
            ...meta,
            clientUpdatedAt: entityTimestamp,
            syncStatus: 'pending_upload',
          };
          repairedStaleMetadata++;
        }
      }
    }

    // Check for orphan custom exercise metadata
    for (const [key, meta] of Object.entries(state.records)) {
      if (meta.entityType !== 'custom_exercise') continue;
      if (!localExercisesMap.has(meta.id)) {
        if (meta.syncStatus === 'pending_upload') {
          // Rule 4: Metadata pending_upload + local entity missing
          delete state.records[key];
          cleanedOrphanPending++;
        }
        // Rule 5: Metadata tombstone + local entity missing -> preserve
      }
    }

    // Persist reconciled state
    await this.saveState(state, resolvedScope);

    return {
      scannedCount,
      repairedMissingMetadata,
      repairedUnflushedDeletions,
      repairedStaleMetadata,
      cleanedOrphanPending,
    };
  },
};
