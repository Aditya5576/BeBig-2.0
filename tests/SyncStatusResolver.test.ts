import { resolveSyncStatus } from '../src/services/sync/syncStatusResolver';
import { EntitySyncMetadata } from '../src/services/sync/types';

describe('Sync-Status-1: resolveSyncStatus', () => {
  it('should return LOCAL_ONLY when metadata is null or undefined', () => {
    expect(resolveSyncStatus(null)).toBe('LOCAL_ONLY');
    expect(resolveSyncStatus(undefined)).toBe('LOCAL_ONLY');
  });

  it('should return SAVED_TO_CLOUD when status is synced', () => {
    const meta: EntitySyncMetadata = {
      entityType: 'workout',
      id: 'w1',
      clientUpdatedAt: '',
      deletedAt: null,
      syncStatus: 'synced',
    };
    expect(resolveSyncStatus(meta)).toBe('SAVED_TO_CLOUD');
  });

  it('should return SYNC_FAILED when status is error', () => {
    const meta: EntitySyncMetadata = {
      entityType: 'workout',
      id: 'w1',
      clientUpdatedAt: '',
      deletedAt: null,
      syncStatus: 'error',
    };
    expect(resolveSyncStatus(meta)).toBe('SYNC_FAILED');
  });

  it('should return WAITING_TO_SYNC when pending and engine is not busy', () => {
    const meta: EntitySyncMetadata = {
      entityType: 'workout',
      id: 'w1',
      clientUpdatedAt: '',
      deletedAt: null,
      syncStatus: 'pending_upload',
    };
    expect(resolveSyncStatus(meta, false, true)).toBe('WAITING_TO_SYNC');
  });

  it('should return WAITING_TO_SYNC when pending, engine is busy, but network is offline', () => {
    const meta: EntitySyncMetadata = {
      entityType: 'workout',
      id: 'w1',
      clientUpdatedAt: '',
      deletedAt: null,
      syncStatus: 'pending_upload',
    };
    expect(resolveSyncStatus(meta, true, false)).toBe('WAITING_TO_SYNC');
  });

  it('should return WAITING_TO_SYNC when pending and engine is not busy but is retrying', () => {
    const meta: EntitySyncMetadata = {
      entityType: 'workout',
      id: 'w1',
      clientUpdatedAt: '',
      deletedAt: null,
      syncStatus: 'pending_upload',
    };
    expect(resolveSyncStatus(meta, false, true, true, false)).toBe('WAITING_TO_SYNC');
  });

  it('should return SYNC_FAILED when pending and engine is not busy and last sync failed', () => {
    const meta: EntitySyncMetadata = {
      entityType: 'workout',
      id: 'w1',
      clientUpdatedAt: '',
      deletedAt: null,
      syncStatus: 'pending_upload',
    };
    expect(resolveSyncStatus(meta, false, true, false, true)).toBe('SYNC_FAILED');
  });

  it('should return SYNCING when pending, engine is busy, and network is online', () => {
    const meta: EntitySyncMetadata = {
      entityType: 'workout',
      id: 'w1',
      clientUpdatedAt: '',
      deletedAt: null,
      syncStatus: 'pending_upload',
    };
    expect(resolveSyncStatus(meta, true, true, false, false)).toBe('SYNCING');
  });

  it('should return SYNCING when pending_delete, engine is busy, and network is online', () => {
    const meta: EntitySyncMetadata = {
      entityType: 'workout',
      id: 'w1',
      clientUpdatedAt: '',
      deletedAt: 'date',
      syncStatus: 'pending_delete',
    };
    expect(resolveSyncStatus(meta, true, true, false, false)).toBe('SYNCING');
  });
});
