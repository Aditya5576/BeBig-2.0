/**
 * BeBig 2.0 — Full-App Route & Screen Health Smoke Suite
 *
 * Verifies every primary application screen mounts and renders cleanly without
 * throwing or hanging in BOTH:
 * 1. Guest / Offline mode
 * 2. Authenticated mode (including when remote M1-M3 Supabase tables are NOT yet migrated)
 *
 * Also verifies Supabase pre-migration resilience (`withSafeTimeout`,
 * `isMissingSchemaError`, and session-scoped missing-schema backoff).
 */

import React from 'react';
import { render, cleanup } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  const { Text } = require('react-native');
  return {
    useRouter: () => ({
      push: mockPush,
      replace: mockReplace,
      back: mockBack,
    }),
    usePathname: () => '/home',
    useSegments: () => ['home'],
    useLocalSearchParams: () => ({ id: 'seed-bench-press' }),
    useFocusEffect: (cb: () => void | (() => void)) => {
      ReactActual.useEffect(() => cb(), [cb]);
    },
    Slot: () =>
      ReactActual.createElement(Text, { testID: 'smoke-admin-slot' }, 'ADMIN_SLOT'),
    Redirect: ({ href }: { href: string }) =>
      ReactActual.createElement(Text, { testID: 'smoke-redirect' }, `REDIRECT:${href}`),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children, testID }: { children: React.ReactNode; testID?: string }) => {
    const ReactActual = require('react');
    const { View } = require('react-native');
    return ReactActual.createElement(View, { testID }, children);
  },
}));

jest.mock('../src/features/workout/services/workoutNotificationService', () => ({
  workoutNotificationService: {
    ensureNotificationChannel: jest.fn(async () => {}),
    getPermissionStatus: jest.fn(async () => 'denied'),
    requestPermissions: jest.fn(async () => false),
    scheduleRestTimerNotification: jest.fn(async () => null),
    cancelRestTimerNotification: jest.fn(async () => {}),
  },
}));

import { useAuthStore } from '../src/features/auth';
import { adminService, globalExerciseCatalogService } from '../src/features/admin';
import {
  isMissingSchemaError,
  isRemoteResourceBackedOff,
  markRemoteResourceMissing,
  resetRemoteResourceBackoffForTests,
  withSafeTimeout,
} from '../src/lib/supabase/resilience';
import { workoutRepository } from '../src/features/workout';
import { templateRepository } from '../src/features/templates';
import { exerciseRepository } from '../src/features/exercises';
import { profileService } from '../src/features/profile';

import HomeScreen from '../app/home';
import StartWorkoutScreen from '../app/workout/start';
import ActiveWorkoutScreen from '../app/workout/active';
import ExerciseListScreen from '../app/exercises/index';
import ExerciseDetailScreen from '../app/exercises/[id]';
import TemplatesListScreen from '../app/templates/index';
import WorkoutHistoryScreen from '../app/workout/history';
import WeeklyPerformanceScreen from '../app/workout/progress/weekly';
import PRsScreen from '../app/workout/progress/prs';
import SettingsScreen from '../app/settings';
import AdminLayout from '../app/admin/_layout';
import AdminDashboardScreen from '../app/admin/index';
import AdminMonitoringScreen from '../app/admin/monitoring';
import AdminTemplatesScreen from '../app/admin/templates';
import AdminExercisesScreen from '../app/admin/exercises';
import AdminAnalyticsScreen from '../app/admin/analytics';
import AdminCloudHealthScreen from '../app/admin/cloud-health';
import AdminCoachesScreen from '../app/admin/coaches';
import AdminAuditScreen from '../app/admin/audit';
import AdminDevToolsScreen from '../app/admin/dev-tools';
import AdminRolesScreen from '../app/admin/roles';
import AdminFeatureFlagsScreen from '../app/admin/feature-flags';
import AdminSettingsScreen from '../app/admin/settings';
import AdminFallbackRoute from '../app/admin/[...slug]';
import WelcomeScreen from '../app/onboarding/welcome';
import LoginScreen from '../app/onboarding/login';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function setupRepoMocksForSmoke() {
  jest.spyOn(workoutRepository, 'getCompletedWorkouts').mockResolvedValue([]);
  jest.spyOn(workoutRepository, 'getActiveWorkout').mockResolvedValue(null);
  jest.spyOn(templateRepository, 'getTemplates').mockResolvedValue([]);
  jest.spyOn(profileService, 'getProfile').mockResolvedValue(null);
  jest.spyOn(exerciseRepository.getProvider(), 'listExercises').mockResolvedValue({
    exercises: [],
    totalCount: 0,
    hasMore: false,
  });
}

