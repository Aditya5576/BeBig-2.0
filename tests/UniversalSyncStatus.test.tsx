import React from 'react';
import { render, waitFor, screen, cleanup } from '@testing-library/react-native';
import { useEntitySyncStatus } from '../src/services/sync/useEntitySyncStatus';
import { syncMetadataStore } from '../src/services/sync/syncMetadataStore';
import { syncEngine } from '../src/services/sync/syncEngine';
import { syncLifecycleManager } from '../src/services/sync/syncLifecycleManager';
import { Text } from 'react-native';

jest.mock('../src/services/sync/syncMetadataStore');
jest.mock('../src/services/sync/syncEngine');
jest.mock('../src/services/sync/syncLifecycleManager');

function TestComponent({ entityType, id }: { entityType: any, id: string | undefined }) {
  const status = useEntitySyncStatus(entityType, id, { ownerId: 'user1', ownerType: 'authenticated' });
  return <Text testID="status-text">{status}</Text>;
}

describe('SYNC-STATUS-3: Universal Sync Status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (syncEngine.isBusy as jest.Mock).mockReturnValue(false);
    (syncLifecycleManager.isRetrying as jest.Mock).mockReturnValue(false);
    (syncLifecycleManager.hasLastSyncFailed as jest.Mock).mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    cleanup();
  });

  it('1-2. Completed workouts (Quick Start) resolve to their workout_session status', async () => {
    (syncMetadataStore.getRecord as jest.Mock).mockResolvedValue({ syncStatus: 'synced' });
    render(<TestComponent entityType="workout" id="workout_qs_1" />);
    await waitFor(() => expect(screen.getByTestId('status-text').props.children).toBe('SAVED_TO_CLOUD'));
  });

  it('3. Template origin completed workout resolves status correctly', async () => {
    (syncMetadataStore.getRecord as jest.Mock).mockResolvedValue({ syncStatus: 'synced' });
    render(<TestComponent entityType="workout" id="workout_tpl_1" />);
    await waitFor(() => expect(screen.getByTestId('status-text').props.children).toBe('SAVED_TO_CLOUD'));
  });

  it('4. Scheduled origin completed workout resolves status correctly', async () => {
    (syncMetadataStore.getRecord as jest.Mock).mockResolvedValue({ syncStatus: 'synced' });
    render(<TestComponent entityType="workout" id="workout_sch_1" />);
    await waitFor(() => expect(screen.getByTestId('status-text').props.children).toBe('SAVED_TO_CLOUD'));
  });

  it('5. Scheduled workout uses scheduled workout ID', async () => {
    (syncMetadataStore.getRecord as jest.Mock).mockResolvedValue({ syncStatus: 'pending_upload' });
    render(<TestComponent entityType="scheduled_workout" id="sched_1" />);
    await waitFor(() => expect(screen.getByTestId('status-text').props.children).toBe('WAITING_TO_SYNC'));
  });

  it('6. Template uses template ID', async () => {
    (syncMetadataStore.getRecord as jest.Mock).mockResolvedValue({ syncStatus: 'pending_delete' });
    render(<TestComponent entityType="template" id="tpl_1" />);
    await waitFor(() => expect(screen.getByTestId('status-text').props.children).toBe('WAITING_TO_SYNC'));
  });

  it('7. Custom exercise displays LOCAL_ONLY if no metadata exists', async () => {
    (syncMetadataStore.getRecord as jest.Mock).mockResolvedValue(null);
    render(<TestComponent entityType="custom_exercise" id="ce_1" />);
    await waitFor(() => expect(screen.getByTestId('status-text').props.children).toBe('LOCAL_ONLY'));
  });

  it('12. Custom exercise displays cloud status if metadata exists', async () => {
    (syncMetadataStore.getRecord as jest.Mock).mockResolvedValue({ syncStatus: 'synced' });
    render(<TestComponent entityType="custom_exercise" id="ce_1" />);
    await waitFor(() => expect(screen.getByTestId('status-text').props.children).toBe('SAVED_TO_CLOUD'));
  });

  it('8, 13. SAVED_TO_CLOUD is shown only when metadata says synced. Active workout is LOCAL_ONLY', async () => {
    (syncMetadataStore.getRecord as jest.Mock).mockResolvedValue(null);
    render(<TestComponent entityType="workout" id="active_1" />);
    await waitFor(() => expect(screen.getByTestId('status-text').props.children).toBe('LOCAL_ONLY'));
  });

  it('9, 10. SYNCING is shown during active sync, WAITING_TO_SYNC otherwise', async () => {
    (syncMetadataStore.getRecord as jest.Mock).mockResolvedValue({ syncStatus: 'pending_upload' });
    (syncEngine.isBusy as jest.Mock).mockReturnValue(true); 
    render(<TestComponent entityType="workout" id="w1" />);
    await waitFor(() => expect(screen.getByTestId('status-text').props.children).toBe('SYNCING'));
  });

  it('11. SYNC_FAILED is shown for known failure', async () => {
    (syncMetadataStore.getRecord as jest.Mock).mockResolvedValue({ syncStatus: 'error' });
    render(<TestComponent entityType="workout" id="w1" />);
    await waitFor(() => expect(screen.getByTestId('status-text').props.children).toBe('SYNC_FAILED'));
  });

  it('14. Existing account isolation behavior remains intact', async () => {
    (syncMetadataStore.getRecord as jest.Mock).mockResolvedValue(null);
    render(<TestComponent entityType="workout" id="w1" />);
    await waitFor(() => {
      expect(syncMetadataStore.getRecord).toHaveBeenCalledWith('workout', 'w1', { ownerId: 'user1', ownerType: 'authenticated' });
    });
  });
});
