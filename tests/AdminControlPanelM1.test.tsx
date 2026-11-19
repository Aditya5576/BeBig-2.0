/**
 * BeBig 2.0 — Admin Control Panel Milestone 1 Verification Suite
 *
 * Verifies:
 * 1. RBAC Route Guard (`app/admin/_layout.tsx`):
 *    - Unauthenticated users redirect to `/onboarding/welcome`
 *    - Guest users and non-admin users are blocked by `Access Restricted` (never renders `<Slot />`)
 *    - Admin users (`isAdmin === true`) access the control panel layout
 * 2. Settings Admin Entry Gating (`app/settings.tsx`):
 *    - Hidden for guests and non-admin users
 *    - Visible for admin users (`isAdmin === true`) and routes to `/admin`
 * 3. Admin 3-Tab Dashboard (`app/admin/index.tsx`):
 *    - Overview KPI cards + Live PWA Health card
 *    - Diagnostics Terminal severity filtering, expandable stack traces, and Clear Logs
 *    - Announcements creation, Active Banner Preview, and live Active/Paused toggle
 * 4. Sanitized Error Telemetry & ErrorBoundary Integration:
 *    - Redacts JWTs, Bearer tokens, API keys, and email PII
 *    - Enforces bounded 50-entry local ring buffer
 *    - `ErrorBoundary` forwards caught render crashes into `errorTelemetryService`
 * 5. Local SQL Migration Safety Verification (`20261118_admin_panel_m1.sql`):
 *    - Anti-escalation trigger on `profiles.is_admin`, strict RLS, and SECURITY DEFINER RPC
 */

import React from 'react';
import { render, fireEvent, waitFor, cleanup, act } from '@testing-library/react-native';

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
    usePathname: () => '/admin',
    Slot: () =>
      ReactActual.createElement(Text, { testID: 'admin-slot-content' }, 'ADMIN_SLOT_RENDERED'),
    Redirect: ({ href }: { href: string }) =>
      ReactActual.createElement(Text, { testID: 'admin-redirect' }, `REDIRECT:${href}`),
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
    getPermissionStatus: jest.fn(async () => 'denied'),
    requestPermissions: jest.fn(async () => false),
    scheduleRestTimerNotification: jest.fn(async () => null),
  },
}));

import { useAuthStore } from '../src/features/auth';
import {
  adminService,
  errorTelemetryService,
  sanitizeErrorText,
  ERROR_RING_BUFFER_MAX,
  ClientErrorLogEntry,
  AppAnnouncement,
} from '../src/features/admin';
import { ErrorBoundary } from '../src/components/ui/ErrorBoundary';
import AdminLayout from '../app/admin/_layout';
import AdminDashboardScreen from '../app/admin/index';
import SettingsScreen from '../app/settings';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const SAMPLE_LOGS: ClientErrorLogEntry[] = [
  {
    id: 'err_crash_1',
    created_at: '2026-11-18T14:30:00.000Z',
    user_id: null,
    route: '/workout/active',
    error_name: 'TypeError',
    error_message: 'Cannot read properties of undefined (reading sets)',
    stack_trace: 'TypeError: Cannot read properties of undefined\n  at ActiveExerciseCard.tsx:142:12',
    device_info: {
      platform: 'web',
      isWebKit: true,
      isIOS: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
      viewport: '390x844',
      online: true,
    },
    app_version: '2.4.4',
    severity: 'crash',
    source: 'local',
  },
  {
    id: 'err_warn_2',
    created_at: '2026-11-18T14:25:00.000Z',
    user_id: null,
    route: '/home',
    error_name: 'SyncWarning',
    error_message: 'Deferred background sync while offline',
    stack_trace: null,
    device_info: {
      platform: 'web',
      isWebKit: false,
      isIOS: false,
      userAgent: 'Mozilla/5.0 Chrome/130.0',
      viewport: '1440x900',
      online: false,
    },
    app_version: '2.4.4',
    severity: 'warning',
    source: 'local',
  },
];

