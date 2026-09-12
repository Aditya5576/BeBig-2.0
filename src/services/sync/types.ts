/**
 * BeBig 2.0 — Sync Engine & Metadata Types
 *
 * Strongly-typed definitions for local synchronization metadata,
 * lifecycle state tracking, keyset cursors, and watermark management.
 */

export type SyncStatus = 'synced' | 'pending_upload' | 'pending_delete' | 'error';

export type SyncEntityType = 'workout' | 'template' | 'custom_exercise';

export interface EntitySyncMetadata {
  entityType: SyncEntityType;
  id: string;
  clientUpdatedAt: string; // ISO 8601 UTC timestamp of local edit or tombstone
  deletedAt: string | null; // ISO 8601 UTC timestamp if deleted, null if live
  syncStatus: SyncStatus;
  lastSyncedServerUpdatedAt?: string; // Server updated_at returned on cloud push/pull
}

export interface KeysetCursor {
  updatedAt: string;
  id: string;
}

export interface WatermarkState {
  lastCompletedWatermark: string | null; // Null indicates no completed pull stream yet
  activeCursor: KeysetCursor | null; // Non-null only if a pull pass paused at execution limit
  hasMore: boolean;
}

export interface SyncMetadataState {
  records: Record<string, EntitySyncMetadata>;
  watermarks: Record<SyncEntityType, WatermarkState>;
  activeStreamEntity?: SyncEntityType | null;
}

export interface RecoveryScanResult {
  scannedCount: number;
  repairedMissingMetadata: number;
  repairedUnflushedDeletions: number;
  repairedStaleMetadata: number;
  cleanedOrphanPending: number;
}

export interface PushBatchResult {
  entityType: SyncEntityType;
  attempted: number;
  synced: number;
  reconciled: number;
  quarantined: number;
}

export interface PushResult {
  status: 'success' | 'partial' | 'error' | 'busy' | 'skipped_guest_or_unauthenticated';
  pushedCount: number;
  reconciledCount: number;
  quarantinedCount: number;
  batches: PushBatchResult[];
  errors: { entityType?: SyncEntityType; id?: string; message: string; kind: string }[];
}

export interface PullBatchResult {
  entityType: SyncEntityType;
  pulledCount: number;
  appliedCount: number;
  ignoredCount: number;
  tombstonesApplied: number;
  quarantinedCount: number;
}

export interface PullResult {
  status: 'success' | 'partial' | 'error' | 'busy' | 'skipped_guest_or_unauthenticated';
  pulledCount: number;
  appliedCount: number;
  ignoredCount: number;
  tombstonesApplied: number;
  quarantinedCount: number;
  hasMore: boolean;
  batches: PullBatchResult[];
  errors: { entityType?: SyncEntityType; id?: string; message: string; kind: string }[];
}

export type SyncTriggerReason =
  | 'app_startup'
  | 'app_foreground'
  | 'network_recovery'
  | 'workout_completed'
  | 'local_delete'
  | 'template_saved'
  | 'custom_exercise_saved'
  | 'manual';

export interface SyncResult {
  status: 'success' | 'partial' | 'error' | 'busy' | 'skipped_guest_or_unauthenticated';
  pushResult: PushResult;
  pullResult: PullResult;
  errors: { entityType?: SyncEntityType; id?: string; message: string; kind: string }[];
}

/**
 * Creates safe initial watermark state for a user/entity type with no prior sync.
 */
export function createInitialWatermarkState(): WatermarkState {
  return {
    lastCompletedWatermark: null,
    activeCursor: null,
    hasMore: false,
  };
}

/**
 * Creates safe initial sync metadata state.
 */
export function createInitialSyncMetadataState(): SyncMetadataState {
  return {
    records: {},
    watermarks: {
      workout: createInitialWatermarkState(),
      template: createInitialWatermarkState(),
      custom_exercise: createInitialWatermarkState(),
    },
    activeStreamEntity: null,
  };
}
