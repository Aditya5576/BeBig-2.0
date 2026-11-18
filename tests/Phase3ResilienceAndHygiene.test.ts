/**
 * BeBig 2.0 — Phase 3 Storage Resilience, Input Bounds & Error Boundary Tests
 *
 * Verifies:
 * - AUD-016: Namespace-isolated in-memory exercise caches across user/guest transitions
 * - AUD-017: Native large-payload (>1800B) FileSystem spillover, readback, and cleanup
 * - AUD-018: Storage error classification, sanitized telemetry (zero PII), and web QuotaExceededError eviction+retry
 * - AUD-024: Canonical DOMAIN_LIMITS & clampText enforcement across text inputs
 * - AUD-026: Granular ErrorBoundary isolation in active workout, settings, weekly, and PR screens
 * - AUD-031: Zero explicit `any` casts in app/settings.tsx
 */

import React from 'react';
import { Platform } from 'react-native';
import { render, cleanup } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import {
  platformStorage,
  classifyStorageError,
  sanitizeStorageKeyNamespace,
  onStorageError,
  SECURESTORE_MAX_BYTES,
  LARGE_PAYLOAD_FILE_PREFIX,
  StorageErrorTelemetryEvent,
} from '../src/lib/storage/platformStorage';
import { DOMAIN_LIMITS, clampText } from '../src/constants/domainLimits';
import { ErrorBoundary } from '../src/components/ui/ErrorBoundary';
import {
  clearExerciseMemoryCache,
  customExerciseStorage,
  resolveExerciseScopeNamespace,
} from '../src/features/exercises/storage/customExerciseStorage';
import { exerciseCacheStorage } from '../src/features/exercises/storage/exerciseCacheStorage';
import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { useAuthStore } from '../src/features/auth/store/useAuthStore';
import type { AuthSession, UserScope } from '../src/features/auth/types';
import type { Exercise } from '../src/features/exercises/types';

jest.mock('../src/features/auth/services/authService', () => ({
  authService: {
    getCurrentSession: jest.fn(async () => null),
    onAuthStateChange: jest.fn(() => ({ unsubscribe: jest.fn() })),
    signOut: jest.fn(async () => {}),
  },
}));

jest.mock('../src/services/sync', () => ({
  syncMetadataStore: {
    markPendingUpload: jest.fn(async () => {}),
    markPendingDelete: jest.fn(async () => {}),
    getRecord: jest.fn(async () => null),
    removeRecord: jest.fn(async () => {}),
    resetUserState: jest.fn(async () => {}),
    clearMemoryCache: jest.fn(),
  },
  syncLifecycleManager: {
    triggerSync: jest.fn(async () => {}),
  },
}));

declare const require: any;
declare const __dirname: string;

const fs = require('fs');
const path = require('path');

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock-app-docs/',
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  makeDirectoryAsync: jest.fn(async () => {}),
  writeAsStringAsync: jest.fn(async () => {}),
  readAsStringAsync: jest.fn(async () => ''),
  deleteAsync: jest.fn(async () => {}),
}));

