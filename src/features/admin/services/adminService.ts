/**
 * BeBig 2.0 — Admin Control Panel Service (Milestone 1)
 *
 * Provides fail-closed admin access verification, overview aggregate metrics
 * via `get_admin_overview_metrics()` RPC, merged local + remote diagnostics logs,
 * app announcements management, and live PWA runtime health inspection.
 */

import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import {
  isDeviceOffline,
  isMissingSchemaError,
  isRemoteResourceBackedOff,
  markRemoteResourceMissing,
  withSafeTimeout,
} from '../../../lib/supabase/resilience';
import { platformStorage } from '../../../lib/storage';
import { env } from '../../../config/env';
import {
  errorTelemetryService,
  ClientErrorLogEntry,
  DeviceDiagnosticsInfo,
  ErrorSeverity,
} from './errorTelemetryService';
import {
  globalExerciseCatalogService,
  GlobalExerciseRecord,
  SaveGlobalExerciseInput,
} from '../../exercises/services/globalExerciseCatalogService';

const DISMISSED_ANNOUNCEMENTS_KEY = 'bebig.home.dismissed_announcements';
const REMOTE_READ_TIMEOUT_MS = 2500;
const ANNOUNCEMENTS_TTL_MS = 60_000;
const PROFILES_IS_ADMIN_RESOURCE = 'col:profiles.is_admin';
const ASSIGNED_WORKOUTS_RESOURCE = 'table:assigned_workouts';
const ANNOUNCEMENTS_RESOURCE = 'table:app_announcements';

let cachedActiveAnnouncements: AppAnnouncement[] | null = null;
let lastAnnouncementsFetchAt = 0;

export type AdminAccessRole = 'super_admin' | 'admin' | 'none';

export interface AdminAccessResult {
  isAdmin: boolean;
  role: AdminAccessRole;
}

export interface AdminOverviewMetrics {
  total_users: number | null;
  workouts_today: number | null;
  workouts_this_week: number | null;
  total_completed_workouts: number | null;
  recent_errors_24h: number;
  generated_at: string;
}

export interface AdminOverviewResult {
  metrics: AdminOverviewMetrics;
  source: 'live' | 'local_fallback';
  notice?: string;
}

export type AnnouncementType = 'info' | 'release' | 'maintenance';

export interface AppAnnouncement {
  id: string;
  created_at: string;
  title: string;
  body: string;
  type: AnnouncementType;
  is_active: boolean;
  created_by: string | null;
  source?: 'remote' | 'local';
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  type: AnnouncementType;
  userId?: string | null;
}

export interface PwaHealthSnapshot {
  appVersion: string;
  displayVersion: string;
  platform: string;
  userAgent: string;
  serviceWorkerStatus: string;
  isOnline: boolean;
  checkedAt: string;
}

export interface AdminDirectoryUser {
  user_id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
  created_at: string;
  total_workouts: number;
  last_workout_at: string | null;
}

export interface AdminUserDirectoryResult {
  users: AdminDirectoryUser[];
  source: 'live' | 'local_fallback';
  notice?: string;
}

export interface TrainerExerciseSpec {
  exerciseId: string;
  exerciseName: string;
  categoryName: string;
  sets: number;
  targetReps: string;
  restTime: number;
}

export interface TrainerWorkoutTemplate {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  title: string;
  description: string;
  focus_tag: string;
  exercises: TrainerExerciseSpec[];
  source?: 'remote' | 'local';
}

export interface SaveTrainerTemplateInput {
  id?: string;
  title: string;
  description?: string;
  focus_tag?: string;
  exercises: TrainerExerciseSpec[];
  createdBy?: string | null;
}

export type AssignedWorkoutStatus = 'assigned' | 'started' | 'completed' | 'dismissed';

export interface AssignedWorkoutRecord {
  id: string;
  created_at: string;
  template_id: string | null;
  assigned_by: string | null;
  assignee_user_id: string;
  user_id?: string;
  title: string;
  trainer_note: string;
  exercises: TrainerExerciseSpec[];
  status: AssignedWorkoutStatus;
  completed_at: string | null;
  source?: 'remote' | 'local';
}

export interface AssignTemplateToUsersInput {
  templateId: string;
  userIds: string[];
  trainerNote?: string;
  assignedBy?: string | null;
}

const LOCAL_ANNOUNCEMENTS_KEY = 'bebig.admin.local_announcements';
const LOCAL_TRAINER_TEMPLATES_KEY = 'bebig.admin.local_trainer_templates';
const LOCAL_ASSIGNED_WORKOUTS_KEY = 'bebig.admin.local_assigned_workouts';

function isValidAssignedStatus(value: unknown): value is AssignedWorkoutStatus {
  return (
    value === 'assigned' ||
    value === 'started' ||
    value === 'completed' ||
    value === 'dismissed'
  );
}

/**
 * Strips any image/bitmap fields and normalizes exercise specs for JSONB persistence.
 */
