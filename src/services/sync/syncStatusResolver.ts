import { EntitySyncMetadata } from './types';

export type ObservabilitySyncStatus =
  | 'LOCAL_ONLY'
  | 'WAITING_TO_SYNC'
  | 'SYNCING'
  | 'SAVED_TO_CLOUD'
  | 'SYNC_FAILED';

/**
 * Resolves the observability status of a synchronized entity.
 * This is the authoritative source of truth for the UI regarding cloud state.
 */
export function resolveSyncStatus(
  metadata: EntitySyncMetadata | null | undefined,
  isEngineBusy: boolean = false,
  isNetworkOnline: boolean = true,
  isRetrying: boolean = false,
  hasLastSyncFailed: boolean = false
): ObservabilitySyncStatus {
  if (!metadata) {
    return 'LOCAL_ONLY';
  }

  if (metadata.syncStatus === 'synced') {
    return 'SAVED_TO_CLOUD';
  }

  if (metadata.syncStatus === 'error') {
    return 'SYNC_FAILED';
  }

  if (metadata.syncStatus === 'pending_upload' || metadata.syncStatus === 'pending_delete') {
    if (isEngineBusy && isNetworkOnline) {
      return 'SYNCING';
    }
    
    if (isRetrying) {
      return 'WAITING_TO_SYNC';
    }
    
    if (hasLastSyncFailed) {
      return 'SYNC_FAILED';
    }

    return 'WAITING_TO_SYNC';
  }

  return 'LOCAL_ONLY';
}
