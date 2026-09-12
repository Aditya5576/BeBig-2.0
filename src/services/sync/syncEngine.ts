/**
 * BeBig 2.0 — Local-First Synchronization Engine (Push Path)
 *
 * Coordinates local outbox processing, deterministic batching,
 * cloud uploads via dedicated cloud data access services, and
 * Last-Write-Wins (LWW) reconciliation.
 *
 * Invariants:
 * 1. Local storage remains the source of truth for the UI.
 * 2. Active/in-progress workouts are NEVER pushed or synced.
 * 3. Guest sessions NEVER push to Supabase (zero network calls).
 * 4. Stable client IDs are strictly preserved.
 * 5. If the cloud rejects a stale local push and returns an authoritative newer record,
 *    local storage is immediately overwritten and reconciled to the cloud authority.
 * 6. Deletion tombstones strictly beat live data on ties.
 * 7. In-flight push operations are protected by an in-memory concurrency mutex.
 */

import { getCurrentUserScope, UserScope } from '../../features/auth/utils/userScope';
import { workoutStorage } from '../../features/workout/storage/workoutStorage';
import { templateStorage } from '../../features/templates/storage/templateStorage';
import { customExerciseStorage } from '../../features/exercises/storage/customExerciseStorage';
import { WorkoutSession } from '../../features/workout/types';
import { WorkoutTemplate } from '../../features/templates/types';
import { Exercise } from '../../features/exercises/types';
import {
  WorkoutCloudService,
  TemplateCloudService,
  CustomExerciseCloudService,
  WorkoutCloudInput,
  TemplateCloudInput,
  CustomExerciseCloudInput,
  WorkoutCloudRecord,
  TemplateCloudRecord,
  CustomExerciseCloudRecord,
  CloudPullOptions,
  CloudPullResult,
  CloudError,
  classifySupabaseError,
} from '../cloud';
import { syncMetadataStore } from './syncMetadataStore';
import {
  EntitySyncMetadata,
  PushBatchResult,
  PushResult,
  PullBatchResult,
  PullResult,
  SyncResult,
  SyncEntityType,
} from './types';

export const PUSH_BATCH_SIZE = 50;
export const PULL_PAGE_SIZE = 50;
export const MAX_PULL_RECORDS_PER_PASS = 200;
export const WATERMARK_OVERLAP_MS = 5000;

export class SyncEngine {
  private workoutCloudService: WorkoutCloudService;
  private templateCloudService: TemplateCloudService;
  private customExerciseCloudService: CustomExerciseCloudService;
  private isPushing = false;
  private isPulling = false;
  private isSyncing = false;

  constructor(
    workoutCloudService: WorkoutCloudService = new WorkoutCloudService(),
    templateCloudService: TemplateCloudService = new TemplateCloudService(),
    customExerciseCloudService: CustomExerciseCloudService = new CustomExerciseCloudService(),
  ) {
    this.workoutCloudService = workoutCloudService;
    this.templateCloudService = templateCloudService;
    this.customExerciseCloudService = customExerciseCloudService;
  }

  /**
   * Authoritative query for active sync or push/pull operations.
   */
  isBusy(): boolean {
    return this.isSyncing || this.isPushing || this.isPulling;
  }

