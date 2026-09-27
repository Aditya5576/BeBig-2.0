import { SyncEngine } from '../src/services/sync/syncEngine';
import { SyncLifecycleManager } from '../src/services/sync/syncLifecycleManager';
import { syncMetadataStore } from '../src/services/sync/syncMetadataStore';
import { UserScope } from '../src/features/auth/utils/userScope';
import { CloudError } from '../src/services/cloud/cloudErrors';
import { NetworkMonitor } from '../src/services/sync/networkMonitor';

const mockScope: UserScope = { ownerId: 'user1', ownerType: 'authenticated' };

describe('Sync-Status-2: Sync Reliability & Truthful States', () => {
  let engine: SyncEngine;
  let manager: SyncLifecycleManager;
  let mockNetwork: NetworkMonitor;
  let workoutService: any;
  let scheduledService: any;
  let templateService: any;
  let exerciseService: any;

  beforeEach(() => {
    // Basic service mocks
    workoutService = { upsertBatch: jest.fn().mockResolvedValue([]), upsert: jest.fn() };
    scheduledService = { upsertBatch: jest.fn().mockResolvedValue([]), upsert: jest.fn() };
    templateService = { upsertBatch: jest.fn().mockResolvedValue([]), upsert: jest.fn() };
    exerciseService = { upsertBatch: jest.fn().mockResolvedValue([]), upsert: jest.fn() };

    mockNetwork = {
      isOnline: jest.fn().mockReturnValue(true),
      subscribe: jest.fn(),
    } as any;

    engine = new SyncEngine(workoutService, templateService, exerciseService, scheduledService);
    manager = new SyncLifecycleManager(engine, mockNetwork);

    jest.spyOn(syncMetadataStore, 'getPendingRecords').mockResolvedValue([]);
    jest.spyOn(syncMetadataStore, 'markError').mockResolvedValue(undefined as any);
  });

  afterEach(() => {
    manager.reset();
    jest.clearAllMocks();
  });

  it('1. Head-of-line blocking: One entity fails but independent entity continues syncing', async () => {
    // Workout throws 500 Unknown error, Scheduled Workout succeeds
    jest.spyOn(syncMetadataStore, 'getPendingRecords').mockImplementation(async (type) => {
      if (type === 'workout') return [{ entityType: 'workout', id: 'w1', syncStatus: 'pending_upload', clientUpdatedAt: '' } as any];
      if (type === 'scheduled_workout') return [{ entityType: 'scheduled_workout', id: 's1', syncStatus: 'pending_upload', clientUpdatedAt: '' } as any];
      return [];
    });
    
    // Ensure payload builder doesn't error
    jest.spyOn(engine as any, 'buildWorkoutPayloads').mockResolvedValue({ payloads: [{ id: 'w1' }], validMeta: [] });
    jest.spyOn(engine as any, 'buildScheduledWorkoutPayloads').mockResolvedValue({ payloads: [{ id: 's1' }], validMeta: [] });

    workoutService.upsertBatch.mockRejectedValue(new CloudError('unknown', 'Unknown server error'));
    scheduledService.upsertBatch.mockResolvedValue([{ id: 's1', client_updated_at: '2026', updated_at: '2026' }]);
    
    jest.spyOn(engine as any, 'reconcileScheduledWorkoutResponses').mockResolvedValue({ synced: 1, reconciled: 0 });

    const result = await engine.push(mockScope);
    
    // Result should be partial, scheduled workout should have synced
    expect(result.status).toBe('partial');
    expect(result.errors).toContainEqual(expect.objectContaining({ kind: 'unknown' }));
    expect(scheduledService.upsertBatch).toHaveBeenCalled();
    expect(result.pushedCount).toBe(1); // 1 scheduled workout pushed
  });

  it('2. Network/Auth error aborts entire queue (safe abort)', async () => {
    jest.spyOn(syncMetadataStore, 'getPendingRecords').mockImplementation(async (type) => {
      if (type === 'workout') return [{ entityType: 'workout', id: 'w1', syncStatus: 'pending_upload', clientUpdatedAt: '' } as any];
      if (type === 'scheduled_workout') return [{ entityType: 'scheduled_workout', id: 's1', syncStatus: 'pending_upload', clientUpdatedAt: '' } as any];
      return [];
    });
    jest.spyOn(engine as any, 'buildWorkoutPayloads').mockResolvedValue({ payloads: [{ id: 'w1' }], validMeta: [] });

    workoutService.upsertBatch.mockRejectedValue(new CloudError('network', 'Network offline'));

    const result = await engine.push(mockScope);
    
    // Result should be error, scheduled workout should NOT be attempted
    expect(result.status).toBe('error');
    expect(scheduledService.upsertBatch).not.toHaveBeenCalled();
  });

  it('3. Permission/RLS error is caught, quarantined, and does not halt engine', async () => {
    jest.spyOn(syncMetadataStore, 'getPendingRecords').mockImplementation(async (type) => {
      if (type === 'workout') return [{ entityType: 'workout', id: 'w1', syncStatus: 'pending_upload', clientUpdatedAt: '' } as any];
      if (type === 'scheduled_workout') return [{ entityType: 'scheduled_workout', id: 's1', syncStatus: 'pending_upload', clientUpdatedAt: '' } as any];
      return [];
    });
    
    jest.spyOn(engine as any, 'buildWorkoutPayloads').mockResolvedValue({ payloads: [{ id: 'w1' }], validMeta: [] });
    jest.spyOn(engine as any, 'buildScheduledWorkoutPayloads').mockResolvedValue({ payloads: [{ id: 's1' }], validMeta: [] });

    // RLS permission error on batch
    workoutService.upsertBatch.mockRejectedValue(new CloudError('permission', 'RLS error'));
    // Fallback individual also hits RLS
    workoutService.upsert.mockRejectedValue(new CloudError('permission', 'RLS error'));
    
    scheduledService.upsertBatch.mockResolvedValue([{ id: 's1', client_updated_at: '2026', updated_at: '2026' }]);
    jest.spyOn(engine as any, 'reconcileScheduledWorkoutResponses').mockResolvedValue({ synced: 1, reconciled: 0 });

    const result = await engine.push(mockScope);
    
    expect(result.status).toBe('success');
    expect(result.quarantinedCount).toBe(1); // Workout quarantined!
    expect(syncMetadataStore.markError).toHaveBeenCalledWith('workout', 'w1', mockScope); // Quarantined means marked error
    expect(scheduledService.upsertBatch).toHaveBeenCalled(); // Engine continued!
  });

  it('4. Truthful status: Trigger tracks lastSyncFailed on network error', async () => {
    jest.spyOn(engine, 'sync').mockResolvedValue({
      status: 'error',
      errors: [{ message: 'Network', kind: 'network' }],
    } as any);

    await manager.triggerSync({ scope: mockScope });
    
    expect(manager.hasLastSyncFailed()).toBe(true);
    // Because it's a transient network error, retry loop should have started
    expect(manager.isRetrying()).toBe(true);
  });
});
