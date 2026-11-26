/**
 * BeBig 2.0 — Safe PWA Update Coordinator
 *
 * Ensures an active workout is NEVER interrupted mid-edit by a service worker upgrade:
 * - ActiveWorkoutScreen registers its presence and a flush+revision-verify guard while mounted.
 * - PwaUpdateCard is suppressed while an active workout editor is mounted.
 * - Reload authorization is bound to `{ sessionId, revision, targetVersion, targetSha, workerScriptUrl }`
 *   and re-verified after flush succeeds and at `controllerchange` time.
 */

export interface WorkoutRevisionSnapshot {
  sessionId: string | null;
  revision: number;
}

export interface PwaReloadAuthorization {
  sessionId: string | null;
  revision: number;
  targetVersion: string;
  targetSha?: string;
  workerScriptUrl: string;
}

export interface PwaWorkerMetadata {
  version?: string;
  targetVersion?: string;
  sha?: string;
  targetSha?: string;
}

export interface PwaControllerCheckTarget {
  version?: string | null;
  targetVersion?: string | null;
  sha?: string | null;
  scriptUrl?: string | null;
}

export interface ActiveWorkoutUpdateGuard {
  flushAndReadSnapshot: () => Promise<WorkoutRevisionSnapshot | null>;
  verifyPersistedSnapshot: (expected: WorkoutRevisionSnapshot) => Promise<boolean>;
  verifyCurrentSnapshot: (expected: WorkoutRevisionSnapshot) => boolean;
}

type LegacyGuard = () => Promise<boolean>;

let activeWorkoutGuard: ActiveWorkoutUpdateGuard | null = null;
let authorizedReload: PwaReloadAuthorization | null = null;
const presenceListeners = new Set<(isActiveWorkoutOpen: boolean) => void>();

function notifyPresenceListeners() {
  const isOpen = activeWorkoutGuard !== null;
  for (const listener of presenceListeners) {
    try {
      listener(isOpen);
    } catch {
      // Listener errors should never break coordinator state
    }
  }
}

function normalizeGuard(guardOrLegacy: ActiveWorkoutUpdateGuard | LegacyGuard): ActiveWorkoutUpdateGuard {
  if (typeof guardOrLegacy === 'function') {
    return {
      flushAndReadSnapshot: async () => {
        const ok = await guardOrLegacy();
        return ok ? { sessionId: null, revision: 0 } : null;
      },
      verifyPersistedSnapshot: async () => true,
      verifyCurrentSnapshot: () => true,
    };
  }
  return guardOrLegacy;
}

export function isActiveWorkoutMounted(): boolean {
  return activeWorkoutGuard !== null;
}

export function subscribeActiveWorkoutPresence(
  listener: (isActiveWorkoutOpen: boolean) => void,
): () => void {
  presenceListeners.add(listener);
  return () => {
    presenceListeners.delete(listener);
  };
}

export function registerActiveWorkoutUpdateGuard(
  guard: ActiveWorkoutUpdateGuard | LegacyGuard,
): () => void {
  const normalized = normalizeGuard(guard);
  activeWorkoutGuard = normalized;
  notifyPresenceListeners();
  return () => {
    if (activeWorkoutGuard === normalized) {
      activeWorkoutGuard = null;
      notifyPresenceListeners();
    }
  };
}

export function getAuthorizedPwaReload(): PwaReloadAuthorization | null {
  return authorizedReload ? { ...authorizedReload } : null;
}

function buildTargetVersion(version?: string | null, sha?: string | null, fallback = ''): string {
  const cleanVer = String(version || '').trim();
  const cleanSha = String(sha || '').trim();
  if (cleanVer) {
    if (cleanSha && !cleanVer.includes(cleanSha)) {
      return `${cleanVer}-${cleanSha}`;
    }
    return cleanVer;
  }
  return cleanSha || fallback;
}

export function canReloadNow(
  controllerOrScriptUrl?: PwaControllerCheckTarget | string | null,
): boolean {
  if (!authorizedReload) return false;

  const target: PwaControllerCheckTarget =
    typeof controllerOrScriptUrl === 'string'
      ? { scriptUrl: controllerOrScriptUrl }
      : controllerOrScriptUrl || {};

  if (
    authorizedReload.workerScriptUrl &&
    target.scriptUrl &&
    authorizedReload.workerScriptUrl !== target.scriptUrl
  ) {
    return false;
  }

  if (
    authorizedReload.targetSha &&
    target.sha &&
    authorizedReload.targetSha !== target.sha
  ) {
    return false;
  }

  if (authorizedReload.targetVersion) {
    const incomingTargetVersion =
      target.targetVersion || buildTargetVersion(target.version, target.sha);
    if (incomingTargetVersion) {
      if (authorizedReload.targetSha && target.sha) {
        if (incomingTargetVersion !== authorizedReload.targetVersion) {
          return false;
        }
      } else {
        const expectedBase = authorizedReload.targetVersion.split('-')[0];
        const incomingBase = incomingTargetVersion.split('-')[0];
        if (expectedBase && incomingBase && expectedBase !== incomingBase) {
          return false;
        }
        if (
          incomingTargetVersion.includes('-') &&
          authorizedReload.targetVersion.includes('-') &&
          incomingTargetVersion !== authorizedReload.targetVersion
        ) {
          return false;
        }
      }
    }
  }

  if (activeWorkoutGuard) {
    return activeWorkoutGuard.verifyCurrentSnapshot({
      sessionId: authorizedReload.sessionId,
      revision: authorizedReload.revision,
    });
  }

  return true;
}

