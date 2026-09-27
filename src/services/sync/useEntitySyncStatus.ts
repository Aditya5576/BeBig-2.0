import { useState, useEffect } from 'react';
import { SyncEntityType, EntitySyncMetadata } from './types';
import { syncMetadataStore } from './syncMetadataStore';
import { syncEngine } from './syncEngine';
import { syncLifecycleManager } from './index';
import { resolveSyncStatus, ObservabilitySyncStatus } from './syncStatusResolver';
import { UserScope, getCurrentUserScope } from '../../features/auth/utils/userScope';

/**
 * Hook to observe the synchronization status of a specific entity.
 * Polls status every 2 seconds while mounted, to avoid complex event emitter coupling
 * for this observability milestone.
 */
export function useEntitySyncStatus(
  entityType: SyncEntityType,
  id: string | undefined,
  scope?: UserScope | null
): ObservabilitySyncStatus {
  const [status, setStatus] = useState<ObservabilitySyncStatus>('LOCAL_ONLY');

  useEffect(() => {
    if (!id) {
      setStatus('LOCAL_ONLY');
      return;
    }

    let isMounted = true;
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();

    const fetchStatus = async () => {
      try {
        const metadata = await syncMetadataStore.getRecord(entityType, id, resolvedScope);
        const isBusy = syncEngine.isBusy();
        const isRetrying = syncLifecycleManager.isRetrying();
        const hasLastSyncFailed = syncLifecycleManager.hasLastSyncFailed();
        // Assuming network is online for now, can be enhanced with networkMonitor if needed
        const resolved = resolveSyncStatus(metadata, isBusy, true, isRetrying, hasLastSyncFailed);
        
        if (isMounted) {
          setStatus(resolved);
        }
      } catch (error) {
        // Fallback to local only if metadata unreadable
      }
    };

    // Initial fetch
    void fetchStatus();

    // Poll for changes
    const interval = setInterval(fetchStatus, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [entityType, id, scope]);

  return status;
}
