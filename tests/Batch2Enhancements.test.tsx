import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { filterAndRankExercises } from '../src/features/exercises/utils/exerciseSearch';
import { Exercise } from '../src/features/exercises/types';
import {
  extractRecentExerciseReferences,
  formatRelativeRecentLabel,
} from '../src/features/workout/services/recentExercisesService';
import { WorkoutSession } from '../src/features/workout/types';
import { CURRENT_RELEASE_NOTES } from '../src/lib/releaseNotes/releaseNotesService';
import { PwaUpdateCard } from '../src/components/ui/PwaUpdateCard';
import {
  authorizeAndApplyPwaUpdate,
  canReloadNow,
  executeAuthorizedPwaReload,
  getAuthorizedPwaReload,
  getPwaReloadReceiptKey,
  isActiveWorkoutMounted,
  isPwaReloadAuthorized,
  registerActiveWorkoutUpdateGuard,
  resetPwaReloadAuthorizationForTest,
} from '../src/lib/pwa/pwaUpdateCoordinator';

function makeEx(id: string, name: string, category: any = 'arms'): Exercise {
  return {
    id,
    name,
    description: '',
    category,
    categoryName: category,
    primaryMuscles: [],
    secondaryMuscles: [],
    equipment: [],
    images: [],
    sourceProvider: 'system',
    sourceExerciseId: id,
    isCustom: false,
  };
}