describe('Full-App Route & Screen Health Smoke Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRemoteResourceBackoffForTests();
    globalExerciseCatalogService._resetForTests();
    setupRepoMocksForSmoke();
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  describe('1. Guest / Offline Mode — All Core Screens Mount Cleanly', () => {
    beforeEach(() => {
      useAuthStore.setState({
        status: 'guest',
        user: null,
        isGuest: true,
        guestSession: {
          id: 'guest_smoke_1',
          createdAt: '2026-11-18T10:00:00.000Z',
          lastActiveAt: '2026-11-18T10:00:00.000Z',
        },
        error: null,
      });
    });

    it('renders Home, Start Workout, Active Workout, Exercises, Templates, History, Progress, Settings, and Onboarding without throwing', async () => {
      const screens: { name: string; element: React.ReactElement }[] = [
        { name: 'HomeScreen', element: <HomeScreen /> },
        { name: 'StartWorkoutScreen', element: <StartWorkoutScreen /> },
        { name: 'ActiveWorkoutScreen', element: <ActiveWorkoutScreen /> },
        { name: 'ExerciseListScreen', element: <ExerciseListScreen /> },
        { name: 'TemplatesListScreen', element: <TemplatesListScreen /> },
        { name: 'WorkoutHistoryScreen', element: <WorkoutHistoryScreen /> },
        { name: 'WeeklyPerformanceScreen', element: <WeeklyPerformanceScreen /> },
        { name: 'PRsScreen', element: <PRsScreen /> },
        { name: 'SettingsScreen', element: <SettingsScreen /> },
        { name: 'WelcomeScreen', element: <WelcomeScreen /> },
        { name: 'LoginScreen', element: <LoginScreen /> },
      ];

      for (const { name, element } of screens) {
        const rendered = await render(element);
        expect(rendered.toJSON()).not.toBeNull();
        expect(name).toBeTruthy();
        await cleanup();
      }
    });

    it('blocks guests cleanly at AdminLayout with Access Restricted', async () => {
      const { getByTestId, queryByTestId } = await render(<AdminLayout />);
      expect(getByTestId('admin-access-restricted')).toBeTruthy();
      expect(queryByTestId('smoke-admin-slot')).toBeNull();
    });
  });

  describe('2. Authenticated Mode (Unmigrated Remote DB Simulation)', () => {
    beforeEach(() => {
      useAuthStore.setState({
        status: 'authenticated',
        user: { id: 'usr_smoke_auth_1', email: 'athlete@bebig.app', provider: 'email' },
        isGuest: false,
        guestSession: null,
        error: null,
      });

      // Simulate unmigrated M1-M3 remote failures gracefully
      jest.spyOn(adminService, 'getActiveAnnouncements').mockResolvedValue([]);
      jest.spyOn(adminService, 'getMyAssignedWorkouts').mockResolvedValue([]);
      jest.spyOn(globalExerciseCatalogService, 'getActiveGlobalExercises').mockResolvedValue([]);
      jest.spyOn(adminService, 'checkAdminAccess').mockResolvedValue({
        isAdmin: false,
        role: 'none',
      });
    });

    it('renders all primary athlete screens cleanly in authenticated mode', async () => {
      const screens: React.ReactElement[] = [
        <HomeScreen key="home" />,
        <StartWorkoutScreen key="start" />,
        <ActiveWorkoutScreen key="active" />,
        <ExerciseListScreen key="exercises" />,
        <ExerciseDetailScreen key="exercise-detail" />,
        <TemplatesListScreen key="templates" />,
        <WorkoutHistoryScreen key="history" />,
        <WeeklyPerformanceScreen key="weekly" />,
        <PRsScreen key="prs" />,
        <SettingsScreen key="settings" />,
      ];

      for (const screen of screens) {
        const rendered = await render(screen);
        expect(rendered.toJSON()).not.toBeNull();
        await cleanup();
      }
    });

    it('renders Admin Control Panel and live Monitoring / Templates / Exercises sub-routes cleanly for verified admins', async () => {
      jest.spyOn(adminService, 'checkAdminAccess').mockResolvedValue({
        isAdmin: true,
        role: 'admin',
      });
      jest.spyOn(adminService, 'getOverviewMetrics').mockResolvedValue({
        metrics: {
          total_users: null,
          workouts_today: null,
          workouts_this_week: null,
          total_completed_workouts: null,
          recent_errors_24h: 0,
          generated_at: '2026-11-18T16:00:00.000Z',
        },
        source: 'local_fallback',
        notice: 'Pending M1 migration',
      });
      jest.spyOn(adminService, 'getPwaHealthSnapshot').mockResolvedValue({
        appVersion: '2.4.4',
        displayVersion: 'v2.4.4 · dev',
        platform: 'web',
        userAgent: 'SmokeUA',
        serviceWorkerStatus: 'Not Registered',
        isOnline: true,
        checkedAt: '2026-11-18T16:00:00.000Z',
      });
      jest.spyOn(adminService, 'getErrorLogs').mockResolvedValue([]);
      jest.spyOn(adminService, 'getAnnouncements').mockResolvedValue([]);
      jest.spyOn(adminService, 'getUserDirectory').mockResolvedValue({
        users: [],
        source: 'local_fallback',
      });
      jest.spyOn(adminService, 'listTrainerTemplates').mockResolvedValue([]);
      jest.spyOn(adminService, 'listAssignedWorkouts').mockResolvedValue([]);
      jest.spyOn(adminService, 'listGlobalExercises').mockResolvedValue([]);

      const layoutRender = await render(<AdminLayout />);
      expect(await layoutRender.findByTestId('smoke-admin-slot')).toBeTruthy();
      expect(layoutRender.getAllByText('Overview & Health').length).toBeGreaterThan(0);
      expect(layoutRender.getAllByText('Diagnostics Terminal').length).toBeGreaterThan(0);
      expect(layoutRender.getAllByText('Announcements').length).toBeGreaterThan(0);
      expect(layoutRender.getAllByText('Users').length).toBeGreaterThan(0);
      expect(layoutRender.getAllByText('Trainer Templates').length).toBeGreaterThan(0);
      expect(layoutRender.getAllByText('Exercise Catalog').length).toBeGreaterThan(0);
      expect(layoutRender.queryByText('Feature Flags')).toBeNull();
      expect(layoutRender.queryByText('Developer Tools')).toBeNull();
      await cleanup();

      const adminRoutes: { element: React.ReactElement; expectedTestId: string }[] = [
        { element: <AdminDashboardScreen />, expectedTestId: 'admin-panel-overview' },
        { element: <AdminMonitoringScreen />, expectedTestId: 'admin-panel-diagnostics' },
        { element: <AdminTemplatesScreen />, expectedTestId: 'admin-panel-templates' },
        { element: <AdminExercisesScreen />, expectedTestId: 'admin-panel-catalog' },
        { element: <AdminAnalyticsScreen />, expectedTestId: 'admin-panel-overview' },
        { element: <AdminCloudHealthScreen />, expectedTestId: 'admin-panel-overview' },
        { element: <AdminCoachesScreen />, expectedTestId: 'admin-panel-templates' },
        { element: <AdminAuditScreen />, expectedTestId: 'admin-panel-diagnostics' },
        { element: <AdminDevToolsScreen />, expectedTestId: 'admin-panel-diagnostics' },
        { element: <AdminRolesScreen />, expectedTestId: 'admin-panel-users' },
        { element: <AdminFeatureFlagsScreen />, expectedTestId: 'smoke-redirect' },
        { element: <AdminSettingsScreen />, expectedTestId: 'smoke-redirect' },
        { element: <AdminFallbackRoute />, expectedTestId: 'smoke-redirect' },
      ];

      for (const route of adminRoutes) {
        const rendered = await render(route.element);
        expect(await rendered.findByTestId(route.expectedTestId)).toBeTruthy();
        expect(rendered.queryByText(/under construction/i)).toBeNull();
        await cleanup();
      }
    });

    it('guarantees zero active screens in app/ or src/ contain "under construction" copy', () => {
      const nodeFs = require('fs') as {
        readdirSync: (dir: string, opts: { withFileTypes: true }) => {
          name: string;
          isDirectory: () => boolean;
        }[];
        readFileSync: (p: string, enc: string) => string;
      };
      const nodePath = require('path') as {
        join: (...parts: string[]) => string;
        resolve: (...parts: string[]) => string;
      };

      const hits: string[] = [];
      const walk = (dir: string) => {
        for (const entry of nodeFs.readdirSync(dir, { withFileTypes: true })) {
          const full = nodePath.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name === 'coach') continue;
            walk(full);
          } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
            const content = nodeFs.readFileSync(full, 'utf8');
            if (/under construction/i.test(content)) {
              hits.push(full);
            }
          }
        }
      };

      walk(nodePath.resolve(process.cwd(), 'app'));
      walk(nodePath.resolve(process.cwd(), 'src'));
      expect(hits).toEqual([]);
    });
  });

  describe('3. Supabase Pre-Migration & Timeout Resilience Helpers', () => {
    it('detects PostgREST/Postgres missing schema errors and enforces session backoff', () => {
      expect(isMissingSchemaError({ code: 'PGRST205', message: 'Not in schema cache' })).toBe(true);
      expect(isMissingSchemaError({ code: '42703', message: 'column does not exist' })).toBe(true);
      expect(isMissingSchemaError({ status: 404 })).toBe(true);
      expect(isMissingSchemaError({ code: '23505', message: 'duplicate key' })).toBe(false);

      expect(isRemoteResourceBackedOff('table:app_announcements')).toBe(false);
      markRemoteResourceMissing('table:app_announcements');
      expect(isRemoteResourceBackedOff('table:app_announcements')).toBe(true);
    });

    it('resolves fallback cleanly when a remote promise exceeds timeout', async () => {
      const neverSettles = new Promise<string>(() => {});
      const result = await withSafeTimeout(neverSettles, 25, 'LOCAL_FALLBACK');
      expect(result).toBe('LOCAL_FALLBACK');
    });
  });
});