export function sanitizeTrainerExercises(raw: unknown): TrainerExerciseSpec[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: TrainerExerciseSpec[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const rec = item as Record<string, unknown>;
    const exerciseId = typeof rec.exerciseId === 'string' ? rec.exerciseId.trim() : '';
    const exerciseName = typeof rec.exerciseName === 'string' ? rec.exerciseName.trim() : '';
    if (!exerciseId || !exerciseName) continue;
    const categoryName =
      typeof rec.categoryName === 'string' && rec.categoryName.trim()
        ? rec.categoryName.trim().slice(0, 64)
        : 'General';
    const rawSets = Number(rec.sets);
    const sets = Number.isFinite(rawSets) ? Math.min(Math.max(Math.round(rawSets), 1), 20) : 3;
    const targetReps =
      typeof rec.targetReps === 'string' && rec.targetReps.trim()
        ? rec.targetReps.trim().slice(0, 24)
        : '8-12';
    const rawRest = Number(rec.restTime);
    const restTime = Number.isFinite(rawRest)
      ? Math.min(Math.max(Math.round(rawRest), 15), 600)
      : 90;

    cleaned.push({
      exerciseId: exerciseId.slice(0, 128),
      exerciseName: exerciseName.slice(0, 140),
      categoryName,
      sets,
      targetReps,
      restTime,
    });
  }
  return cleaned.slice(0, 40);
}

async function readLocalTrainerTemplates(): Promise<TrainerWorkoutTemplate[]> {
  try {
    const raw = await platformStorage.getItem(LOCAL_TRAINER_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is TrainerWorkoutTemplate =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as TrainerWorkoutTemplate).id === 'string' &&
        typeof (item as TrainerWorkoutTemplate).title === 'string',
    );
  } catch {
    return [];
  }
}

async function writeLocalTrainerTemplates(items: TrainerWorkoutTemplate[]): Promise<void> {
  try {
    await platformStorage.setItem(LOCAL_TRAINER_TEMPLATES_KEY, JSON.stringify(items));
  } catch {
    // Non-fatal local persistence fallback
  }
}

async function readLocalAssignedWorkouts(): Promise<AssignedWorkoutRecord[]> {
  try {
    const raw = await platformStorage.getItem(LOCAL_ASSIGNED_WORKOUTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is AssignedWorkoutRecord =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as AssignedWorkoutRecord).id === 'string' &&
        typeof (item as AssignedWorkoutRecord).assignee_user_id === 'string',
    );
  } catch {
    return [];
  }
}

async function writeLocalAssignedWorkouts(items: AssignedWorkoutRecord[]): Promise<void> {
  try {
    await platformStorage.setItem(LOCAL_ASSIGNED_WORKOUTS_KEY, JSON.stringify(items));
  } catch {
    // Non-fatal local persistence fallback
  }
}

function isValidSeverity(value: unknown): value is ErrorSeverity {
  return value === 'crash' || value === 'error' || value === 'warning' || value === 'info';
}

function isValidAnnouncementType(value: unknown): value is AnnouncementType {
  return value === 'info' || value === 'release' || value === 'maintenance';
}

function normalizeRemoteDeviceInfo(raw: unknown): DeviceDiagnosticsInfo {
  if (typeof raw === 'object' && raw !== null) {
    const rec = raw as Record<string, unknown>;
    return {
      platform: typeof rec.platform === 'string' ? rec.platform : 'unknown',
      isWebKit: Boolean(rec.isWebKit),
      isIOS: Boolean(rec.isIOS),
      userAgent: typeof rec.userAgent === 'string' ? rec.userAgent : 'unknown',
      viewport: typeof rec.viewport === 'string' ? rec.viewport : undefined,
      online: typeof rec.online === 'boolean' ? rec.online : true,
    };
  }
  return {
    platform: 'unknown',
    isWebKit: false,
    isIOS: false,
    userAgent: 'unknown',
    online: true,
  };
}

async function readLocalAnnouncements(): Promise<AppAnnouncement[]> {
  try {
    const raw = await platformStorage.getItem(LOCAL_ANNOUNCEMENTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is AppAnnouncement =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as AppAnnouncement).id === 'string' &&
        typeof (item as AppAnnouncement).title === 'string',
    );
  } catch {
    return [];
  }
}

async function writeLocalAnnouncements(items: AppAnnouncement[]): Promise<void> {
  try {
    await platformStorage.setItem(LOCAL_ANNOUNCEMENTS_KEY, JSON.stringify(items));
  } catch {
    // Non-fatal local persistence fallback
  }
}