export function getPwaReloadReceiptKey(
  controllerOrScriptUrl?: PwaControllerCheckTarget | string | null,
): string {
  const target: PwaControllerCheckTarget =
    typeof controllerOrScriptUrl === 'string'
      ? { scriptUrl: controllerOrScriptUrl }
      : controllerOrScriptUrl || {};

  const targetBuildId =
    target.targetVersion ||
    buildTargetVersion(target.version, target.sha) ||
    authorizedReload?.targetVersion ||
    target.scriptUrl ||
    authorizedReload?.workerScriptUrl ||
    'unknown';

  const sanitized = String(targetBuildId).replace(/[^a-zA-Z0-9._-]/g, '_');
  return `bebig_sw_reloaded_${sanitized}`;
}

export function executeAuthorizedPwaReload(
  controllerOrScriptUrl?: PwaControllerCheckTarget | string | null,
  options?: {
    storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
    reloadFn?: (() => void) | null;
  },
): boolean {
  if (!canReloadNow(controllerOrScriptUrl)) {
    return false;
  }

  const receiptKey = getPwaReloadReceiptKey(controllerOrScriptUrl);
  const storage =
    options && 'storage' in options
      ? options.storage
      : typeof sessionStorage !== 'undefined'
        ? sessionStorage
        : null;
  const reloadFn =
    options && 'reloadFn' in options
      ? options.reloadFn
      : typeof window !== 'undefined' && typeof window.location?.reload === 'function'
        ? () => window.location.reload()
        : null;

  try {
    if (storage) {
      if (storage.getItem(receiptKey)) {
        return false;
      }
      storage.setItem(receiptKey, '1');
    }
    if (reloadFn) {
      reloadFn();
    }
    return true;
  } catch {
    return false;
  }
}

export function isPwaReloadAuthorized(
  controllerOrScriptUrl?: PwaControllerCheckTarget | string | null,
): boolean {
  return canReloadNow(controllerOrScriptUrl);
}

export function resetPwaReloadAuthorizationForTest(): void {
  authorizedReload = null;
  activeWorkoutGuard = null;
  notifyPresenceListeners();
}

export async function authorizeAndApplyPwaUpdate(
  waitingWorker: {
    postMessage: (msg: unknown) => void;
    scriptURL?: string;
    version?: string;
    sha?: string;
  } | null,
  metadata?: PwaWorkerMetadata,
): Promise<{ ok: boolean; error?: string; authorization?: PwaReloadAuthorization }> {
  if (!waitingWorker) {
    return { ok: false, error: 'No pending update worker found.' };
  }

  const workerScriptUrl = waitingWorker.scriptURL || '';
  const targetSha = String(metadata?.targetSha ?? metadata?.sha ?? waitingWorker.sha ?? '').trim();
  const targetVersion = buildTargetVersion(
    metadata?.targetVersion ?? metadata?.version ?? waitingWorker.version,
    targetSha,
    workerScriptUrl,
  );
  let boundSnapshot: WorkoutRevisionSnapshot = { sessionId: null, revision: 0 };

  if (activeWorkoutGuard) {
    try {
      const flushed = await activeWorkoutGuard.flushAndReadSnapshot();
      if (!flushed) {
        authorizedReload = null;
        return {
          ok: false,
          error: 'Could not verify active workout save before updating. Please try again.',
        };
      }

      const persistedMatch = await activeWorkoutGuard.verifyPersistedSnapshot(flushed);
      const currentMatch = activeWorkoutGuard.verifyCurrentSnapshot(flushed);
      if (!persistedMatch || !currentMatch) {
        authorizedReload = null;
        return {
          ok: false,
          error: 'Workout changed while preparing update. Please tap Update Now again.',
        };
      }

      boundSnapshot = flushed;
    } catch (err: any) {
      authorizedReload = null;
      return {
        ok: false,
        error: err?.message || 'Failed to save active workout before updating.',
      };
    }
  }

  authorizedReload = {
    sessionId: boundSnapshot.sessionId,
    revision: boundSnapshot.revision,
    targetVersion,
    targetSha: targetSha || undefined,
    workerScriptUrl,
  };
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  return { ok: true, authorization: { ...authorizedReload } };
}