  /**
   * Unified sync cycle: sequentially executes push (flushes local outbox)
   * followed by pull (ingests remote delta updates).
   * Authoritative owner of the overarching synchronization mutex.
   */
  async sync(scope?: UserScope | null): Promise<SyncResult> {
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();

    if (!resolvedScope || resolvedScope.ownerType !== 'authenticated' || !resolvedScope.ownerId) {
      const dummyPush: PushResult = {
        status: 'skipped_guest_or_unauthenticated',
        pushedCount: 0,
        reconciledCount: 0,
        quarantinedCount: 0,
        batches: [],
        errors: [],
      };
      const dummyPull: PullResult = {
        status: 'skipped_guest_or_unauthenticated',
        pulledCount: 0,
        appliedCount: 0,
        ignoredCount: 0,
        tombstonesApplied: 0,
        quarantinedCount: 0,
        hasMore: false,
        batches: [],
        errors: [],
      };
      return {
        status: 'skipped_guest_or_unauthenticated',
        pushResult: dummyPush,
        pullResult: dummyPull,
        errors: [],
      };
    }

    if (this.isSyncing || this.isPushing || this.isPulling) {
      const busyPush: PushResult = {
        status: 'busy',
        pushedCount: 0,
        reconciledCount: 0,
        quarantinedCount: 0,
        batches: [],
        errors: [{ message: 'Sync operation already in progress.', kind: 'busy' }],
      };
      const busyPull: PullResult = {
        status: 'busy',
        pulledCount: 0,
        appliedCount: 0,
        ignoredCount: 0,
        tombstonesApplied: 0,
        quarantinedCount: 0,
        hasMore: false,
        batches: [],
        errors: [{ message: 'Sync operation already in progress.', kind: 'busy' }],
      };
      return {
        status: 'busy',
        pushResult: busyPush,
        pullResult: busyPull,
        errors: [{ message: 'Sync operation already in progress.', kind: 'busy' }],
      };
    }

    this.isSyncing = true;
    try {
      // 1. Push pending local mutations to Supabase
      const pushResult = await this.push(resolvedScope);

      // If push encountered a fatal transport/auth failure, halt cleanly
      const fatalPushError = pushResult.errors.find(
        (e) => e.kind === 'network' || e.kind === 'auth' || e.kind === 'permission'
      );
      if (fatalPushError) {
        const skippedPull: PullResult = {
          status: 'error',
          pulledCount: 0,
          appliedCount: 0,
          ignoredCount: 0,
          tombstonesApplied: 0,
          quarantinedCount: 0,
          hasMore: false,
          batches: [],
          errors: [fatalPushError],
        };
        return {
          status: 'error',
          pushResult,
          pullResult: skippedPull,
          errors: [...pushResult.errors],
        };
      }

      // 2. Pull remote delta changes
      const pullResult = await this.pull(resolvedScope);

      const allErrors = [...pushResult.errors, ...pullResult.errors];
      const hasErrors = allErrors.length > 0;
      const isPartial =
        pushResult.status === 'partial' || pullResult.status === 'partial' || pullResult.hasMore;
      const isError = pushResult.status === 'error' || pullResult.status === 'error';

      let overallStatus: SyncResult['status'] = 'success';
      if (isError) {
        const hadAnyActivity = pushResult.pushedCount > 0 || pullResult.appliedCount > 0;
        overallStatus = hadAnyActivity ? 'partial' : 'error';
      } else if (isPartial || hasErrors) {
        overallStatus = 'partial';
      }

      return {
        status: overallStatus,
        pushResult,
        pullResult,
        errors: allErrors,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pushes all pending local entity mutations and tombstones to Supabase.
   * Serialized with an in-memory mutex to prevent concurrent sync races.
   */
  async push(scope?: UserScope | null): Promise<PushResult> {
    if (this.isPushing) {
      return {
        status: 'busy',
        pushedCount: 0,
        reconciledCount: 0,
        quarantinedCount: 0,
        batches: [],
        errors: [{ message: 'Push operation already in progress.', kind: 'busy' }],
      };
    }

    this.isPushing = true;
    try {
      return await this.executePush(scope);
    } finally {
      this.isPushing = false;
    }
  }

  private async executePush(scope?: UserScope | null): Promise<PushResult> {
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();

    // Invariant: Guests and unauthenticated callers never push to Supabase
    if (!resolvedScope || resolvedScope.ownerType !== 'authenticated' || !resolvedScope.ownerId) {
      return {
        status: 'skipped_guest_or_unauthenticated',
        pushedCount: 0,
        reconciledCount: 0,
        quarantinedCount: 0,
        batches: [],
        errors: [],
      };
    }

    // Step 1: Run crash-recovery scanner to ensure outbox consistency
    await syncMetadataStore.reconcileLocalEntities(resolvedScope);

    let totalPushed = 0;
    let totalReconciled = 0;
    let totalQuarantined = 0;
    const batchResults: PushBatchResult[] = [];
    const errors: { entityType?: SyncEntityType; id?: string; message: string; kind: string }[] = [];

    // Step 2: Process entities in order: workouts -> templates -> custom exercises
    const entityTypes: SyncEntityType[] = ['workout', 'template', 'custom_exercise'];

    for (const entityType of entityTypes) {
      const pendingRecords = await syncMetadataStore.getPendingRecords(entityType, resolvedScope);
      if (pendingRecords.length === 0) continue;

      // Slice into batches of up to 50 records
      for (let i = 0; i < pendingRecords.length; i += PUSH_BATCH_SIZE) {
        const chunk = pendingRecords.slice(i, i + PUSH_BATCH_SIZE);
        const batchOutcome = await this.pushEntityChunk(entityType, chunk, resolvedScope);

        totalPushed += batchOutcome.synced;
        totalReconciled += batchOutcome.reconciled;
        totalQuarantined += batchOutcome.quarantined;
        batchResults.push(batchOutcome);

        if (batchOutcome.fatalError) {
          errors.push(batchOutcome.fatalError);
          // Halt further processing on network, auth, permission, unknown, or other non-validation fatal errors.
          // Metadata status (pending_upload / pending_delete) is strictly preserved so future sync passes can retry.
          const hasAnySuccess = totalPushed > 0 || totalReconciled > 0;
          return {
            status: hasAnySuccess ? 'partial' : 'error',
            pushedCount: totalPushed,
            reconciledCount: totalReconciled,
            quarantinedCount: totalQuarantined,
            batches: batchResults,
            errors,
          };
        }
      }
    }

    const hasErrors = errors.length > 0;
    const hasSuccess = totalPushed > 0 || totalReconciled > 0;

    return {
      status: hasErrors ? (hasSuccess ? 'partial' : 'error') : 'success',
      pushedCount: totalPushed,
      reconciledCount: totalReconciled,
      quarantinedCount: totalQuarantined,
      batches: batchResults,
      errors,
    };
  }

  /**
   * Pushes a single batch (up to 50 records) for an entity type.
   */
  private async pushEntityChunk(
    entityType: SyncEntityType,
    chunk: EntitySyncMetadata[],
    scope: UserScope,
  ): Promise<PushBatchResult & { fatalError?: { entityType: SyncEntityType; message: string; kind: string } }> {
    let attempted = 0;
    let synced = 0;
    let reconciled = 0;
    let quarantined = 0;

    switch (entityType) {
      case 'workout': {
        const { payloads, validMeta } = await this.buildWorkoutPayloads(chunk, scope);
        attempted = payloads.length;
        if (attempted === 0) return { entityType, attempted: 0, synced: 0, reconciled: 0, quarantined: 0 };

        try {
          const returnedRows = await this.workoutCloudService.upsertBatch(payloads);
          const outcome = await this.reconcileWorkoutResponses(payloads, returnedRows, scope);
          synced += outcome.synced;
          reconciled += outcome.reconciled;
        } catch (err: any) {
          const cloudErr = err instanceof CloudError ? err : classifySupabaseError(err);
          if (cloudErr.kind === 'validation') {
            // Quarantine fallback: test individually
            const qResult = await this.fallbackIndividualWorkouts(payloads, validMeta, scope);
            synced += qResult.synced;
            reconciled += qResult.reconciled;
            quarantined += qResult.quarantined;
          } else {
            return {
              entityType,
              attempted,
              synced,
              reconciled,
              quarantined,
              fatalError: { entityType, message: cloudErr.message, kind: cloudErr.kind },
            };
          }
        }
        break;
      }

      case 'template': {
        const { payloads, validMeta } = await this.buildTemplatePayloads(chunk, scope);
        attempted = payloads.length;
        if (attempted === 0) return { entityType, attempted: 0, synced: 0, reconciled: 0, quarantined: 0 };

        try {
          const returnedRows = await this.templateCloudService.upsertBatch(payloads);
          const outcome = await this.reconcileTemplateResponses(payloads, returnedRows, scope);
          synced += outcome.synced;
          reconciled += outcome.reconciled;
        } catch (err: any) {
          const cloudErr = err instanceof CloudError ? err : classifySupabaseError(err);
          if (cloudErr.kind === 'validation') {
            const qResult = await this.fallbackIndividualTemplates(payloads, validMeta, scope);
            synced += qResult.synced;
            reconciled += qResult.reconciled;
            quarantined += qResult.quarantined;
          } else {
            return {
              entityType,
              attempted,
              synced,
              reconciled,
              quarantined,
              fatalError: { entityType, message: cloudErr.message, kind: cloudErr.kind },
            };
          }
        }
        break;
      }

      case 'custom_exercise': {
        const { payloads, validMeta } = await this.buildCustomExercisePayloads(chunk, scope);
        attempted = payloads.length;
        if (attempted === 0) return { entityType, attempted: 0, synced: 0, reconciled: 0, quarantined: 0 };

        try {
          const returnedRows = await this.customExerciseCloudService.upsertBatch(payloads);
          const outcome = await this.reconcileCustomExerciseResponses(payloads, returnedRows, scope);
          synced += outcome.synced;
          reconciled += outcome.reconciled;
        } catch (err: any) {
          const cloudErr = err instanceof CloudError ? err : classifySupabaseError(err);
          if (cloudErr.kind === 'validation') {
            const qResult = await this.fallbackIndividualCustomExercises(payloads, validMeta, scope);
            synced += qResult.synced;
            reconciled += qResult.reconciled;
            quarantined += qResult.quarantined;
          } else {
            return {
              entityType,
              attempted,
              synced,
              reconciled,
              quarantined,
              fatalError: { entityType, message: cloudErr.message, kind: cloudErr.kind },
            };
          }
        }
        break;
      }
    }

    return { entityType, attempted, synced, reconciled, quarantined };
  }

  // --------------------------------------------------------------------------
  // WORKOUT PAYLOAD BUILDERS & RECONCILERS
  // --------------------------------------------------------------------------

  private async buildWorkoutPayloads(
    chunk: EntitySyncMetadata[],
    scope: UserScope,
  ): Promise<{ payloads: WorkoutCloudInput[]; validMeta: EntitySyncMetadata[] }> {
    const payloads: WorkoutCloudInput[] = [];
    const validMeta: EntitySyncMetadata[] = [];

    for (const meta of chunk) {
      if (meta.syncStatus === 'pending_upload') {
        const local = await workoutStorage.getCompletedWorkoutById(meta.id, scope);
        // Active workouts or missing local entities are strictly not pushed
        if (!local || local.status !== 'completed') {
          await syncMetadataStore.removeRecord('workout', meta.id, scope);
          continue;
        }

        payloads.push({
          id: local.id,
          name: local.name,
          sourceTemplateId: local.sourceTemplateId || null,
          startedAt: local.startedAt,
          finishedAt: local.finishedAt || local.startedAt,
          totalDuration: local.totalDuration ?? 0,
          totalVolume: local.totalVolume ?? 0,
          completedSetsCount: local.completedSetsCount ?? 0,
          exercises: local.exercises || [],
          clientUpdatedAt: meta.clientUpdatedAt,
          deletedAt: null,
          expectedUserId: scope.ownerId,
        });
        validMeta.push(meta);
      } else if (meta.syncStatus === 'pending_delete') {
        payloads.push({
          id: meta.id,
          name: 'Deleted Workout',
          startedAt: meta.deletedAt || meta.clientUpdatedAt,
          finishedAt: meta.deletedAt || meta.clientUpdatedAt,
          exercises: [],
          clientUpdatedAt: meta.clientUpdatedAt,
          deletedAt: meta.deletedAt || meta.clientUpdatedAt,
          expectedUserId: scope.ownerId,
        });
        validMeta.push(meta);
      }
    }

    return { payloads, validMeta };
  }

  private async reconcileWorkoutResponses(
    pushed: WorkoutCloudInput[],
    returned: WorkoutCloudRecord[],
    scope: UserScope,
  ): Promise<{ synced: number; reconciled: number }> {
    const pushedMap = new Map(pushed.map((p) => [p.id, p]));
    let synced = 0;
    let reconciled = 0;

    for (const row of returned) {
      const p = pushedMap.get(row.id);
      if (!p) continue;

      const pushedMs = new Date(p.clientUpdatedAt || p.startedAt).getTime();
      const returnedMs = new Date(row.client_updated_at).getTime();

      // CASE A: Cloud record is a tombstone
      if (row.deleted_at !== null) {
        await workoutStorage.deleteCompletedWorkout(row.id, scope);
        await syncMetadataStore.setRecord(
          {
            entityType: 'workout',
            id: row.id,
            clientUpdatedAt: row.client_updated_at,
            deletedAt: row.deleted_at,
            syncStatus: 'synced',
            lastSyncedServerUpdatedAt: row.updated_at,
          },
          scope,
        );

        if (p.deletedAt === null || returnedMs > pushedMs) {
          reconciled++;
        } else {
          synced++;
        }
      }
      // CASE B: Cloud record is LIVE
      else {
        if (returnedMs > pushedMs) {
          // Stale push rejected: Cloud authority is newer -> overwrite local storage
          const localSession: WorkoutSession = {
            id: row.id,
            name: row.name,
            sourceTemplateId: row.source_template_id || undefined,
            startedAt: row.started_at,
            finishedAt: row.finished_at,
            status: 'completed',
            totalDuration: row.total_duration,
            totalVolume: Number(row.total_volume),
            completedSetsCount: row.completed_sets_count,
            exercises: row.exercises || [],
            ownerId: scope.ownerId,
            ownerType: 'authenticated',
          };
          await workoutStorage.saveCompletedWorkout(localSession, scope);
          await syncMetadataStore.setRecord(
            {
              entityType: 'workout',
              id: row.id,
              clientUpdatedAt: row.client_updated_at,
              deletedAt: null,
              syncStatus: 'synced',
              lastSyncedServerUpdatedAt: row.updated_at,
            },
            scope,
          );
          reconciled++;
        } else {
          // Normal winning push
          await syncMetadataStore.markSynced('workout', row.id, row.updated_at, null, scope);
          synced++;
        }
      }
    }

    return { synced, reconciled };
  }

  // --------------------------------------------------------------------------
  // TEMPLATE PAYLOAD BUILDERS & RECONCILERS
  // --------------------------------------------------------------------------

  private async buildTemplatePayloads(
    chunk: EntitySyncMetadata[],
    scope: UserScope,
  ): Promise<{ payloads: TemplateCloudInput[]; validMeta: EntitySyncMetadata[] }> {
    const payloads: TemplateCloudInput[] = [];
    const validMeta: EntitySyncMetadata[] = [];

    for (const meta of chunk) {
      if (meta.syncStatus === 'pending_upload') {
        const local = await templateStorage.getTemplateById(meta.id, scope);
        if (!local) {
          await syncMetadataStore.removeRecord('template', meta.id, scope);
          continue;
        }

        payloads.push({
          id: local.id,
          name: local.name,
          exercises: local.exercises || [],
          clientUpdatedAt: meta.clientUpdatedAt,
          deletedAt: null,
          expectedUserId: scope.ownerId,
        });
        validMeta.push(meta);
      } else if (meta.syncStatus === 'pending_delete') {
        payloads.push({
          id: meta.id,
          name: 'Deleted Template',
          exercises: [],
          clientUpdatedAt: meta.clientUpdatedAt,
          deletedAt: meta.deletedAt || meta.clientUpdatedAt,
          expectedUserId: scope.ownerId,
        });
        validMeta.push(meta);
      }
    }

    return { payloads, validMeta };
  }

  private async reconcileTemplateResponses(
    pushed: TemplateCloudInput[],
    returned: TemplateCloudRecord[],
    scope: UserScope,
  ): Promise<{ synced: number; reconciled: number }> {
    const pushedMap = new Map(pushed.map((p) => [p.id, p]));
    let synced = 0;
    let reconciled = 0;

    for (const row of returned) {
      const p = pushedMap.get(row.id);
      if (!p) continue;

      const pushedMs = new Date(p.clientUpdatedAt || new Date().toISOString()).getTime();
      const returnedMs = new Date(row.client_updated_at).getTime();

      // CASE A: Cloud record is a tombstone
      if (row.deleted_at !== null) {
        await templateStorage.deleteTemplate(row.id, scope);
        await syncMetadataStore.setRecord(
          {
            entityType: 'template',
            id: row.id,
            clientUpdatedAt: row.client_updated_at,
            deletedAt: row.deleted_at,
            syncStatus: 'synced',
            lastSyncedServerUpdatedAt: row.updated_at,
          },
          scope,
        );

        if (p.deletedAt === null || returnedMs > pushedMs) {
          reconciled++;
        } else {
          synced++;
        }
      }
      // CASE B: Cloud record is LIVE
      else {
        if (returnedMs > pushedMs) {
          // Stale push rejected: Cloud authority is newer -> overwrite local storage
          const localTemplate: WorkoutTemplate = {
            id: row.id,
            name: row.name,
            exercises: row.exercises || [],
            createdAt: row.created_at,
            updatedAt: row.client_updated_at,
            ownerId: scope.ownerId,
            ownerType: 'authenticated',
          };
          await templateStorage.saveTemplate(localTemplate, scope);
          await syncMetadataStore.setRecord(
            {
              entityType: 'template',
              id: row.id,
              clientUpdatedAt: row.client_updated_at,
              deletedAt: null,
              syncStatus: 'synced',
              lastSyncedServerUpdatedAt: row.updated_at,
            },
            scope,
          );
          reconciled++;
        } else {
          // Normal winning push
          await syncMetadataStore.markSynced('template', row.id, row.updated_at, null, scope);
          synced++;
        }
      }
    }

    return { synced, reconciled };
  }

  // --------------------------------------------------------------------------
  // CUSTOM EXERCISE PAYLOAD BUILDERS & RECONCILERS
  // --------------------------------------------------------------------------

  private async buildCustomExercisePayloads(
    chunk: EntitySyncMetadata[],
    scope: UserScope,
  ): Promise<{ payloads: CustomExerciseCloudInput[]; validMeta: EntitySyncMetadata[] }> {
    const payloads: CustomExerciseCloudInput[] = [];
    const validMeta: EntitySyncMetadata[] = [];
    const localExercises = await customExerciseStorage.getCustomExercises(scope);
    const exerciseMap = new Map(localExercises.map((e) => [e.id, e]));

    for (const meta of chunk) {
      if (meta.syncStatus === 'pending_upload') {
        const local = exerciseMap.get(meta.id);
        if (!local || !local.isCustom) {
          await syncMetadataStore.removeRecord('custom_exercise', meta.id, scope);
          continue;
        }

        payloads.push({
          id: local.id,
          name: local.name,
          description: local.description || '',
          category: local.category,
          categoryName: local.categoryName,
          primaryMuscles: local.primaryMuscles || [],
          secondaryMuscles: local.secondaryMuscles || [],
          equipment: local.equipment || [],
          clientUpdatedAt: meta.clientUpdatedAt,
          deletedAt: null,
          expectedUserId: scope.ownerId,
        });
        validMeta.push(meta);
      } else if (meta.syncStatus === 'pending_delete') {
        payloads.push({
          id: meta.id,
          name: 'Deleted Exercise',
          category: 'other',
          categoryName: 'Other',
          primaryMuscles: [],
          clientUpdatedAt: meta.clientUpdatedAt,
          deletedAt: meta.deletedAt || meta.clientUpdatedAt,
          expectedUserId: scope.ownerId,
        });
        validMeta.push(meta);
      }
    }

    return { payloads, validMeta };
  }

  private async reconcileCustomExerciseResponses(
    pushed: CustomExerciseCloudInput[],
    returned: CustomExerciseCloudRecord[],
    scope: UserScope,
  ): Promise<{ synced: number; reconciled: number }> {
    const pushedMap = new Map(pushed.map((p) => [p.id, p]));
    let synced = 0;
    let reconciled = 0;

    for (const row of returned) {
      const p = pushedMap.get(row.id);
      if (!p) continue;

      const pushedMs = new Date(p.clientUpdatedAt || new Date().toISOString()).getTime();
      const returnedMs = new Date(row.client_updated_at).getTime();

      // CASE A: Cloud record is a tombstone
      if (row.deleted_at !== null) {
        await customExerciseStorage.deleteCustomExercise(row.id, scope);
        await syncMetadataStore.setRecord(
          {
            entityType: 'custom_exercise',
            id: row.id,
            clientUpdatedAt: row.client_updated_at,
            deletedAt: row.deleted_at,
            syncStatus: 'synced',
            lastSyncedServerUpdatedAt: row.updated_at,
          },
          scope,
        );

        if (p.deletedAt === null || returnedMs > pushedMs) {
          reconciled++;
        } else {
          synced++;
        }
      }
      // CASE B: Cloud record is LIVE
      else {
        if (returnedMs > pushedMs) {
          // Stale push rejected: Cloud authority is newer -> overwrite local storage
          const localExercise: Exercise = {
            id: row.id,
            name: row.name,
            description: row.description || '',
            category: row.category,
            categoryName: row.category_name,
            primaryMuscles: row.primary_muscles || [],
            secondaryMuscles: row.secondary_muscles || [],
            equipment: row.equipment || [],
            images: [],
            sourceProvider: 'custom',
            isCustom: true,
            createdAt: row.created_at,
            ownerId: scope.ownerId,
            ownerType: 'authenticated',
          };
          await customExerciseStorage.saveCustomExercise(localExercise, scope);
          await syncMetadataStore.setRecord(
            {
              entityType: 'custom_exercise',
              id: row.id,
              clientUpdatedAt: row.client_updated_at,
              deletedAt: null,
              syncStatus: 'synced',
              lastSyncedServerUpdatedAt: row.updated_at,
            },
            scope,
          );
          reconciled++;
        } else {
          // Normal winning push
          await syncMetadataStore.markSynced('custom_exercise', row.id, row.updated_at, null, scope);
          synced++;
        }
      }
    }

    return { synced, reconciled };
  }

  // --------------------------------------------------------------------------
  // INDIVIDUAL ITEM VALIDATION ERROR FALLBACKS (POISON PILL QUARANTINE)
  // --------------------------------------------------------------------------

  private async fallbackIndividualWorkouts(
    payloads: WorkoutCloudInput[],
    validMeta: EntitySyncMetadata[],
    scope: UserScope,
  ): Promise<{ synced: number; reconciled: number; quarantined: number }> {
    let synced = 0;
    let reconciled = 0;
    let quarantined = 0;

    for (let i = 0; i < payloads.length; i++) {
      const p = payloads[i];
      try {
        const returned = await this.workoutCloudService.upsert(p);
        const outcome = await this.reconcileWorkoutResponses([p], [returned], scope);
        synced += outcome.synced;
        reconciled += outcome.reconciled;
      } catch (err: any) {
        const cloudErr = err instanceof CloudError ? err : classifySupabaseError(err);
        if (cloudErr.kind === 'validation') {
          await syncMetadataStore.markError('workout', p.id, scope);
          quarantined++;
        }
      }
    }

    return { synced, reconciled, quarantined };
  }

  private async fallbackIndividualTemplates(
    payloads: TemplateCloudInput[],
    validMeta: EntitySyncMetadata[],
    scope: UserScope,
  ): Promise<{ synced: number; reconciled: number; quarantined: number }> {
    let synced = 0;
    let reconciled = 0;
    let quarantined = 0;

    for (let i = 0; i < payloads.length; i++) {
      const p = payloads[i];
      try {
        const returned = await this.templateCloudService.upsert(p);
        const outcome = await this.reconcileTemplateResponses([p], [returned], scope);
        synced += outcome.synced;
        reconciled += outcome.reconciled;
      } catch (err: any) {
        const cloudErr = err instanceof CloudError ? err : classifySupabaseError(err);
        if (cloudErr.kind === 'validation') {
          await syncMetadataStore.markError('template', p.id, scope);
          quarantined++;
        }
      }
    }

    return { synced, reconciled, quarantined };
  }

  private async fallbackIndividualCustomExercises(
    payloads: CustomExerciseCloudInput[],
    validMeta: EntitySyncMetadata[],
    scope: UserScope,
  ): Promise<{ synced: number; reconciled: number; quarantined: number }> {
    let synced = 0;
    let reconciled = 0;
    let quarantined = 0;

    for (let i = 0; i < payloads.length; i++) {
      const p = payloads[i];
      try {
        const returned = await this.customExerciseCloudService.upsert(p);
        const outcome = await this.reconcileCustomExerciseResponses([p], [returned], scope);
        synced += outcome.synced;
        reconciled += outcome.reconciled;
      } catch (err: any) {
        const cloudErr = err instanceof CloudError ? err : classifySupabaseError(err);
        if (cloudErr.kind === 'validation') {
          await syncMetadataStore.markError('custom_exercise', p.id, scope);
          quarantined++;
        }
      }
    }

    return { synced, reconciled, quarantined };
  }

  // ==========================================================================
  // PULL PATH IMPLEMENTATION (CHECKPOINT 3.3)
  // ==========================================================================

  /**
   * Pulls changed records from Supabase for completed workouts, templates, and custom exercises.
   * Enforces deterministic keyset pagination, 5-second overlap on delta baselines,
   * pass budgeting (max 200 records), and LWW conflict reconciliation.
   */
  async pull(scope?: UserScope | null): Promise<PullResult> {
    if (this.isPulling) {
      return {
        status: 'busy',
        pulledCount: 0,
        appliedCount: 0,
        ignoredCount: 0,
        tombstonesApplied: 0,
        quarantinedCount: 0,
        hasMore: false,
        batches: [],
        errors: [{ message: 'Pull operation already in progress.', kind: 'busy' }],
      };
    }

    this.isPulling = true;
    try {
      return await this.executePull(scope);
    } finally {
      this.isPulling = false;
    }
  }

  private async executePull(scope?: UserScope | null): Promise<PullResult> {
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();

    // Invariant: Guests and unauthenticated callers never pull from Supabase
    if (!resolvedScope || resolvedScope.ownerType !== 'authenticated' || !resolvedScope.ownerId) {
      return {
        status: 'skipped_guest_or_unauthenticated',
        pulledCount: 0,
        appliedCount: 0,
        ignoredCount: 0,
        tombstonesApplied: 0,
        quarantinedCount: 0,
        hasMore: false,
        batches: [],
        errors: [],
      };
    }

    const ENTITY_PULL_ORDER: SyncEntityType[] = ['workout', 'template', 'custom_exercise'];

    let remainingBudget = MAX_PULL_RECORDS_PER_PASS;
    let totalPulled = 0;
    let totalApplied = 0;
    let totalIgnored = 0;
    let totalTombstones = 0;
    let totalQuarantined = 0;
    let passHasMore = false;
    const batchResults: PullBatchResult[] = [];
    const errors: { entityType?: SyncEntityType; id?: string; message: string; kind: string }[] = [];

    // Determine starting entity from persisted activeStreamEntity
    const activeStreamEntity = await syncMetadataStore.getActiveStreamEntity(resolvedScope);
    let startIndex = activeStreamEntity ? ENTITY_PULL_ORDER.indexOf(activeStreamEntity) : 0;
    if (startIndex < 0) startIndex = 0;

    for (let i = startIndex; i < ENTITY_PULL_ORDER.length; i++) {
      if (remainingBudget <= 0) {
        passHasMore = true;
        break;
      }

      const entityType = ENTITY_PULL_ORDER[i];
      const watermark = await syncMetadataStore.getWatermark(entityType, resolvedScope);
      let activeCursor = watermark.activeCursor;
      let isStreamComplete = false;
      let highestSeenUpdatedAt = watermark.lastCompletedWatermark;

      let entityPulled = 0;
      let entityApplied = 0;
      let entityIgnored = 0;
      let entityTombstones = 0;
      let entityQuarantined = 0;

      while (remainingBudget > 0 && !isStreamComplete) {
        const pageLimit = Math.min(PULL_PAGE_SIZE, remainingBudget);

        let pullOptions: CloudPullOptions;
        if (activeCursor) {
          // Exact keyset continuation: NO 5-second overlap
          pullOptions = { cursor: activeCursor, limit: pageLimit, expectedUserId: resolvedScope.ownerId };
        } else if (watermark.lastCompletedWatermark) {
          // Baseline delta query: 5-second overlap
          const overlapMs = new Date(watermark.lastCompletedWatermark).getTime() - WATERMARK_OVERLAP_MS;
          const sinceUpdatedAt = new Date(Math.max(0, overlapMs)).toISOString();
          pullOptions = { sinceUpdatedAt, limit: pageLimit, expectedUserId: resolvedScope.ownerId };
        } else {
          // Initial full sync
          pullOptions = { limit: pageLimit, expectedUserId: resolvedScope.ownerId };
        }

        let cloudResult: CloudPullResult<any>;
        try {
          switch (entityType) {
            case 'workout':
              cloudResult = await this.workoutCloudService.fetchChanged(pullOptions);
              break;
            case 'template':
              cloudResult = await this.templateCloudService.fetchChanged(pullOptions);
              break;
            case 'custom_exercise':
              cloudResult = await this.customExerciseCloudService.fetchChanged(pullOptions);
              break;
          }
        } catch (err: any) {
          const cloudErr = err instanceof CloudError ? err : classifySupabaseError(err);
          errors.push({ entityType, message: cloudErr.message, kind: cloudErr.kind });
          // Network, auth, permission, unknown error halts cleanly
          // Retains activeStreamEntity and activeCursor untouched for retry
          const hasAnySuccess = totalPulled > 0;
          return {
            status: hasAnySuccess ? 'partial' : 'error',
            pulledCount: totalPulled,
            appliedCount: totalApplied,
            ignoredCount: totalIgnored,
            tombstonesApplied: totalTombstones,
            quarantinedCount: totalQuarantined,
            hasMore: true,
            batches: batchResults,
            errors,
          };
        }

        const records = cloudResult.records;
        entityPulled += records.length;
        remainingBudget -= records.length;

        if (records.length > 0) {
          const outcome = await this.reconcilePulledRecords(entityType, records, resolvedScope);
          entityApplied += outcome.applied;
          entityIgnored += outcome.ignored;
          entityTombstones += outcome.tombstones;
          entityQuarantined += outcome.quarantined;

          if (outcome.quarantinedErrors.length > 0) {
            errors.push(...outcome.quarantinedErrors);
          }

          const lastRec = records[records.length - 1];
          activeCursor = { updatedAt: lastRec.updated_at, id: lastRec.id };

          if (
            !highestSeenUpdatedAt ||
            new Date(lastRec.updated_at).getTime() > new Date(highestSeenUpdatedAt).getTime()
          ) {
            highestSeenUpdatedAt = lastRec.updated_at;
          }
        }

        // Genuine exhaustion check vs. pass cap
        if (records.length < pageLimit || !cloudResult.hasMore) {
          isStreamComplete = true;
          activeCursor = null;
        } else if (remainingBudget === 0) {
          // Pass cap reached; NOT genuine stream completion!
          passHasMore = true;
        }
      }

      totalPulled += entityPulled;
      totalApplied += entityApplied;
      totalIgnored += entityIgnored;
      totalTombstones += entityTombstones;
      totalQuarantined += entityQuarantined;

      batchResults.push({
        entityType,
        pulledCount: entityPulled,
        appliedCount: entityApplied,
        ignoredCount: entityIgnored,
        tombstonesApplied: entityTombstones,
        quarantinedCount: entityQuarantined,
      });

      if (isStreamComplete) {
        // Stream completed cleanly for this entity
        await syncMetadataStore.setWatermark(
          entityType,
          {
            lastCompletedWatermark: highestSeenUpdatedAt || watermark.lastCompletedWatermark,
            activeCursor: null,
            hasMore: false,
          },
          resolvedScope,
        );

        // Advance activeStreamEntity to next in queue
        const nextEntity = i + 1 < ENTITY_PULL_ORDER.length ? ENTITY_PULL_ORDER[i + 1] : null;
        await syncMetadataStore.setActiveStreamEntity(nextEntity, resolvedScope);
      } else {
        // Pass cap truncated stream
        await syncMetadataStore.setWatermark(
          entityType,
          {
            lastCompletedWatermark: watermark.lastCompletedWatermark, // Preserve prior watermark
            activeCursor, // Persist exact continuation cursor
            hasMore: true,
          },
          resolvedScope,
        );
        await syncMetadataStore.setActiveStreamEntity(entityType, resolvedScope);
        passHasMore = true;
        break; // Stop loop across entity types
      }
    }

    // Check if all entities have completed
    const finalActiveEntity = await syncMetadataStore.getActiveStreamEntity(resolvedScope);
    if (!finalActiveEntity) {
      passHasMore = false;
    }

    const hasErrors = errors.length > 0;
    const hasSuccess = totalPulled > 0 || totalApplied > 0;
    const status = hasErrors
      ? hasSuccess
        ? 'partial'
        : 'error'
      : passHasMore
      ? 'partial'
      : 'success';

    return {
      status,
      pulledCount: totalPulled,
      appliedCount: totalApplied,
      ignoredCount: totalIgnored,
      tombstonesApplied: totalTombstones,
      quarantinedCount: totalQuarantined,
      hasMore: passHasMore,
      batches: batchResults,
      errors,
    };
  }

  private async reconcilePulledRecords(
    entityType: SyncEntityType,
    records: any[],
    scope: UserScope,
  ): Promise<{
    applied: number;
    ignored: number;
    tombstones: number;
    quarantined: number;
    quarantinedErrors: { entityType: SyncEntityType; id?: string; message: string; kind: string }[];
  }> {
    switch (entityType) {
      case 'workout':
        return await this.reconcilePulledWorkouts(records as WorkoutCloudRecord[], scope);
      case 'template':
        return await this.reconcilePulledTemplates(records as TemplateCloudRecord[], scope);
      case 'custom_exercise':
        return await this.reconcilePulledCustomExercises(records as CustomExerciseCloudRecord[], scope);
    }
  }

  private async reconcilePulledWorkouts(
    records: WorkoutCloudRecord[],
    scope: UserScope,
  ): Promise<{
    applied: number;
    ignored: number;
    tombstones: number;
    quarantined: number;
    quarantinedErrors: { entityType: SyncEntityType; id?: string; message: string; kind: string }[];
  }> {
    let applied = 0;
    let ignored = 0;
    let tombstones = 0;
    let quarantined = 0;
    const quarantinedErrors: { entityType: SyncEntityType; id?: string; message: string; kind: string }[] = [];

    for (const row of records) {
      // 1. Validation check for malformed cloud row
      if (
        !row.id ||
        typeof row.id !== 'string' ||
        !row.started_at ||
        typeof row.started_at !== 'string' ||
        !row.client_updated_at ||
        typeof row.client_updated_at !== 'string' ||
        !Array.isArray(row.exercises)
      ) {
        await syncMetadataStore.setRecord(
          {
            entityType: 'workout',
            id: row.id || `unknown_${Date.now()}`,
            clientUpdatedAt: row.client_updated_at || new Date().toISOString(),
            deletedAt: row.deleted_at || null,
            syncStatus: 'error',
            lastSyncedServerUpdatedAt: row.updated_at,
          },
          scope,
        );
        quarantined++;
        quarantinedErrors.push({
          entityType: 'workout',
          id: row.id,
          message: `Malformed cloud workout record (${row.id || 'missing id'}).`,
          kind: 'validation',
        });
        continue;
      }

      const local = await workoutStorage.getCompletedWorkoutById(row.id, scope);
      const meta = await syncMetadataStore.getRecord('workout', row.id, scope);

      const cloudMs = new Date(row.client_updated_at).getTime();
      const localClientUpdatedAt =
        meta?.clientUpdatedAt || local?.finishedAt || local?.startedAt || '1970-01-01T00:00:00.000Z';
      const localMs = new Date(localClientUpdatedAt).getTime();
      const cloudIsTombstone = row.deleted_at !== null;
      const localIsTombstone = meta?.deletedAt !== null || meta?.syncStatus === 'pending_delete';

      if (cloudMs > localMs) {
        if (cloudIsTombstone) {
          await workoutStorage.deleteCompletedWorkout(row.id, scope);
          await syncMetadataStore.setRecord(
            {
              entityType: 'workout',
              id: row.id,
              clientUpdatedAt: row.client_updated_at,
              deletedAt: row.deleted_at,
              syncStatus: 'synced',
              lastSyncedServerUpdatedAt: row.updated_at,
            },
            scope,
          );
          tombstones++;
        } else {
          const session: WorkoutSession = {
            id: row.id,
            name: row.name,
            sourceTemplateId: row.source_template_id || undefined,
            startedAt: row.started_at,
            finishedAt: row.finished_at || row.started_at,
            status: 'completed',
            totalDuration: row.total_duration ?? 0,
            totalVolume: Number(row.total_volume ?? 0),
            completedSetsCount: row.completed_sets_count ?? 0,
            exercises: row.exercises || [],
            ownerId: scope.ownerId,
            ownerType: 'authenticated',
          };
          await workoutStorage.saveCompletedWorkout(session, scope);
          await syncMetadataStore.setRecord(
            {
              entityType: 'workout',
              id: row.id,
              clientUpdatedAt: row.client_updated_at,
              deletedAt: null,
              syncStatus: 'synced',
              lastSyncedServerUpdatedAt: row.updated_at,
            },
            scope,
          );
          applied++;
        }
      } else if (cloudMs < localMs) {
        // Stale cloud record: ignore, local wins
        ignored++;
      } else {
        // Equal timestamp tie-breaker
        if (cloudIsTombstone) {
          // Cloud tombstone wins tie
          await workoutStorage.deleteCompletedWorkout(row.id, scope);
          await syncMetadataStore.setRecord(
            {
              entityType: 'workout',
              id: row.id,
              clientUpdatedAt: row.client_updated_at,
              deletedAt: row.deleted_at,
              syncStatus: 'synced',
              lastSyncedServerUpdatedAt: row.updated_at,
            },
            scope,
          );
          tombstones++;
        } else if (localIsTombstone) {
          // Local tombstone wins tie (deletion cannot resurrect)
          ignored++;
        } else {
          // Both live on equal timestamp: cloud confirmed
          const session: WorkoutSession = {
            id: row.id,
            name: row.name,
            sourceTemplateId: row.source_template_id || undefined,
            startedAt: row.started_at,
            finishedAt: row.finished_at || row.started_at,
            status: 'completed',
            totalDuration: row.total_duration ?? 0,
            totalVolume: Number(row.total_volume ?? 0),
            completedSetsCount: row.completed_sets_count ?? 0,
            exercises: row.exercises || [],
            ownerId: scope.ownerId,
            ownerType: 'authenticated',
          };
          await workoutStorage.saveCompletedWorkout(session, scope);
          await syncMetadataStore.setRecord(
            {
              entityType: 'workout',
              id: row.id,
              clientUpdatedAt: row.client_updated_at,
              deletedAt: null,
              syncStatus: 'synced',
              lastSyncedServerUpdatedAt: row.updated_at,
            },
            scope,
          );
          applied++;
        }
      }
    }

    return { applied, ignored, tombstones, quarantined, quarantinedErrors };
  }

  private async reconcilePulledTemplates(
    records: TemplateCloudRecord[],
    scope: UserScope,
  ): Promise<{
    applied: number;
    ignored: number;
    tombstones: number;
    quarantined: number;
    quarantinedErrors: { entityType: SyncEntityType; id?: string; message: string; kind: string }[];
  }> {
    let applied = 0;
    let ignored = 0;
    let tombstones = 0;
    let quarantined = 0;
    const quarantinedErrors: { entityType: SyncEntityType; id?: string; message: string; kind: string }[] = [];

    for (const row of records) {
      // 1. Validation check
      const exercisesValid =
        Array.isArray(row.exercises) &&
        row.exercises.every(
          (ex: any) =>
            ex &&
            typeof ex.exerciseId === 'string' &&
            typeof ex.exerciseName === 'string' &&
            typeof ex.order === 'number',
        );

      if (
        !row.id ||
        typeof row.id !== 'string' ||
        !row.name ||
        typeof row.name !== 'string' ||
        !row.client_updated_at ||
        typeof row.client_updated_at !== 'string' ||
        (!row.deleted_at && !exercisesValid)
      ) {
        await syncMetadataStore.setRecord(
          {
            entityType: 'template',
            id: row.id || `unknown_${Date.now()}`,
            clientUpdatedAt: row.client_updated_at || new Date().toISOString(),
            deletedAt: row.deleted_at || null,
            syncStatus: 'error',
            lastSyncedServerUpdatedAt: row.updated_at,
          },
          scope,
        );
        quarantined++;
        quarantinedErrors.push({
          entityType: 'template',
          id: row.id,
          message: `Malformed cloud template record (${row.id || 'missing id'}).`,
          kind: 'validation',
        });
        continue;
      }

      const local = await templateStorage.getTemplateById(row.id, scope);
      const meta = await syncMetadataStore.getRecord('template', row.id, scope);

      const cloudMs = new Date(row.client_updated_at).getTime();
      const localClientUpdatedAt =
        meta?.clientUpdatedAt || local?.updatedAt || local?.createdAt || '1970-01-01T00:00:00.000Z';
      const localMs = new Date(localClientUpdatedAt).getTime();
      const cloudIsTombstone = row.deleted_at !== null;
      const localIsTombstone = meta?.deletedAt !== null || meta?.syncStatus === 'pending_delete';

      if (cloudMs > localMs) {
        if (cloudIsTombstone) {
          await templateStorage.deleteTemplate(row.id, scope);
          await syncMetadataStore.setRecord(
            {
              entityType: 'template',
              id: row.id,
              clientUpdatedAt: row.client_updated_at,
              deletedAt: row.deleted_at,
              syncStatus: 'synced',
              lastSyncedServerUpdatedAt: row.updated_at,
            },
            scope,
          );
          tombstones++;
        } else {
          const template: WorkoutTemplate = {
            id: row.id,
            name: row.name,
            exercises: (row.exercises || []).map((ex: any) => ({
              exerciseId: ex.exerciseId,
              exerciseName: ex.exerciseName,
              categoryName: ex.categoryName,
              order: ex.order ?? 0,
              sets: ex.sets ?? 1,
              targetReps: ex.targetReps ?? '10',
              restTime: ex.restTime ?? 60,
              targetWeight: ex.targetWeight,
            })),
            createdAt: row.created_at,
            updatedAt: row.client_updated_at,
            ownerId: scope.ownerId,
            ownerType: 'authenticated',
          };
          await templateStorage.saveTemplate(template, scope);
          await syncMetadataStore.setRecord(
            {
              entityType: 'template',
              id: row.id,
              clientUpdatedAt: row.client_updated_at,
              deletedAt: null,
              syncStatus: 'synced',
              lastSyncedServerUpdatedAt: row.updated_at,
            },
            scope,
          );
          applied++;
        }
      } else if (cloudMs < localMs) {
        ignored++;
      } else {
        if (cloudIsTombstone) {
          await templateStorage.deleteTemplate(row.id, scope);
          await syncMetadataStore.setRecord(
            {
              entityType: 'template',
              id: row.id,
              clientUpdatedAt: row.client_updated_at,
              deletedAt: row.deleted_at,
              syncStatus: 'synced',
              lastSyncedServerUpdatedAt: row.updated_at,
            },
            scope,
          );
          tombstones++;
        } else if (localIsTombstone) {
          ignored++;
        } else {
          const template: WorkoutTemplate = {
            id: row.id,
            name: row.name,
            exercises: (row.exercises || []).map((ex: any) => ({
              exerciseId: ex.exerciseId,
              exerciseName: ex.exerciseName,
              categoryName: ex.categoryName,
              order: ex.order ?? 0,
              sets: ex.sets ?? 1,
              targetReps: ex.targetReps ?? '10',
              restTime: ex.restTime ?? 60,
              targetWeight: ex.targetWeight,
            })),
            createdAt: row.created_at,
            updatedAt: row.client_updated_at,
            ownerId: scope.ownerId,
            ownerType: 'authenticated',
          };
          await templateStorage.saveTemplate(template, scope);
          await syncMetadataStore.setRecord(
            {
              entityType: 'template',
              id: row.id,
              clientUpdatedAt: row.client_updated_at,
              deletedAt: null,
              syncStatus: 'synced',
              lastSyncedServerUpdatedAt: row.updated_at,
            },
            scope,
          );
          applied++;
        }
      }
    }

    return { applied, ignored, tombstones, quarantined, quarantinedErrors };
  }

  private async reconcilePulledCustomExercises(
    records: CustomExerciseCloudRecord[],
    scope: UserScope,
  ): Promise<{
    applied: number;
    ignored: number;
    tombstones: number;
    quarantined: number;
    quarantinedErrors: { entityType: SyncEntityType; id?: string; message: string; kind: string }[];
  }> {
    let applied = 0;
    let ignored = 0;
    let tombstones = 0;
    let quarantined = 0;
    const quarantinedErrors: { entityType: SyncEntityType; id?: string; message: string; kind: string }[] = [];

    const localExercises = await customExerciseStorage.getCustomExercises(scope);
    const exerciseMap = new Map(localExercises.map((e) => [e.id, e]));

    for (const row of records) {
      if (
        !row.id ||
        typeof row.id !== 'string' ||
        !row.name ||
        typeof row.name !== 'string' ||
        !row.category ||
        typeof row.category !== 'string' ||
        !row.client_updated_at ||
        typeof row.client_updated_at !== 'string'
      ) {
        await syncMetadataStore.setRecord(
          {
            entityType: 'custom_exercise',
            id: row.id || `unknown_${Date.now()}`,
            clientUpdatedAt: row.client_updated_at || new Date().toISOString(),
            deletedAt: row.deleted_at || null,
            syncStatus: 'error',
            lastSyncedServerUpdatedAt: row.updated_at,
          },
          scope,
        );
        quarantined++;
        quarantinedErrors.push({
          entityType: 'custom_exercise',
          id: row.id,
          message: `Malformed cloud custom exercise record (${row.id || 'missing id'}).`,
          kind: 'validation',
        });
        continue;
      }

      const local = exerciseMap.get(row.id);
      const meta = await syncMetadataStore.getRecord('custom_exercise', row.id, scope);

      const cloudMs = new Date(row.client_updated_at).getTime();
      const localClientUpdatedAt =
        meta?.clientUpdatedAt || local?.updatedAt || local?.createdAt || '1970-01-01T00:00:00.000Z';
      const localMs = new Date(localClientUpdatedAt).getTime();
      const cloudIsTombstone = row.deleted_at !== null;
      const localIsTombstone = meta?.deletedAt !== null || meta?.syncStatus === 'pending_delete';

      if (cloudMs > localMs) {
        if (cloudIsTombstone) {
          await customExerciseStorage.deleteCustomExercise(row.id, scope);
          await syncMetadataStore.setRecord(
            {
              entityType: 'custom_exercise',
              id: row.id,
              clientUpdatedAt: row.client_updated_at,
              deletedAt: row.deleted_at,
              syncStatus: 'synced',
              lastSyncedServerUpdatedAt: row.updated_at,
            },
            scope,
          );
          tombstones++;
        } else {
          const exercise: Exercise = {
            id: row.id,
            name: row.name,
            description: row.description || '',
            category: row.category as any,
            categoryName: row.category_name || row.category,
            primaryMuscles: row.primary_muscles || [],
            secondaryMuscles: row.secondary_muscles || [],
            equipment: row.equipment || [],
            images: [],
            sourceProvider: 'custom',
            isCustom: true,
            createdAt: row.created_at,
            ownerId: scope.ownerId,
            ownerType: 'authenticated',
          };
          await customExerciseStorage.saveCustomExercise(exercise, scope);
          await syncMetadataStore.setRecord(
            {
              entityType: 'custom_exercise',
              id: row.id,
              clientUpdatedAt: row.client_updated_at,
              deletedAt: null,
              syncStatus: 'synced',
              lastSyncedServerUpdatedAt: row.updated_at,
            },
            scope,
          );
          applied++;
        }
      } else if (cloudMs < localMs) {
        ignored++;
      } else {
        if (cloudIsTombstone) {
          await customExerciseStorage.deleteCustomExercise(row.id, scope);
          await syncMetadataStore.setRecord(
            {
              entityType: 'custom_exercise',
              id: row.id,
              clientUpdatedAt: row.client_updated_at,
              deletedAt: row.deleted_at,
              syncStatus: 'synced',
              lastSyncedServerUpdatedAt: row.updated_at,
            },
            scope,
          );
          tombstones++;
        } else if (localIsTombstone) {
          ignored++;
        } else {
          const exercise: Exercise = {
            id: row.id,
            name: row.name,
            description: row.description || '',
            category: row.category as any,
            categoryName: row.category_name || row.category,
            primaryMuscles: row.primary_muscles || [],
            secondaryMuscles: row.secondary_muscles || [],
            equipment: row.equipment || [],
            images: [],
            sourceProvider: 'custom',
            isCustom: true,
            createdAt: row.created_at,
            ownerId: scope.ownerId,
            ownerType: 'authenticated',
          };
          await customExerciseStorage.saveCustomExercise(exercise, scope);
          await syncMetadataStore.setRecord(
            {
              entityType: 'custom_exercise',
              id: row.id,
              clientUpdatedAt: row.client_updated_at,
              deletedAt: null,
              syncStatus: 'synced',
              lastSyncedServerUpdatedAt: row.updated_at,
            },
            scope,
          );
          applied++;
        }
      }
    }

    return { applied, ignored, tombstones, quarantined, quarantinedErrors };
  }
}

export const syncEngine = new SyncEngine();