describe('Admin Control Panel — Milestone 1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    errorTelemetryService._resetForTests();
    useAuthStore.setState({
      status: 'unauthenticated',
      user: null,
      isGuest: false,
      guestSession: null,
      error: null,
    });
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  describe('1. RBAC Route Guard (app/admin/_layout.tsx)', () => {
    it('redirects unauthenticated users to /onboarding/welcome and never renders admin slot', async () => {
      useAuthStore.setState({
        status: 'unauthenticated',
        user: null,
        isGuest: false,
      });

      const { getByTestId, queryByTestId } = await render(<AdminLayout />);
      expect(getByTestId('admin-redirect').props.children).toBe('REDIRECT:/onboarding/welcome');
      expect(queryByTestId('admin-slot-content')).toBeNull();
    });

    it('blocks guest users with Access Restricted screen and Return Home action', async () => {
      const checkSpy = jest.spyOn(adminService, 'checkAdminAccess');
      useAuthStore.setState({
        status: 'guest',
        user: null,
        isGuest: true,
      });

      const { getByTestId, getByText, queryByTestId } = await render(<AdminLayout />);
      expect(getByTestId('admin-access-restricted')).toBeTruthy();
      expect(getByText('Access Restricted')).toBeTruthy();
      expect(queryByTestId('admin-slot-content')).toBeNull();
      expect(checkSpy).not.toHaveBeenCalled();

      await act(async () => {
        fireEvent.press(getByTestId('admin-return-home-button'));
      });
      expect(mockReplace).toHaveBeenCalledWith('/home');
    });

    it('blocks non-admin authenticated users (isAdmin === false)', async () => {
      jest.spyOn(adminService, 'checkAdminAccess').mockResolvedValue({
        isAdmin: false,
        role: 'none',
      });

      useAuthStore.setState({
        status: 'authenticated',
        user: { id: 'user_regular_1', email: 'athlete@bebig.app', provider: 'email' },
        isGuest: false,
      });

      const { findByTestId, queryByTestId } = await render(<AdminLayout />);
      expect(await findByTestId('admin-access-restricted')).toBeTruthy();
      expect(queryByTestId('admin-slot-content')).toBeNull();
    });

    it('allows verified admin users (isAdmin === true) to access the admin layout', async () => {
      jest.spyOn(adminService, 'checkAdminAccess').mockResolvedValue({
        isAdmin: true,
        role: 'admin',
      });

      useAuthStore.setState({
        status: 'authenticated',
        user: { id: 'user_admin_1', email: 'admin@bebig.app', provider: 'email' },
        isGuest: false,
      });

      const { findByTestId, queryByTestId } = await render(<AdminLayout />);
      expect(await findByTestId('admin-slot-content')).toBeTruthy();
      expect(queryByTestId('admin-access-restricted')).toBeNull();
    });
  });

  describe('2. Settings Screen Admin Entry Button Gating', () => {
    it('never renders the Admin Control Panel button for guest users', async () => {
      useAuthStore.setState({
        status: 'guest',
        user: null,
        isGuest: true,
      });

      const { queryByTestId } = await render(<SettingsScreen />);
      await waitFor(() => {
        expect(queryByTestId('settings-account-card')).toBeTruthy();
      });
      expect(queryByTestId('settings-admin-panel-button')).toBeNull();
    });

    it('never renders the Admin Control Panel button for non-admin authenticated users', async () => {
      jest.spyOn(adminService, 'checkAdminAccess').mockResolvedValue({
        isAdmin: false,
        role: 'none',
      });

      useAuthStore.setState({
        status: 'authenticated',
        user: { id: 'user_regular_2', email: 'regular@bebig.app', provider: 'email' },
        isGuest: false,
      });

      const { queryByTestId } = await render(<SettingsScreen />);
      await waitFor(() => {
        expect(queryByTestId('settings-account-card')).toBeTruthy();
      });
      expect(queryByTestId('settings-admin-panel-button')).toBeNull();
    });

    it('renders the Admin Control Panel button for admin users and navigates to /admin', async () => {
      jest.spyOn(adminService, 'checkAdminAccess').mockResolvedValue({
        isAdmin: true,
        role: 'admin',
      });

      useAuthStore.setState({
        status: 'authenticated',
        user: { id: 'user_admin_2', email: 'admin@bebig.app', provider: 'email' },
        isGuest: false,
      });

      const { findByTestId } = await render(<SettingsScreen />);
      const adminBtn = await findByTestId('settings-admin-panel-button');
      expect(adminBtn).toBeTruthy();

      await act(async () => {
        fireEvent.press(adminBtn);
      });
      expect(mockPush).toHaveBeenCalledWith('/admin');
    });
  });

  describe('3. Admin Control Panel 3-Tab Dashboard (app/admin/index.tsx)', () => {
    it('renders Overview KPIs, Diagnostics expandable stack traces + clear, and Announcements create + toggle', async () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: { id: 'user_admin_3', email: 'admin@bebig.app', provider: 'email' },
        isGuest: false,
      });

      jest.spyOn(adminService, 'getOverviewMetrics').mockResolvedValue({
        metrics: {
          total_users: 428,
          workouts_today: 19,
          workouts_this_week: 134,
          total_completed_workouts: 3890,
          recent_errors_24h: 2,
          generated_at: '2026-11-18T14:35:00.000Z',
        },
        source: 'live',
      });

      jest.spyOn(adminService, 'getPwaHealthSnapshot').mockResolvedValue({
        appVersion: '2.4.4',
        displayVersion: 'v2.4.4 · prod',
        platform: 'web',
        userAgent: 'Mozilla/5.0 AppleWebKit/605.1.15',
        serviceWorkerStatus: 'Active',
        isOnline: true,
        checkedAt: '2026-11-18T14:35:00.000Z',
      });

      jest.spyOn(adminService, 'getErrorLogs').mockResolvedValue(SAMPLE_LOGS);
      const clearLogsSpy = jest.spyOn(adminService, 'clearErrorLogs').mockResolvedValue();

      const initialAnnouncements: AppAnnouncement[] = [
        {
          id: 'ann_1',
          created_at: '2026-11-18T12:00:00.000Z',
          title: 'Initial Notice',
          body: 'Welcome to BeBig 2.0',
          type: 'info',
          is_active: true,
          created_by: 'user_admin_3',
          source: 'remote',
        },
      ];
      jest.spyOn(adminService, 'getAnnouncements').mockResolvedValue(initialAnnouncements);

      const createAnnouncementSpy = jest
        .spyOn(adminService, 'createAnnouncement')
        .mockImplementation(async (input) => ({
          id: 'ann_2',
          created_at: '2026-11-18T14:40:00.000Z',
          title: input.title,
          body: input.body,
          type: input.type,
          is_active: true,
          created_by: input.userId ?? null,
          source: 'remote',
        }));

      const toggleAnnouncementSpy = jest
        .spyOn(adminService, 'toggleAnnouncementActive')
        .mockImplementation(async (id, nextActive) => ({
          id,
          created_at: '2026-11-18T14:40:00.000Z',
          title: 'v2.4.5 Release',
          body: 'Faster sync and improved admin panel.',
          type: 'release',
          is_active: nextActive,
          created_by: 'user_admin_3',
          source: 'remote',
        }));

      const { getByTestId, queryByTestId, findByText, getByText } = await render(
        <AdminDashboardScreen />,
      );

      // Tab 1: Overview KPI Cards & PWA Health
      expect(await findByText('428')).toBeTruthy();
      expect(getByTestId('kpi-total-users')).toBeTruthy();
      expect(getByTestId('kpi-workouts-today')).toBeTruthy();
      expect(getByTestId('kpi-workouts-week')).toBeTruthy();
      expect(getByTestId('kpi-total-completed')).toBeTruthy();
      expect(getByTestId('kpi-errors-24h')).toBeTruthy();
      expect(getByTestId('admin-pwa-health-card')).toBeTruthy();
      expect(getByText('Active')).toBeTruthy();

      // Tab 2: Diagnostics Terminal
      await act(async () => {
        fireEvent.press(getByTestId('admin-tab-diagnostics'));
      });
      expect(getByTestId('admin-panel-diagnostics')).toBeTruthy();
      expect(getByTestId('diag-log-row-err_crash_1')).toBeTruthy();
      expect(getByTestId('diag-log-row-err_warn_2')).toBeTruthy();

      // Expand stack trace on crash entry
      expect(queryByTestId('diag-stack-trace-err_crash_1')).toBeNull();
      await act(async () => {
        fireEvent.press(getByTestId('diag-toggle-stack-err_crash_1'));
      });
      expect(getByTestId('diag-stack-trace-err_crash_1')).toBeTruthy();

      // Filter by Crash only
      await act(async () => {
        fireEvent.press(getByTestId('diag-filter-crash'));
      });
      expect(getByTestId('diag-log-row-err_crash_1')).toBeTruthy();
      expect(queryByTestId('diag-log-row-err_warn_2')).toBeNull();

      // Clear logs
      await act(async () => {
        fireEvent.press(getByTestId('diag-clear-logs-button'));
      });
      await waitFor(() => {
        expect(clearLogsSpy).toHaveBeenCalledTimes(1);
        expect(getByTestId('diag-empty-state')).toBeTruthy();
      });

      // Tab 3: Announcements create & toggle
      await act(async () => {
        fireEvent.press(getByTestId('admin-tab-announcements'));
      });
      expect(getByTestId('admin-panel-announcements')).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByTestId('announcement-type-release'));
        fireEvent.changeText(getByTestId('announcement-title-input'), 'v2.4.5 Release');
        fireEvent.changeText(
          getByTestId('announcement-body-input'),
          'Faster sync and improved admin panel.',
        );
      });

      await act(async () => {
        fireEvent.press(getByTestId('announcement-create-button'));
      });

      await waitFor(() => {
        expect(createAnnouncementSpy).toHaveBeenCalledWith({
          title: 'v2.4.5 Release',
          body: 'Faster sync and improved admin panel.',
          type: 'release',
          userId: 'user_admin_3',
        });
        expect(getByTestId('announcement-row-ann_2')).toBeTruthy();
      });

      // Toggle created announcement off
      await act(async () => {
        fireEvent.press(getByTestId('announcement-toggle-ann_2'));
      });
      await waitFor(() => {
        expect(toggleAnnouncementSpy).toHaveBeenCalledWith('ann_2', false);
        expect(getByText('PAUSED')).toBeTruthy();
      });
    });
  });

  describe('4. Sanitized Error Telemetry & ErrorBoundary Capture', () => {
    it('strips JWTs, Bearer tokens, API keys, and email PII from error payloads', async () => {
      const sensitiveError = new Error(
        'Request failed for athlete.user@example.com with Bearer secretToken12345 and jwt eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signatureVal apikey=sb_secret_supersecret999',
      );
      sensitiveError.stack =
        'Error: failed for private@domain.org token=topsecretval\n  at sync.ts:44:9';

      const entry = errorTelemetryService.captureError({
        error: sensitiveError,
        route: '/workout/active?access_token=abc123xyz',
        severity: 'crash',
      });

      expect(entry.error_message).not.toContain('athlete.user@example.com');
      expect(entry.error_message).not.toContain('secretToken12345');
      expect(entry.error_message).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(entry.error_message).not.toContain('sb_secret_supersecret999');
      expect(entry.error_message).toContain('[REDACTED_EMAIL]');
      expect(entry.error_message).toContain('[REDACTED_TOKEN]');
      expect(entry.error_message).toContain('[REDACTED_JWT]');
      expect(entry.stack_trace).not.toContain('private@domain.org');
      expect(entry.stack_trace).not.toContain('topsecretval');
      expect(entry.route).toContain('access_token=[REDACTED]');

      const buffered = await errorTelemetryService.getLocalErrorLogs();
      expect(buffered).toHaveLength(1);
      expect(buffered[0].id).toBe(entry.id);
    });

    it('enforces the bounded 50-entry ring buffer cap', async () => {
      for (let i = 0; i < ERROR_RING_BUFFER_MAX + 12; i += 1) {
        errorTelemetryService.captureError({
          error: new Error(`Synthetic error #${i}`),
          route: '/home',
          severity: 'warning',
        });
      }

      const buffered = await errorTelemetryService.getLocalErrorLogs();
      expect(buffered).toHaveLength(ERROR_RING_BUFFER_MAX);
      expect(buffered[0].error_message).toBe(`Synthetic error #${ERROR_RING_BUFFER_MAX + 11}`);
    });

    it('wires ErrorBoundary componentDidCatch into errorTelemetryService without disrupting fallback UI', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const captureSpy = jest.spyOn(errorTelemetryService, 'captureError');

      const CrashingChild = () => {
        throw new Error('Synthetic render crash for private@athlete.io');
      };

      const { getByTestId, getByText } = await render(
        <ErrorBoundary testID="eb-telemetry-test" fallbackTitle="Recovered View">
          <CrashingChild />
        </ErrorBoundary>,
      );

      expect(getByTestId('eb-telemetry-test')).toBeTruthy();
      expect(getByText('Recovered View')).toBeTruthy();
      expect(captureSpy).toHaveBeenCalledTimes(1);
      const capturedEntry = captureSpy.mock.results[0].value as ClientErrorLogEntry;
      expect(capturedEntry.error_message).toContain('[REDACTED_EMAIL]');
      expect(capturedEntry.error_message).not.toContain('private@athlete.io');

      consoleErrorSpy.mockRestore();
    });

    it('sanitizeErrorText clamps overly long payloads cleanly', () => {
      const huge = 'A'.repeat(2500);
      const clamped = sanitizeErrorText(huge, 100);
      expect(clamped.length).toBeLessThanOrEqual(100);
      expect(clamped.endsWith('...')).toBe(true);
    });
  });

  describe('5. Local SQL Migration Integrity Check', () => {
    it('includes additive RBAC schema, anti-escalation trigger, RLS, and SECURITY DEFINER metrics RPC', () => {
      const nodeFs = require('fs') as { readFileSync: (p: string, enc: string) => string };
      const nodePath = require('path') as { resolve: (...parts: string[]) => string };
      const sqlPath = nodePath.resolve(
        process.cwd(),
        'supabase/migrations/20261118_admin_panel_m1.sql',
      );
      const sql = nodeFs.readFileSync(sqlPath, 'utf8');

      expect(sql).toContain('ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE');
      expect(sql).toContain('prevent_profiles_is_admin_escalation');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.app_error_logs');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.app_announcements');
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_admin_overview_metrics()');
      expect(sql).toContain('SECURITY DEFINER');
      expect(sql).toContain('public.is_current_user_admin()');
      expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
      expect(sql).not.toMatch(/DROP TABLE/i);
    });
  });
});