describe('Batch 2 Enhancements — Fuzzy Search, 14-Day Recents & Versioned PWA Update', () => {
  describe('1. Fuzzy & Gym-Synonym Search', () => {
    const catalog: Exercise[] = [
      makeEx('ex_bc', 'Bicep Curl', 'arms'),
      makeEx('ex_dbc', 'Dumbbell Bicep Curl', 'arms'),
      makeEx('ex_rdl', 'Romanian Deadlift', 'legs'),
      makeEx('ex_ohp', 'Overhead Press', 'shoulders'),
      makeEx('ex_lat', 'Lat Pulldown', 'back'),
      makeEx('ex_tri', 'Tricep Pushdown', 'arms'),
      makeEx('ex_bench', 'Barbell Bench Press', 'chest'),
      { ...makeEx('seed-treadmill', 'Treadmill', 'cardio'), trackingMode: 'treadmill' },
    ];

    it('matches typos ("biseps", "bicp") and aliases ("curl bi", "db curl", "rdl", "ohp")', () => {
      const biseps = filterAndRankExercises(catalog, 'biseps');
      expect(biseps.map((e) => e.id)).toContain('ex_bc');
      expect(biseps[0].id).toBe('ex_bc');

      const bicp = filterAndRankExercises(catalog, 'bicp');
      expect(bicp[0].id).toBe('ex_bc');

      const curlBi = filterAndRankExercises(catalog, 'curl bi');
      expect(curlBi.slice(0, 2).map((e) => e.id)).toEqual(
        expect.arrayContaining(['ex_bc', 'ex_dbc']),
      );

      const dbCurl = filterAndRankExercises(catalog, 'db curl');
      expect(dbCurl[0].id).toBe('ex_dbc');

      const rdl = filterAndRankExercises(catalog, 'rdl');
      expect(rdl[0].id).toBe('ex_rdl');

      const ohp = filterAndRankExercises(catalog, 'ohp');
      expect(ohp[0].id).toBe('ex_ohp');

      const treadmill = filterAndRankExercises(catalog, 'tread');
      expect(treadmill[0].id).toBe('seed-treadmill');
    });
  });

  describe('2. Recent Exercises — Rolling 14-Day Window', () => {
    it('enforces 14-day window, requires completed workout + >=1 completed set, and formats labels', () => {
      const nowMs = Date.UTC(2026, 10, 25, 12, 0, 0);
      const dayMs = 24 * 60 * 60 * 1000;

      const workouts: WorkoutSession[] = [
        {
          id: 'w_recent_today',
          name: 'Today Cardio',
          status: 'completed',
          startedAt: new Date(nowMs - 3600_000).toISOString(),
          finishedAt: new Date(nowMs - 1800_000).toISOString(),
          exercises: [
            {
              exerciseId: 'seed-treadmill',
              exerciseName: 'Treadmill',
              order: 0,
              trackingMode: 'treadmill',
              actualSets: [
                { id: 's1', setNumber: 1, weight: 0, reps: 0, speedKph: 10, durationSeconds: 600, completed: true },
              ],
            },
            {
              exerciseId: 'ex_uncompleted',
              exerciseName: 'Skipped Fly',
              order: 1,
              actualSets: [
                { id: 's2', setNumber: 1, weight: 20, reps: 10, completed: false },
              ],
            },
          ],
        },
        {
          id: 'w_within_14',
          name: 'Two Days Ago',
          status: 'completed',
          startedAt: new Date(nowMs - 2 * dayMs).toISOString(),
          finishedAt: new Date(nowMs - 2 * dayMs).toISOString(),
          exercises: [
            {
              exerciseId: 'seed-bench-press',
              exerciseName: 'Barbell Bench Press',
              order: 0,
              actualSets: [
                { id: 's3', setNumber: 1, weight: 80, reps: 8, completed: true },
              ],
            },
          ],
        },
        {
          id: 'w_expired_15d',
          name: 'Old Session',
          status: 'completed',
          startedAt: new Date(nowMs - 15 * dayMs).toISOString(),
          finishedAt: new Date(nowMs - 15 * dayMs).toISOString(),
          exercises: [
            {
              exerciseId: 'ex_old',
              exerciseName: 'Old Squat',
              order: 0,
              actualSets: [
                { id: 's4', setNumber: 1, weight: 100, reps: 5, completed: true },
              ],
            },
          ],
        },
      ];

      const refs = extractRecentExerciseReferences(workouts, 10, { nowMs });
      expect(refs.map((r) => r.exerciseId)).toEqual(['seed-treadmill', 'seed-bench-press']);
      expect(refs[0].trackingMode).toBe('treadmill');
      expect(formatRelativeRecentLabel(refs[0].lastUsedAt, nowMs)).toBe('Today');
      expect(formatRelativeRecentLabel(refs[1].lastUsedAt, nowMs)).toBe('2d ago');
      expect(
        formatRelativeRecentLabel(new Date(nowMs - 8 * dayMs).toISOString(), nowMs),
      ).toBe('Last week');
    });
  });

  describe('3. Versioned PWA Update Card & Safe Active-Workout Reload', () => {
    beforeEach(() => {
      resetPwaReloadAuthorizationForTest();
    });

    it('includes v2.7.0 release notes and renders PwaUpdateCard actions', async () => {
      expect(CURRENT_RELEASE_NOTES['2.7.0']).toBeDefined();
      expect(CURRENT_RELEASE_NOTES['2.7.0'].highlights.length).toBeGreaterThan(0);

      const onUpdateNow = jest.fn();
      const onLater = jest.fn();
      const { getByTestId, getByText } = await render(
        <PwaUpdateCard
          visible={true}
          version="2.7.0"
          highlight="Treadmill mode & 0–4 RIR keypad."
          onUpdateNow={onUpdateNow}
          onLater={onLater}
        />,
      );

      expect(getByText('BeBig v2.7.0 is ready')).toBeTruthy();
      expect(getByText('Treadmill mode & 0–4 RIR keypad.')).toBeTruthy();

      fireEvent.press(getByTestId('pwa-update-later-button'));
      expect(onLater).toHaveBeenCalledTimes(1);

      fireEvent.press(getByTestId('pwa-update-now-button'));
      expect(onUpdateNow).toHaveBeenCalledTimes(1);
    });

    it('binds reload authorization to sessionId/revision/targetVersion, tracks active workout presence, and rejects concurrent edits', async () => {
      const postMessage = jest.fn();
      const worker = { postMessage, scriptURL: 'https://be-big-2-0.vercel.app/sw.js' };

      expect(isActiveWorkoutMounted()).toBe(false);

      // Concurrent edit bumps revision between flush and verify -> reload must abort
      let liveRevision = 4;
      const unregisterRace = registerActiveWorkoutUpdateGuard({
        flushAndReadSnapshot: async () => ({ sessionId: 'sess_1', revision: 4 }),
        verifyPersistedSnapshot: async (snap) => snap.revision === liveRevision,
        verifyCurrentSnapshot: (snap) => snap.revision === liveRevision,
      });
      expect(isActiveWorkoutMounted()).toBe(true);
      liveRevision = 5;
      const blocked = await authorizeAndApplyPwaUpdate(worker, { version: '2.7.0', sha: 'abc1234' });
      expect(blocked.ok).toBe(false);
      expect(isPwaReloadAuthorized({ scriptUrl: worker.scriptURL, version: '2.7.0', sha: 'abc1234' })).toBe(false);
      expect(postMessage).not.toHaveBeenCalled();
      unregisterRace();
      expect(isActiveWorkoutMounted()).toBe(false);

      // Verified matching revision authorizes reload bound to sessionId, revision, targetVersion, and scriptURL
      const unregisterOk = registerActiveWorkoutUpdateGuard({
        flushAndReadSnapshot: async () => ({ sessionId: 'sess_1', revision: 5 }),
        verifyPersistedSnapshot: async (snap) => snap.sessionId === 'sess_1' && snap.revision === 5,
        verifyCurrentSnapshot: (snap) => snap.sessionId === 'sess_1' && snap.revision === 5,
      });
      const allowed = await authorizeAndApplyPwaUpdate(worker, { version: '2.7.0', sha: 'abc1234' });
      expect(allowed.ok).toBe(true);
      expect(getAuthorizedPwaReload()).toEqual({
        sessionId: 'sess_1',
        revision: 5,
        targetVersion: '2.7.0-abc1234',
        targetSha: 'abc1234',
        workerScriptUrl: 'https://be-big-2-0.vercel.app/sw.js',
      });
      expect(
        canReloadNow({
          scriptUrl: 'https://be-big-2-0.vercel.app/sw.js',
          version: '2.7.0',
          sha: 'abc1234',
        }),
      ).toBe(true);
      // Mismatched version or SHA or scriptURL must be rejected even at controllerchange
      expect(
        canReloadNow({
          scriptUrl: 'https://be-big-2-0.vercel.app/sw.js',
          version: '2.7.0',
          sha: 'different99',
        }),
      ).toBe(false);
      expect(
        canReloadNow({
          scriptUrl: 'https://be-big-2-0.vercel.app/sw.js',
          version: '2.6.1',
          sha: 'abc1234',
        }),
      ).toBe(false);
      expect(isPwaReloadAuthorized('https://be-big-2-0.vercel.app/other-sw.js')).toBe(false);
      expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
      unregisterOk();
    });

    it('rejects a Home-authorized reload (authorizedSessionId === null) when a live active workout opens before controllerchange', async () => {
      const postMessage = jest.fn();
      const worker = { postMessage, scriptURL: 'https://be-big-2-0.vercel.app/sw.js' };

      // 1. User taps "Update Now" from Home (no active workout mounted -> authorizedSessionId === null)
      const homeAuth = await authorizeAndApplyPwaUpdate(worker, {
        version: '2.7.0',
        sha: 'deadbee',
      });
      expect(homeAuth.ok).toBe(true);
      expect(homeAuth.authorization?.sessionId).toBeNull();
      expect(homeAuth.authorization?.targetVersion).toBe('2.7.0-deadbee');

      // 2. Before controllerchange fires, user opens a live active workout
      let workoutCompleted = false;
      const unregisterLive = registerActiveWorkoutUpdateGuard({
        flushAndReadSnapshot: async () => ({ sessionId: 'sess_race', revision: 1 }),
        verifyPersistedSnapshot: async () => true,
        verifyCurrentSnapshot: (expected) => {
          if (!expected.sessionId) {
            return workoutCompleted;
          }
          return true;
        },
      });

      const controllerTarget = {
        scriptUrl: 'https://be-big-2-0.vercel.app/sw.js',
        version: '2.7.0',
        sha: 'deadbee',
      };

      // controllerchange fires mid-workout -> MUST reject while live workout is open
      expect(canReloadNow(controllerTarget)).toBe(false);

      // 3. Once the workout completes/saves/unmounts, deferred reload is now safe
      workoutCompleted = true;
      expect(canReloadNow(controllerTarget)).toBe(true);
      unregisterLive();
      expect(canReloadNow(controllerTarget)).toBe(true);
    });

    it('keys PWA reload receipt by target build SHA/version so two consecutive updates in the same tab both reload cleanly', async () => {
      const store = new Map<string, string>();
      const sessionStorageStub = {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
      };
      const reloadSpy = jest.fn();
      const postMessage = jest.fn();

      // Build 1 authorizes and reloads
      const worker1 = { postMessage, scriptURL: 'https://be-big-2-0.vercel.app/sw.js' };
      await authorizeAndApplyPwaUpdate(worker1, { version: '2.7.0', sha: 'build111' });
      const target1 = { scriptUrl: worker1.scriptURL, version: '2.7.0', sha: 'build111' };
      expect(getPwaReloadReceiptKey(target1)).toBe('bebig_sw_reloaded_2.7.0-build111');
      expect(
        executeAuthorizedPwaReload(target1, { storage: sessionStorageStub, reloadFn: reloadSpy }),
      ).toBe(true);
      expect(reloadSpy).toHaveBeenCalledTimes(1);

      // Re-firing controllerchange for the SAME build111 in the same tab MUST be blocked (loop prevention)
      expect(
        executeAuthorizedPwaReload(target1, { storage: sessionStorageStub, reloadFn: reloadSpy }),
      ).toBe(false);
      expect(reloadSpy).toHaveBeenCalledTimes(1);

      // Build 2 arrives later in the SAME tab (reusing sessionStorageStub) -> MUST reload cleanly!
      const worker2 = { postMessage, scriptURL: 'https://be-big-2-0.vercel.app/sw.js' };
      await authorizeAndApplyPwaUpdate(worker2, { version: '2.7.0', sha: 'build222' });
      const target2 = { scriptUrl: worker2.scriptURL, version: '2.7.0', sha: 'build222' };
      expect(getPwaReloadReceiptKey(target2)).toBe('bebig_sw_reloaded_2.7.0-build222');
      expect(
        executeAuthorizedPwaReload(target2, { storage: sessionStorageStub, reloadFn: reloadSpy }),
      ).toBe(true);
      expect(reloadSpy).toHaveBeenCalledTimes(2);
    });

    it('evaluates stamped sw.js CACHE_NAME to include version and git SHA without self-replacing sentinels', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodeFs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodePath = require('path');
      const publicSwPath = nodePath.resolve('public', 'sw.js');
      const rawSw: string = nodeFs.readFileSync(publicSwPath, 'utf8');

      // Raw template must not compare CACHE_VERSION against a raw sentinel literal that build-web replaces
      expect(rawSw).not.toMatch(/CACHE_VERSION\s*!==\s*'__BEBIG_CACHE_VERSION__'/);

      // Simulate build-web stamping identically to scripts/build-web.js
      const stampedSw = rawSw
        .replace(/__BEBIG_SW_VERSION__/g, '2.7.0')
        .replace(/__BEBIG_CACHE_VERSION__/g, '2.7.0-testsha')
        .replace(/__BEBIG_SW_SHA__/g, 'testsha')
        .replace(/__BEBIG_SW_HIGHLIGHT__/g, 'Treadmill & 0-4 RIR');

      expect(stampedSw).not.toMatch(/__BEBIG_[A-Z_]+__/);

      const evaluateHeader = (source: string) => {
        const headerOnly = source.split('// Minimal core static app-shell assets')[0];
        return new Function(
          `${headerOnly}\nreturn { SW_VERSION, CACHE_VERSION, SW_SHA, CACHE_NAME };`,
        )() as {
          SW_VERSION: string;
          CACHE_VERSION: string;
          SW_SHA: string;
          CACHE_NAME: string;
        };
      };

      const simulated = evaluateHeader(stampedSw);
      expect(simulated.CACHE_NAME).toBe('bebig-pwa-v2.7.0-testsha');

      // Also verify emitted dist/sw.js directly when already built locally
      const distSwPath = nodePath.resolve('dist', 'sw.js');
      if (nodeFs.existsSync(distSwPath)) {
        const distSw: string = nodeFs.readFileSync(distSwPath, 'utf8');
        expect(distSw).not.toMatch(/__BEBIG_[A-Z_]+__/);
        const emitted = evaluateHeader(distSw);
        expect(emitted.SW_VERSION).toBe('2.7.0');
        expect(emitted.CACHE_NAME).toMatch(/^bebig-pwa-v2\.7\.0-[a-z0-9]+$/i);
      }
    });
  });
});