describe('Phase 3 — Storage Resilience, Input Bounds & Error Boundaries', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    platformStorage.clearMemoryCache();
    (Platform as any).OS = originalPlatform;
  });

  afterEach(async () => {
    (Platform as any).OS = originalPlatform;
    await cleanup();
  });

  // ============================================================================
  // AUD-017: Native Large-Payload Spillover (>1800B)
  // ============================================================================
  describe('AUD-017 — Native SecureStore >1800B FileSystem Spillover', () => {
    it('spills payloads >1800 bytes to FileSystem.documentDirectory and reads/removes them cleanly', async () => {
      (Platform as any).OS = 'ios';

      const secureStoreMap = new Map<string, string>();
      const fileMap = new Map<string, string>();

      (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (k: string, v: string) => {
        secureStoreMap.set(k, v);
      });
      (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (k: string) => {
        return secureStoreMap.get(k) ?? null;
      });
      (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (k: string) => {
        secureStoreMap.delete(k);
      });
      (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(async (p: string, v: string) => {
        fileMap.set(p, v);
      });
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async (p: string) => ({
        exists: fileMap.has(p) || p.endsWith('bebig_kv/'),
      }));
      (FileSystem.readAsStringAsync as jest.Mock).mockImplementation(async (p: string) => {
        return fileMap.get(p) ?? '';
      });
      (FileSystem.deleteAsync as jest.Mock).mockImplementation(async (p: string) => {
        fileMap.delete(p);
      });

      // Large workout history JSON (~4KB > 1800B)
      const largePayload = JSON.stringify({
        sessions: Array.from({ length: 40 }, (_, i) => ({
          id: `sess_${i}`,
          name: `Push Workout ${i}`,
          notes: 'Solid form and controlled eccentric tempo',
        })),
      });
      expect(largePayload.length).toBeGreaterThan(SECURESTORE_MAX_BYTES);

      const key = 'bebig.workout.sessions.user_abc';
      await platformStorage.setItem(key, largePayload);

      // SecureStore holds ONLY a compact file pointer (< 150 bytes), NOT the 4KB blob
      const storedPointer = secureStoreMap.get(key);
      expect(storedPointer).toBeDefined();
      expect(storedPointer!.startsWith(LARGE_PAYLOAD_FILE_PREFIX)).toBe(true);
      expect(storedPointer!.length).toBeLessThan(200);

      // Clear memory cache to force native readback through SecureStore pointer -> FileSystem
      platformStorage.clearMemoryCache();
      const restored = await platformStorage.getItem(key);
      expect(restored).toBe(largePayload);

      // Removing key cleans up BOTH the spilled file and SecureStore pointer
      await platformStorage.removeItem(key);
      expect(secureStoreMap.has(key)).toBe(false);
      expect(fileMap.size).toBe(0);
    });

    it('keeps small tokens (<= 1800B) directly inside SecureStore without FileSystem writes', async () => {
      (Platform as any).OS = 'android';

      const smallToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.small';
      await platformStorage.setItem('bebig.auth.token', smallToken);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('bebig.auth.token', smallToken);
      expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // AUD-018: Storage Fault Classification, Telemetry & Web Quota Recovery
  // ============================================================================
  describe('AUD-018 — Storage Error Classification, Sanitized Telemetry & Quota Recovery', () => {
    it('classifies quota, security, parse, unavailable, and unknown storage errors accurately', () => {
      const quotaErr = new Error('QuotaExceededError: storage quota exceeded');
      expect(classifyStorageError(quotaErr)).toBe('quota_exceeded');

      const secErr = new Error('SecurityError: access denied in private browsing');
      expect(classifyStorageError(secErr)).toBe('security_error');

      const parseErr = new SyntaxError('Unexpected token in JSON');
      expect(classifyStorageError(parseErr)).toBe('parse_error');

      const unavailErr = new Error('IndexedDB is not available');
      expect(classifyStorageError(unavailErr)).toBe('unavailable');

      expect(classifyStorageError(new Error('misc failure'))).toBe('unknown');
    });

    it('sanitizes key namespaces so user IDs and PII are never emitted in telemetry', () => {
      expect(sanitizeStorageKeyNamespace('bebig.workout.active.user_secret_uuid_123')).toBe(
        'bebig.workout.active'
      );
      expect(sanitizeStorageKeyNamespace('bebig.profile.usr_999')).toBe('bebig.profile.usr_999');
    });

    it('evicts rebuildable exercise cache and retries once on Web QuotaExceededError', async () => {
      (Platform as any).OS = 'web';
      const originalLocalStorage = (globalThis as any).localStorage;
      const events: StorageErrorTelemetryEvent[] = [];
      const unsubscribe = onStorageError((ev) => events.push(ev));

      const backing = new Map<string, string>([
        ['bebig.exercises.cache', '{"cached":true}'],
      ]);
      let failFirstWrite = true;

      (globalThis as any).localStorage = {
        getItem: (k: string) => backing.get(k) ?? null,
        setItem: (k: string, v: string) => {
          if (failFirstWrite) {
            failFirstWrite = false;
            const err: any = new Error('QuotaExceededError');
            err.name = 'QuotaExceededError';
            throw err;
          }
          backing.set(k, v);
        },
        removeItem: (k: string) => {
          backing.delete(k);
        },
      };

      try {
        await platformStorage.setItem('bebig.workout.active.usr_1', '{"id":"w_live"}');

        // Rebuildable cache evicted, active workout persisted on retry
        expect(backing.has('bebig.exercises.cache')).toBe(false);
        expect(backing.get('bebig.workout.active.usr_1')).toBe('{"id":"w_live"}');

        // Sanitized recovery telemetry emitted without user ID or workout payload
        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          operation: 'setItem',
          keyNamespace: 'bebig.workout.active',
          kind: 'quota_exceeded',
          recovered: true,
        });
      } finally {
        unsubscribe();
        (globalThis as any).localStorage = originalLocalStorage;
      }
    });
  });

  // ============================================================================
  // AUD-024: Canonical Domain Input Limits
  // ============================================================================
  describe('AUD-024 — Canonical Domain Input Limits & Clamping', () => {
    it('clamps oversized strings and strips null bytes without mutating valid text', () => {
      expect(clampText('Bench Press', DOMAIN_LIMITS.EXERCISE_NAME_MAX_LENGTH)).toBe('Bench Press');
      expect(clampText(null, 50)).toBe('');
      expect(clampText('Hello\0World', 50)).toBe('HelloWorld');

      const oversizedNote = 'A'.repeat(DOMAIN_LIMITS.SET_NOTES_MAX_LENGTH + 250);
      const clampedNote = clampText(oversizedNote, DOMAIN_LIMITS.SET_NOTES_MAX_LENGTH);
      expect(clampedNote.length).toBe(DOMAIN_LIMITS.SET_NOTES_MAX_LENGTH);
    });

    it('enforces maxLength caps across ActiveSetRow, CustomExerciseForm, Templates, and Settings', () => {
      const rootDir = path.resolve(__dirname, '..');
      const setRowSrc = fs.readFileSync(
        path.join(rootDir, 'src', 'features', 'workout', 'components', 'ActiveSetRow.tsx'),
        'utf8'
      );
      const customFormSrc = fs.readFileSync(
        path.join(rootDir, 'src', 'features', 'exercises', 'components', 'CustomExerciseForm.tsx'),
        'utf8'
      );
      const templateNewSrc = fs.readFileSync(
        path.join(rootDir, 'app', 'templates', 'new.tsx'),
        'utf8'
      );
      const settingsSrc = fs.readFileSync(path.join(rootDir, 'app', 'settings.tsx'), 'utf8');

      expect(setRowSrc).toContain('maxLength={DOMAIN_LIMITS.SET_NOTES_MAX_LENGTH}');
      expect(customFormSrc).toContain('maxLength={DOMAIN_LIMITS.EXERCISE_NAME_MAX_LENGTH}');
      expect(customFormSrc).toContain('maxLength={DOMAIN_LIMITS.EXERCISE_INSTRUCTIONS_MAX_LENGTH}');
      expect(templateNewSrc).toContain('maxLength={DOMAIN_LIMITS.TEMPLATE_NAME_MAX_LENGTH}');
      expect(settingsSrc).toContain('maxLength={DOMAIN_LIMITS.DISPLAY_NAME_MAX_LENGTH}');
      expect(settingsSrc).toContain('maxLength={DOMAIN_LIMITS.AVATAR_URL_MAX_LENGTH}');
    });
  });

  // ============================================================================
  // AUD-026: Granular ErrorBoundary Coverage
  // ============================================================================
  describe('AUD-026 — Granular Screen ErrorBoundary Protection', () => {
    it('isolates thrown render errors inside ErrorBoundary with retry button', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const CrashySubtree = () => {
        throw new Error('Corrupted persisted analytics state');
      };

      try {
        const { getByTestId, getByText } = await render(
          React.createElement(ErrorBoundary, {
            testID: 'phase3-boundary',
            fallbackTitle: 'Active workout display issue',
            fallbackMessage: 'Your workout progress is safely saved locally.',
            children: React.createElement(CrashySubtree),
          })
        );

        expect(getByTestId('phase3-boundary')).toBeTruthy();
        expect(getByText('Active workout display issue')).toBeTruthy();
        expect(getByTestId('phase3-boundary-retry-button')).toBeTruthy();
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it('wraps active workout, settings, weekly performance, and PR screens in ErrorBoundary', () => {
      const rootDir = path.resolve(__dirname, '..');
      const screens = [
        ['app/workout/active.tsx', 'active-workout-error-boundary'],
        ['app/settings.tsx', 'settings-error-boundary'],
        ['app/workout/progress/weekly.tsx', 'weekly-performance-error-boundary'],
        ['app/workout/progress/prs.tsx', 'prs-error-boundary'],
      ];

      for (const [relPath, testId] of screens) {
        const src = fs.readFileSync(path.join(rootDir, relPath), 'utf8');
        expect(src).toContain('<ErrorBoundary');
        expect(src).toContain(`testID="${testId}"`);
      }
    });
  });

  // ============================================================================
  // AUD-016: Namespace-Isolated In-Memory Caches Across User & Guest Transitions
  // ============================================================================
  describe('AUD-016 — Namespace-Isolated In-Memory Exercise Caches', () => {
    const makeSession = (userId: string): AuthSession => ({
      accessToken: `tok_${userId}`,
      refreshToken: `ref_${userId}`,
      user: {
        id: userId,
        email: `${userId}@example.com`,
        provider: 'email',
        createdAt: '2026-11-18T00:00:00.000Z',
        app_metadata: {},
        user_metadata: {},
      },
    });

    const makeCustomExercise = (id: string, name: string, scope: UserScope): Exercise => ({
      id,
      ownerId: scope.ownerId,
      ownerType: scope.ownerType,
      name,
      description: 'Private custom movement',
      category: 'chest',
      categoryName: 'Chest',
      primaryMuscles: [{ id: 'm1', name: 'Chest' }],
      secondaryMuscles: [],
      equipment: [{ id: 'eq1', name: 'Barbell' }],
      images: [],
      sourceProvider: 'custom',
      isCustom: true,
    });

    beforeEach(async () => {
      clearExerciseMemoryCache();
      await exerciseCacheStorage.clearCache();
      useAuthStore.setState({
        status: 'unauthenticated',
        user: null,
        session: null,
        guestSession: null,
        isGuest: false,
        error: null,
      });
    });

    afterEach(async () => {
      clearExerciseMemoryCache();
      await exerciseCacheStorage.clearCache();
      useAuthStore.setState({
        status: 'unauthenticated',
        user: null,
        session: null,
        guestSession: null,
        isGuest: false,
        error: null,
      });
    });

    it('clears and isolates in-memory custom exercises across userA -> signOut -> userB', async () => {
      const scopeA: UserScope = { ownerId: 'user_a_iso', ownerType: 'authenticated' };
      const scopeB: UserScope = { ownerId: 'user_b_iso', ownerType: 'authenticated' };
      const exA = makeCustomExercise('custom_user_a_press', 'User A Secret Press', scopeA);
      const exB = makeCustomExercise('custom_user_b_row', 'User B Secret Row', scopeB);

      // 1. User A signs in and populates persistent + volatile caches
      useAuthStore.getState().setSession(makeSession(scopeA.ownerId));
      expect(resolveExerciseScopeNamespace()).toBe('auth:user_a_iso');

      await customExerciseStorage.saveCustomExercise(exA, scopeA);
      await exerciseRepository.hydrate(scopeA);

      expect(exerciseRepository.getCachedExerciseByIdSync(exA.id)?.name).toBe('User A Secret Press');
      expect(exerciseRepository.getCachedExercises({ source: 'custom' }).map((e) => e.id)).toContain(exA.id);

      // 2. User A signs out -> volatile caches must be wiped synchronously
      await useAuthStore.getState().signOut();
      expect(resolveExerciseScopeNamespace()).toBe('guest');
      expect(exerciseRepository.getCachedExerciseByIdSync(exA.id)).toBeNull();
      expect(exerciseCacheStorage.getCustomExercisesSync()).toEqual([]);
      expect(exerciseRepository.getCachedExercises({ source: 'custom' })).toEqual([]);

      // 3. User B signs in -> must NEVER read User A's cached custom exercise
      useAuthStore.getState().setSession(makeSession(scopeB.ownerId));
      expect(resolveExerciseScopeNamespace()).toBe('auth:user_b_iso');
      expect(exerciseRepository.getCachedExerciseByIdSync(exA.id)).toBeNull();
      expect(exerciseRepository.getCachedExercises({ source: 'custom' })).toEqual([]);

      // User B creates/hydrates their own exercise cleanly isolated from User A
      await customExerciseStorage.saveCustomExercise(exB, scopeB);
      await exerciseRepository.hydrate(scopeB);
      expect(exerciseRepository.getCachedExerciseByIdSync(exB.id)?.name).toBe('User B Secret Row');
      expect(exerciseRepository.getCachedExerciseByIdSync(exA.id)).toBeNull();
      expect(exerciseRepository.getCachedExercises({ source: 'custom' }).map((e) => e.id)).toEqual([exB.id]);

      // Clean up test keys
      await customExerciseStorage.clearCustomExercises(scopeA);
      await customExerciseStorage.clearCustomExercises(scopeB);
    });

    it('isolates in-memory caches across guest -> userA transition and concurrent explicit scopes', async () => {
      // 1. Enter guest mode and cache a guest custom exercise
      await useAuthStore.getState().enterGuestMode();
      const guestSession = useAuthStore.getState().guestSession;
      expect(guestSession?.id).toBeTruthy();
      const guestScope: UserScope = { ownerId: guestSession!.id, ownerType: 'guest' };
      const guestEx = makeCustomExercise('custom_guest_squat', 'Guest Split Squat', guestScope);

      await customExerciseStorage.saveCustomExercise(guestEx, guestScope);
      await exerciseRepository.hydrate(guestScope);
      expect(exerciseRepository.getCachedExerciseByIdSync(guestEx.id)?.name).toBe('Guest Split Squat');

      // 2. Direct transition guest -> userA automatically clears volatile guest cache
      const scopeA: UserScope = { ownerId: 'user_a_from_guest', ownerType: 'authenticated' };
      useAuthStore.getState().setSession(makeSession(scopeA.ownerId));

      expect(resolveExerciseScopeNamespace()).toBe('auth:user_a_from_guest');
      expect(exerciseRepository.getCachedExerciseByIdSync(guestEx.id)).toBeNull();
      expect(exerciseRepository.getCachedExercises({ source: 'custom' })).toEqual([]);

      // 3. Explicit dual-namespace isolation even when both namespaces are loaded in memory
      const scopeB: UserScope = { ownerId: 'user_b_dual', ownerType: 'authenticated' };
      const exA = makeCustomExercise('custom_dual_a', 'Dual User A Press', scopeA);
      const exB = makeCustomExercise('custom_dual_b', 'Dual User B Curl', scopeB);
      exerciseCacheStorage.setCustomExercises([exA], scopeA);
      exerciseCacheStorage.setCustomExercises([exB], scopeB);

      expect(exerciseCacheStorage.getCachedExerciseByIdSync(exA.id, scopeA)?.id).toBe(exA.id);
      expect(exerciseCacheStorage.getCachedExerciseByIdSync(exA.id, scopeB)).toBeNull();
      expect(exerciseCacheStorage.searchCached({ source: 'custom' }, scopeB).map((e) => e.id)).toEqual([exB.id]);

      await customExerciseStorage.clearCustomExercises(guestScope);
    });
  });

  // ============================================================================
  // AUD-031: Strict Typing in app/settings.tsx (Zero Explicit `any` Casts)
  // ============================================================================
  describe('AUD-031 — Zero Explicit `any` Casts in Settings Screen', () => {
    it('contains no explicit `: any`, `as any`, or `<any>` casts in app/settings.tsx', () => {
      const rootDir = path.resolve(__dirname, '..');
      const settingsSrc = fs.readFileSync(path.join(rootDir, 'app', 'settings.tsx'), 'utf8');
      expect(settingsSrc).not.toMatch(/:\s*any\b/);
      expect(settingsSrc).not.toMatch(/\bas\s+any\b/);
      expect(settingsSrc).not.toMatch(/<\s*any\s*>/);
    });
  });
});