export const adminService = {
  /**
   * Verifies admin access strictly from Supabase DB (`profiles.is_admin` first,
   * then backwards-compatible `admin_roles` for `super_admin`/`admin`).
   * Always fails closed (`isAdmin: false`) on missing user, guest, or error.
   */
  async checkAdminAccess(userId: string | null | undefined): Promise<AdminAccessResult> {
    if (!userId || !isSupabaseConfigured() || isDeviceOffline()) {
      return { isAdmin: false, role: 'none' };
    }

    try {
      if (!isRemoteResourceBackedOff(PROFILES_IS_ADMIN_RESOURCE)) {
        const profileResp = await withSafeTimeout(
          supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', userId)
            .maybeSingle(),
          REMOTE_READ_TIMEOUT_MS,
          { data: null, error: null },
        );

        if (profileResp.error) {
          if (isMissingSchemaError(profileResp.error)) {
            markRemoteResourceMissing(PROFILES_IS_ADMIN_RESOURCE);
          }
        } else if (profileResp.data && profileResp.data.is_admin === true) {
          return { isAdmin: true, role: 'admin' };
        }
      }

      // Backwards compatibility with existing admin_roles table
      const roleResp = await withSafeTimeout(
        supabase
          .from('admin_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle(),
        REMOTE_READ_TIMEOUT_MS,
        { data: null, error: null },
      );

      if (!roleResp.error && roleResp.data) {
        const dbRole = roleResp.data.role;
        if (dbRole === 'super_admin' || dbRole === 'admin') {
          return { isAdmin: true, role: dbRole };
        }
      }

      return { isAdmin: false, role: 'none' };
    } catch {
      return { isAdmin: false, role: 'none' };
    }
  },

  /**
   * Fetches Overview aggregate KPIs via `get_admin_overview_metrics()` SECURITY DEFINER RPC.
   * Gracefully falls back to local error telemetry count when offline or before migration rollout.
   */
  async getOverviewMetrics(): Promise<AdminOverviewResult> {
    const localLogs = await errorTelemetryService.getLocalErrorLogs();
    const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
    const localErrors24h = localLogs.filter((entry) => {
      const ts = Date.parse(entry.created_at);
      return Number.isFinite(ts) && ts >= cutoffMs;
    }).length;

    if (!isSupabaseConfigured()) {
      return {
        metrics: {
          total_users: null,
          workouts_today: null,
          workouts_this_week: null,
          total_completed_workouts: null,
          recent_errors_24h: localErrors24h,
          generated_at: new Date().toISOString(),
        },
        source: 'local_fallback',
        notice: 'Supabase is not configured in this environment. Showing local diagnostics only.',
      };
    }

    try {
      const { data, error } = await supabase.rpc('get_admin_overview_metrics');
      if (error || !data || typeof data !== 'object') {
        return {
          metrics: {
            total_users: null,
            workouts_today: null,
            workouts_this_week: null,
            total_completed_workouts: null,
            recent_errors_24h: localErrors24h,
            generated_at: new Date().toISOString(),
          },
          source: 'local_fallback',
          notice: 'Live aggregate metrics require the M1 SQL migration (`get_admin_overview_metrics`). Showing local telemetry.',
        };
      }

      const payload = data as Record<string, unknown>;
      const toNum = (v: unknown): number => {
        const parsed = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(parsed) ? parsed : 0;
      };

      return {
        metrics: {
          total_users: toNum(payload.total_users),
          workouts_today: toNum(payload.workouts_today),
          workouts_this_week: toNum(payload.workouts_this_week),
          total_completed_workouts: toNum(payload.total_completed_workouts),
          recent_errors_24h: Math.max(toNum(payload.recent_errors_24h), localErrors24h),
          generated_at:
            typeof payload.generated_at === 'string'
              ? payload.generated_at
              : new Date().toISOString(),
        },
        source: 'live',
      };
    } catch {
      return {
        metrics: {
          total_users: null,
          workouts_today: null,
          workouts_this_week: null,
          total_completed_workouts: null,
          recent_errors_24h: localErrors24h,
          generated_at: new Date().toISOString(),
        },
        source: 'local_fallback',
        notice: 'Unable to reach Supabase metrics RPC right now. Showing local telemetry.',
      };
    }
  },

  /**
   * Lists merged error logs (remote `app_error_logs` + local ring buffer), newest first.
   */
  async getErrorLogs(): Promise<ClientErrorLogEntry[]> {
    const localLogs = await errorTelemetryService.getLocalErrorLogs();
    const remoteLogs: ClientErrorLogEntry[] = [];

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('app_error_logs')
          .select(
            'id, created_at, user_id, route, error_name, error_message, stack_trace, device_info, app_version, severity',
          )
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && Array.isArray(data)) {
          for (const row of data) {
            const rec = row as Record<string, unknown>;
            remoteLogs.push({
              id: String(rec.id ?? ''),
              created_at:
                typeof rec.created_at === 'string' ? rec.created_at : new Date().toISOString(),
              user_id: typeof rec.user_id === 'string' ? rec.user_id : null,
              route: typeof rec.route === 'string' ? rec.route : '/',
              error_name: typeof rec.error_name === 'string' ? rec.error_name : 'Error',
              error_message:
                typeof rec.error_message === 'string' ? rec.error_message : 'Unknown error',
              stack_trace: typeof rec.stack_trace === 'string' ? rec.stack_trace : null,
              device_info: normalizeRemoteDeviceInfo(rec.device_info),
              app_version: typeof rec.app_version === 'string' ? rec.app_version : 'unknown',
              severity: isValidSeverity(rec.severity) ? rec.severity : 'crash',
              source: 'remote',
            });
          }
        }
      } catch {
        // Fallback smoothly to local logs
      }
    }

    const merged = new Map<string, ClientErrorLogEntry>();
    for (const entry of remoteLogs) {
      merged.set(entry.id, entry);
    }
    for (const entry of localLogs) {
      if (!merged.has(entry.id)) {
        merged.set(entry.id, entry);
      }
    }

    return Array.from(merged.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  /**
   * Clears local ring buffer logs and deletes remote `app_error_logs` when available.
   */
  async clearErrorLogs(): Promise<void> {
    await errorTelemetryService.clearLocalErrorLogs();

    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('app_error_logs')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
      } catch {
        // Best-effort remote purge
      }
    }
  },

  /**
   * Lists announcements from Supabase `app_announcements` (falling back to local store).
   */
  async getAnnouncements(): Promise<AppAnnouncement[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('app_announcements')
          .select('id, created_at, title, body, type, is_active, created_by')
          .order('created_at', { ascending: false })
          .limit(30);

        if (!error && Array.isArray(data)) {
          return data.map((row) => {
            const rec = row as Record<string, unknown>;
            return {
              id: String(rec.id ?? ''),
              created_at:
                typeof rec.created_at === 'string' ? rec.created_at : new Date().toISOString(),
              title: typeof rec.title === 'string' ? rec.title : '',
              body: typeof rec.body === 'string' ? rec.body : '',
              type: isValidAnnouncementType(rec.type) ? rec.type : 'info',
              is_active: Boolean(rec.is_active),
              created_by: typeof rec.created_by === 'string' ? rec.created_by : null,
              source: 'remote' as const,
            };
          });
        }
      } catch {
        // Fall through to local fallback
      }
    }

    return readLocalAnnouncements();
  },

  /**
   * Creates a new announcement (persisted remotely when migrated, else locally).
   */
  async createAnnouncement(input: CreateAnnouncementInput): Promise<AppAnnouncement> {
    const trimmedTitle = input.title.trim().slice(0, 140);
    const trimmedBody = input.body.trim().slice(0, 1000);

    if (!trimmedTitle || !trimmedBody) {
      throw new Error('Title and message body are required.');
    }

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('app_announcements')
          .insert({
            title: trimmedTitle,
            body: trimmedBody,
            type: input.type,
            is_active: true,
            created_by: input.userId ?? null,
          })
          .select('id, created_at, title, body, type, is_active, created_by')
          .single();

        if (!error && data) {
          const rec = data as Record<string, unknown>;
          return {
            id: String(rec.id ?? ''),
            created_at:
              typeof rec.created_at === 'string' ? rec.created_at : new Date().toISOString(),
            title: typeof rec.title === 'string' ? rec.title : trimmedTitle,
            body: typeof rec.body === 'string' ? rec.body : trimmedBody,
            type: isValidAnnouncementType(rec.type) ? rec.type : input.type,
            is_active: Boolean(rec.is_active),
            created_by: typeof rec.created_by === 'string' ? rec.created_by : null,
            source: 'remote',
          };
        }
      } catch {
        // Fall through to local fallback
      }
    }

    const localItem: AppAnnouncement = {
      id: `local_ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
      title: trimmedTitle,
      body: trimmedBody,
      type: input.type,
      is_active: true,
      created_by: input.userId ?? null,
      source: 'local',
    };

    const existing = await readLocalAnnouncements();
    await writeLocalAnnouncements([localItem, ...existing].slice(0, 30));
    return localItem;
  },

  /**
   * Toggles an announcement's active flag live.
   */
  async toggleAnnouncementActive(id: string, nextActive: boolean): Promise<AppAnnouncement | null> {
    if (isSupabaseConfigured() && !id.startsWith('local_ann_')) {
      try {
        const { data, error } = await supabase
          .from('app_announcements')
          .update({ is_active: nextActive })
          .eq('id', id)
          .select('id, created_at, title, body, type, is_active, created_by')
          .single();

        if (!error && data) {
          const rec = data as Record<string, unknown>;
          return {
            id: String(rec.id ?? id),
            created_at:
              typeof rec.created_at === 'string' ? rec.created_at : new Date().toISOString(),
            title: typeof rec.title === 'string' ? rec.title : '',
            body: typeof rec.body === 'string' ? rec.body : '',
            type: isValidAnnouncementType(rec.type) ? rec.type : 'info',
            is_active: Boolean(rec.is_active),
            created_by: typeof rec.created_by === 'string' ? rec.created_by : null,
            source: 'remote',
          };
        }
      } catch {
        // Fall through to local update
      }
    }

    const existing = await readLocalAnnouncements();
    let updatedItem: AppAnnouncement | null = null;
    const nextList = existing.map((item) => {
      if (item.id === id) {
        updatedItem = { ...item, is_active: nextActive };
        return updatedItem;
      }
      return item;
    });
    if (updatedItem) {
      await writeLocalAnnouncements(nextList);
    }
    return updatedItem;
  },

  /**
   * Collects live PWA & runtime health diagnostics cleanly across web and native.
   */
  async getPwaHealthSnapshot(): Promise<PwaHealthSnapshot> {
    const isOnline =
      typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
        ? navigator.onLine
        : true;

    const userAgent =
      typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
        ? navigator.userAgent.slice(0, 140)
        : `React Native (${Platform.OS})`;

    let serviceWorkerStatus = Platform.OS === 'web' ? 'Unsupported' : 'Native Runtime';

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          serviceWorkerStatus = 'Not Registered';
        } else if (reg.active) {
          serviceWorkerStatus = reg.waiting ? 'Active (Update Waiting)' : 'Active';
        } else if (reg.installing) {
          serviceWorkerStatus = 'Installing';
        } else if (reg.waiting) {
          serviceWorkerStatus = 'Waiting Activation';
        } else {
          serviceWorkerStatus = 'Registered';
        }
      } catch {
        serviceWorkerStatus = 'Unavailable';
      }
    }

    return {
      appVersion: env.version,
      displayVersion: env.displayVersion,
      platform: Platform.OS,
      userAgent,
      serviceWorkerStatus,
      isOnline,
      checkedAt: new Date().toISOString(),
    };
  },

  /**
   * Queries sanitized user directory rows via `get_admin_user_directory` RPC.
   * Gracefully falls back when offline or before M2 SQL migration rollout.
   */
  async getUserDirectory(
    searchQuery: string = '',
    limit: number = 50,
  ): Promise<AdminUserDirectoryResult> {
    const trimmedSearch = searchQuery.trim();
    const safeLimit = Math.min(Math.max(Math.round(limit), 1), 200);

    if (!isSupabaseConfigured()) {
      return {
        users: [],
        source: 'local_fallback',
        notice: 'Supabase is not configured in this environment. User directory requires a live connection.',
      };
    }

    try {
      const { data, error } = await supabase.rpc('get_admin_user_directory', {
        p_search: trimmedSearch,
        p_limit: safeLimit,
      });

      if (error || !Array.isArray(data)) {
        return {
          users: [],
          source: 'local_fallback',
          notice: 'Live User Directory requires the M2 SQL migration (`get_admin_user_directory`).',
        };
      }

      const users: AdminDirectoryUser[] = data.map((row) => {
        const rec = row as Record<string, unknown>;
        const total = Number(rec.total_workouts);
        const emailStr = typeof rec.email === 'string' ? rec.email : '';
        const fallbackName =
          emailStr && emailStr.includes('@')
            ? emailStr.split('@')[0].charAt(0).toUpperCase() + emailStr.split('@')[0].slice(1)
            : 'Athlete';
        return {
          user_id: String(rec.user_id ?? ''),
          email: emailStr,
          full_name:
            typeof rec.full_name === 'string' && rec.full_name.trim()
              ? rec.full_name.trim()
              : fallbackName,
          is_admin: Boolean(rec.is_admin),
          created_at:
            typeof rec.created_at === 'string' ? rec.created_at : new Date().toISOString(),
          total_workouts: Number.isFinite(total) && total >= 0 ? total : 0,
          last_workout_at:
            typeof rec.last_workout_at === 'string' ? rec.last_workout_at : null,
        };
      });

      return {
        users,
        source: 'live',
      };
    } catch {
      return {
        users: [],
        source: 'local_fallback',
        notice: 'Unable to reach Supabase user directory right now.',
      };
    }
  },

  /**
   * Permanently deletes a non-admin athlete account via `admin_delete_user` RPC.
   * Gated by server-side is_current_user_admin() check and blocks self/admin deletion.
   */
  async deleteUserAccount(
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return { success: false, error: 'User ID is required.' };
    }

    if (!isSupabaseConfigured()) {
      return {
        success: false,
        error: 'Supabase is not configured. User deletion requires a live connection.',
      };
    }

    try {
      const { error } = await supabase.rpc('admin_delete_user', {
        p_target_user_id: userId.trim(),
      });

      if (error) {
        return {
          success: false,
          error: error.message || 'Failed to delete user account.',
        };
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Unexpected error deleting user account.',
      };
    }
  },

  /**
   * Lists reusable trainer workout templates (remote with local fallback).
   */
  async listTrainerTemplates(): Promise<TrainerWorkoutTemplate[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('trainer_workout_templates')
          .select('id, created_at, updated_at, created_by, title, description, focus_tag, exercises')
          .order('updated_at', { ascending: false })
          .limit(100);

        if (!error && Array.isArray(data)) {
          return data.map((row) => {
            const rec = row as Record<string, unknown>;
            return {
              id: String(rec.id ?? ''),
              created_at:
                typeof rec.created_at === 'string' ? rec.created_at : new Date().toISOString(),
              updated_at:
                typeof rec.updated_at === 'string' ? rec.updated_at : new Date().toISOString(),
              created_by: typeof rec.created_by === 'string' ? rec.created_by : null,
              title: typeof rec.title === 'string' ? rec.title : '',
              description: typeof rec.description === 'string' ? rec.description : '',
              focus_tag: typeof rec.focus_tag === 'string' ? rec.focus_tag : 'Full Body',
              exercises: sanitizeTrainerExercises(rec.exercises),
              source: 'remote' as const,
            };
          });
        }
      } catch {
        // Fall through to local fallback
      }
    }

    return readLocalTrainerTemplates();
  },

  /**
   * Creates or updates a reusable trainer workout template.
   * Strictly isolated from user `workout_templates`.
   */
  async saveTrainerTemplate(input: SaveTrainerTemplateInput): Promise<TrainerWorkoutTemplate> {
    const title = input.title.trim().slice(0, 140);
    const description = (input.description ?? '').trim().slice(0, 1000);
    const focusTag = (input.focus_tag ?? 'Full Body').trim().slice(0, 64) || 'Full Body';
    const exercises = sanitizeTrainerExercises(input.exercises);

    if (!title) {
      throw new Error('Template title is required.');
    }
    if (exercises.length === 0) {
      throw new Error('Add at least one exercise to the trainer template.');
    }

    const isUpdateRemote =
      Boolean(input.id) && !String(input.id).startsWith('local_tr_tpl_');

    if (isSupabaseConfigured() && (!input.id || isUpdateRemote)) {
      try {
        if (input.id && isUpdateRemote) {
          const { data, error } = await supabase
            .from('trainer_workout_templates')
            .update({
              title,
              description,
              focus_tag: focusTag,
              exercises,
            })
            .eq('id', input.id)
            .select('id, created_at, updated_at, created_by, title, description, focus_tag, exercises')
            .single();

          if (!error && data) {
            const rec = data as Record<string, unknown>;
            return {
              id: String(rec.id ?? input.id),
              created_at:
                typeof rec.created_at === 'string' ? rec.created_at : new Date().toISOString(),
              updated_at:
                typeof rec.updated_at === 'string' ? rec.updated_at : new Date().toISOString(),
              created_by: typeof rec.created_by === 'string' ? rec.created_by : null,
              title: typeof rec.title === 'string' ? rec.title : title,
              description: typeof rec.description === 'string' ? rec.description : description,
              focus_tag: typeof rec.focus_tag === 'string' ? rec.focus_tag : focusTag,
              exercises: sanitizeTrainerExercises(rec.exercises),
              source: 'remote',
            };
          }
        } else {
          const { data, error } = await supabase
            .from('trainer_workout_templates')
            .insert({
              title,
              description,
              focus_tag: focusTag,
              exercises,
              created_by: input.createdBy ?? null,
            })
            .select('id, created_at, updated_at, created_by, title, description, focus_tag, exercises')
            .single();

          if (!error && data) {
            const rec = data as Record<string, unknown>;
            return {
              id: String(rec.id ?? ''),
              created_at:
                typeof rec.created_at === 'string' ? rec.created_at : new Date().toISOString(),
              updated_at:
                typeof rec.updated_at === 'string' ? rec.updated_at : new Date().toISOString(),
              created_by: typeof rec.created_by === 'string' ? rec.created_by : null,
              title: typeof rec.title === 'string' ? rec.title : title,
              description: typeof rec.description === 'string' ? rec.description : description,
              focus_tag: typeof rec.focus_tag === 'string' ? rec.focus_tag : focusTag,
              exercises: sanitizeTrainerExercises(rec.exercises),
              source: 'remote',
            };
          }
        }
      } catch {
        // Fall through to local fallback
      }
    }

    const nowIso = new Date().toISOString();
    const existing = await readLocalTrainerTemplates();

    if (input.id) {
      let updated: TrainerWorkoutTemplate | null = null;
      const nextList = existing.map((tpl) => {
        if (tpl.id === input.id) {
          updated = {
            ...tpl,
            title,
            description,
            focus_tag: focusTag,
            exercises,
            updated_at: nowIso,
          };
          return updated;
        }
        return tpl;
      });
      if (updated) {
        await writeLocalTrainerTemplates(nextList);
        return updated;
      }
    }

    const createdLocal: TrainerWorkoutTemplate = {
      id: `local_tr_tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      created_at: nowIso,
      updated_at: nowIso,
      created_by: input.createdBy ?? null,
      title,
      description,
      focus_tag: focusTag,
      exercises,
      source: 'local',
    };

    await writeLocalTrainerTemplates([createdLocal, ...existing].slice(0, 100));
    return createdLocal;
  },

  /**
   * Deletes a trainer workout template (does NOT delete already-assigned workout snapshots).
   */
  async deleteTrainerTemplate(id: string): Promise<void> {
    if (isSupabaseConfigured() && !id.startsWith('local_tr_tpl_')) {
      try {
        await supabase.from('trainer_workout_templates').delete().eq('id', id);
      } catch {
        // Best-effort remote delete
      }
    }

    const existing = await readLocalTrainerTemplates();
    await writeLocalTrainerTemplates(existing.filter((tpl) => tpl.id !== id));
  },

  /**
   * Assigns a trainer workout template snapshot to one or more target athletes.
   * Writes ONLY to `assigned_workouts` (never touches personal workouts or active_workout).
   */
  async assignTemplateToUsers(
    input: AssignTemplateToUsersInput,
  ): Promise<AssignedWorkoutRecord[]> {
    const uniqueUserIds = Array.from(
      new Set(input.userIds.map((uid) => uid.trim()).filter((uid) => uid.length > 0)),
    );
    if (!input.templateId) {
      throw new Error('Select a trainer template before assigning.');
    }
    if (uniqueUserIds.length === 0) {
      throw new Error('Select at least one athlete to assign this workout.');
    }

    const templates = await this.listTrainerTemplates();
    const template = templates.find((tpl) => tpl.id === input.templateId);
    if (!template) {
      throw new Error('Selected trainer template could not be found.');
    }

    const trainerNote = (input.trainerNote ?? template.description ?? '').trim().slice(0, 1000);
    const exercisesSnapshot = sanitizeTrainerExercises(template.exercises);
    const canWriteRemote =
      isSupabaseConfigured() && !template.id.startsWith('local_tr_tpl_');

    if (canWriteRemote) {
      try {
        const rowsToInsert = uniqueUserIds.map((uid) => ({
          template_id: template.id,
          assigned_by: input.assignedBy ?? null,
          assignee_user_id: uid,
          title: template.title,
          trainer_note: trainerNote,
          exercises: exercisesSnapshot,
          status: 'assigned' as const,
        }));

        const { data, error } = await supabase
          .from('assigned_workouts')
          .insert(rowsToInsert)
          .select(
            'id, created_at, template_id, assigned_by, assignee_user_id, title, trainer_note, exercises, status, completed_at',
          );

        if (!error && Array.isArray(data)) {
          return data.map((row) => {
            const rec = row as Record<string, unknown>;
            return {
              id: String(rec.id ?? ''),
              created_at:
                typeof rec.created_at === 'string' ? rec.created_at : new Date().toISOString(),
              template_id: typeof rec.template_id === 'string' ? rec.template_id : template.id,
              assigned_by: typeof rec.assigned_by === 'string' ? rec.assigned_by : null,
              assignee_user_id: String(rec.assignee_user_id ?? rec.user_id ?? ''),
              user_id: String(rec.assignee_user_id ?? rec.user_id ?? ''),
              title: typeof rec.title === 'string' ? rec.title : template.title,
              trainer_note: typeof rec.trainer_note === 'string' ? rec.trainer_note : trainerNote,
              exercises: sanitizeTrainerExercises(rec.exercises),
              status: isValidAssignedStatus(rec.status) ? rec.status : 'assigned',
              completed_at: typeof rec.completed_at === 'string' ? rec.completed_at : null,
              source: 'remote' as const,
            };
          });
        }
      } catch {
        // Fall through to local fallback
      }
    }

    const nowIso = new Date().toISOString();
    const localRecords: AssignedWorkoutRecord[] = uniqueUserIds.map((uid, idx) => ({
      id: `local_assigned_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      created_at: nowIso,
      template_id: template.id,
      assigned_by: input.assignedBy ?? null,
      assignee_user_id: uid,
      user_id: uid,
      title: template.title,
      trainer_note: trainerNote,
      exercises: exercisesSnapshot,
      status: 'assigned',
      completed_at: null,
      source: 'local',
    }));

    const existing = await readLocalAssignedWorkouts();
    await writeLocalAssignedWorkouts([...localRecords, ...existing].slice(0, 200));
    return localRecords;
  },

  /**
   * Lists recent trainer workout assignments for admin review.
   */
  async listAssignedWorkouts(): Promise<AssignedWorkoutRecord[]> {
    const localRows = await readLocalAssignedWorkouts();
    const remoteRows: AssignedWorkoutRecord[] = [];

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('assigned_workouts')
          .select(
            'id, created_at, template_id, assigned_by, assignee_user_id, title, trainer_note, exercises, status, completed_at',
          )
          .order('created_at', { ascending: false })
          .limit(100);

        if (!error && Array.isArray(data)) {
          for (const row of data) {
            const rec = row as Record<string, unknown>;
            remoteRows.push({
              id: String(rec.id ?? ''),
              created_at:
                typeof rec.created_at === 'string' ? rec.created_at : new Date().toISOString(),
              template_id: typeof rec.template_id === 'string' ? rec.template_id : null,
              assigned_by: typeof rec.assigned_by === 'string' ? rec.assigned_by : null,
              assignee_user_id: String(rec.assignee_user_id ?? ''),
              title: typeof rec.title === 'string' ? rec.title : '',
              trainer_note: typeof rec.trainer_note === 'string' ? rec.trainer_note : '',
              exercises: sanitizeTrainerExercises(rec.exercises),
              status: isValidAssignedStatus(rec.status) ? rec.status : 'assigned',
              completed_at: typeof rec.completed_at === 'string' ? rec.completed_at : null,
              source: 'remote',
            });
          }
        }
      } catch {
        // Fallback to local rows
      }
    }

    const merged = new Map<string, AssignedWorkoutRecord>();
    for (const row of remoteRows) merged.set(row.id, row);
    for (const row of localRows) {
      if (!merged.has(row.id)) merged.set(row.id, row);
    }

    return Array.from(merged.values()).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
  },

  /**
   * Athlete-facing inbox query: returns active (`assigned` | `started`) workouts
   * assigned to the authenticated user. Returns `[]` immediately with zero network
   * calls when `userId` is null/empty (guests or unauthenticated visitors).
   */
  async getMyAssignedWorkouts(
    userId: string | null | undefined,
  ): Promise<AssignedWorkoutRecord[]> {
    if (!userId || !userId.trim()) {
      return [];
    }

    const trimmedUserId = userId.trim();
    const localMatches = (await readLocalAssignedWorkouts()).filter(
      (item) =>
        (item.assignee_user_id === trimmedUserId || (item as any).user_id === trimmedUserId) &&
        (item.status === 'assigned' || item.status === 'started'),
    );

    const remoteMatches: AssignedWorkoutRecord[] = [];
    if (
      isSupabaseConfigured() &&
      !isDeviceOffline() &&
      !isRemoteResourceBackedOff(ASSIGNED_WORKOUTS_RESOURCE)
    ) {
      try {
        const resp = await withSafeTimeout(
          supabase
            .from('assigned_workouts')
            .select(
              'id, created_at, template_id, assigned_by, assignee_user_id, title, trainer_note, exercises, status, completed_at',
            )
            .eq('assignee_user_id', trimmedUserId)
            .in('status', ['assigned', 'started'])
            .order('created_at', { ascending: false })
            .limit(25),
          REMOTE_READ_TIMEOUT_MS,
          { data: null, error: null },
        );

        if (resp.error) {
          if (isMissingSchemaError(resp.error)) {
            markRemoteResourceMissing(ASSIGNED_WORKOUTS_RESOURCE);
          }
        } else if (Array.isArray(resp.data)) {
          for (const row of resp.data) {
            const rec = row as Record<string, unknown>;
            remoteMatches.push({
              id: String(rec.id ?? ''),
              created_at:
                typeof rec.created_at === 'string' ? rec.created_at : new Date().toISOString(),
              template_id: typeof rec.template_id === 'string' ? rec.template_id : null,
              assigned_by: typeof rec.assigned_by === 'string' ? rec.assigned_by : null,
              assignee_user_id: String(rec.assignee_user_id ?? rec.user_id ?? trimmedUserId),
              user_id: String(rec.assignee_user_id ?? rec.user_id ?? trimmedUserId),
              title: typeof rec.title === 'string' ? rec.title : '',
              trainer_note: typeof rec.trainer_note === 'string' ? rec.trainer_note : '',
              exercises: sanitizeTrainerExercises(rec.exercises),
              status: isValidAssignedStatus(rec.status) ? rec.status : 'assigned',
              completed_at: typeof rec.completed_at === 'string' ? rec.completed_at : null,
              source: 'remote',
            });
          }
        }
      } catch {
        // Non-fatal: fall back to local matches cleanly
      }
    }

    const merged = new Map<string, AssignedWorkoutRecord>();
    for (const row of remoteMatches) merged.set(row.id, row);
    for (const row of localMatches) {
      if (!merged.has(row.id)) merged.set(row.id, row);
    }

    return Array.from(merged.values()).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
  },

  /**
   * Updates an assigned workout's lifecycle status (`started` | `completed` | `dismissed`).
   */
  async markAssignedWorkoutStatus(
    assignmentId: string,
    status: 'started' | 'completed' | 'dismissed',
  ): Promise<void> {
    if (!assignmentId) return;

    const completedAt = status === 'completed' ? new Date().toISOString() : null;

    if (isSupabaseConfigured() && !assignmentId.startsWith('local_assigned_')) {
      try {
        await supabase
          .from('assigned_workouts')
          .update({
            status,
            ...(status === 'completed' ? { completed_at: completedAt } : {}),
          })
          .eq('id', assignmentId);
      } catch {
        // Best-effort remote status update
      }
    }

    const existing = await readLocalAssignedWorkouts();
    let changed = false;
    const nextList = existing.map((item) => {
      if (item.id === assignmentId) {
        changed = true;
        return {
          ...item,
          status,
          completed_at: status === 'completed' ? completedAt : item.completed_at,
        };
      }
      return item;
    });

    if (changed) {
      await writeLocalAssignedWorkouts(nextList);
    }
  },

  /**
   * Lists all curated global exercises (active + hidden) for Admin Tab 6.
   */
  async listGlobalExercises(): Promise<GlobalExerciseRecord[]> {
    return globalExerciseCatalogService.listAllGlobalExercises();
  },

  /**
   * Creates or updates a text/metadata-only curated global exercise (zero bitmaps).
   */
  async saveGlobalExercise(input: SaveGlobalExerciseInput): Promise<GlobalExerciseRecord> {
    return globalExerciseCatalogService.saveGlobalExercise(input);
  },

  /**
   * Toggles a global exercise between Active and Hidden.
   */
  async toggleGlobalExerciseActive(
    id: string,
    isActive: boolean,
  ): Promise<GlobalExerciseRecord | null> {
    return globalExerciseCatalogService.toggleGlobalExerciseActive(id, isActive);
  },

  /**
   * Deletes a curated global exercise from the catalog.
   */
  async deleteGlobalExercise(id: string): Promise<void> {
    return globalExerciseCatalogService.deleteGlobalExercise(id);
  },

  /**
   * Athlete-facing query returning active announcements (`is_active = true`), newest first.
   * Falls back gracefully to local announcements when offline or pre-migration.
   */
  async getActiveAnnouncements(): Promise<AppAnnouncement[]> {
    const localActive = (await readLocalAnnouncements()).filter((a) => a.is_active);
    const now = Date.now();
    if (
      cachedActiveAnnouncements !== null &&
      now - lastAnnouncementsFetchAt < ANNOUNCEMENTS_TTL_MS &&
      localActive.length === 0
    ) {
      return [...cachedActiveAnnouncements];
    }

    const remoteActive: AppAnnouncement[] = [];

    if (
      isSupabaseConfigured() &&
      !isDeviceOffline() &&
      !isRemoteResourceBackedOff(ANNOUNCEMENTS_RESOURCE)
    ) {
      try {
        const resp = await withSafeTimeout(
          supabase
            .from('app_announcements')
            .select('id, created_at, title, body, type, is_active, created_by')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(10),
          REMOTE_READ_TIMEOUT_MS,
          { data: null, error: null },
        );

        if (resp.error) {
          if (isMissingSchemaError(resp.error)) {
            markRemoteResourceMissing(ANNOUNCEMENTS_RESOURCE);
          }
        } else if (Array.isArray(resp.data)) {
          lastAnnouncementsFetchAt = now;
          for (const row of resp.data) {
            const rec = row as Record<string, unknown>;
            remoteActive.push({
              id: String(rec.id ?? ''),
              created_at:
                typeof rec.created_at === 'string' ? rec.created_at : new Date().toISOString(),
              title: typeof rec.title === 'string' ? rec.title : '',
              body: typeof rec.body === 'string' ? rec.body : '',
              type: isValidAnnouncementType(rec.type) ? rec.type : 'info',
              is_active: true,
              created_by: typeof rec.created_by === 'string' ? rec.created_by : null,
              source: 'remote',
            });
          }
        }
      } catch {
        // Graceful offline/pre-migration fallback
      }
    }

    const merged = new Map<string, AppAnnouncement>();
    for (const row of remoteActive) merged.set(row.id, row);
    for (const row of localActive) {
      if (!merged.has(row.id)) merged.set(row.id, row);
    }

    const sorted = Array.from(merged.values()).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    cachedActiveAnnouncements = sorted;
    return sorted;
  },

  /**
   * Reads persisted dismissed announcement IDs for the Athlete Home banner.
   */
  async getDismissedAnnouncementIds(): Promise<string[]> {
    try {
      const raw = await platformStorage.getItem(DISMISSED_ANNOUNCEMENTS_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
    } catch {
      return [];
    }
  },

  /**
   * Persists dismissal of a specific announcement ID on this device (bounded to 50 IDs).
   */
  async dismissAnnouncement(announcementId: string): Promise<string[]> {
    if (!announcementId) return this.getDismissedAnnouncementIds();
    const existing = await this.getDismissedAnnouncementIds();
    const next = Array.from(new Set([announcementId, ...existing])).slice(0, 50);
    try {
      await platformStorage.setItem(DISMISSED_ANNOUNCEMENTS_KEY, JSON.stringify(next));
    } catch {
      // Non-fatal local persistence error
    }
    return next;
  },
};
