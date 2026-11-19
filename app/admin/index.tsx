import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams as routerUseLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../../src/features/theme';
import { useAuthStore } from '../../src/features/auth';
import {
  adminService,
  AdminDirectoryUser,
  AdminOverviewResult,
  AdminUserDirectoryResult,
  AnnouncementType,
  AppAnnouncement,
  AssignedWorkoutRecord,
  ClientErrorLogEntry,
  GlobalExerciseRecord,
  PwaHealthSnapshot,
  SaveGlobalExerciseInput,
  SaveTrainerTemplateInput,
  TrainerWorkoutTemplate,
} from '../../src/features/admin';
import { AdminUsersTab } from '../../src/features/admin/components/AdminUsersTab';
import { AdminTrainerTemplatesTab } from '../../src/features/admin/components/AdminTrainerTemplatesTab';
import { AdminExerciseCatalogTab } from '../../src/features/admin/components/AdminExerciseCatalogTab';
import { useAdminLayoutContext } from './_layout';
import {
  FONT_FAMILIES,
  NUMERIC_TABULAR_STYLE,
  radii,
  spacing,
  typography,
} from '../../src/constants/theme';
import { env } from '../../src/config/env';

export type AdminTab =
  | 'overview'
  | 'diagnostics'
  | 'announcements'
  | 'users'
  | 'templates'
  | 'catalog';
type DiagnosticsSeverityFilter = 'all' | 'crash' | 'warning';

export interface AdminDashboardScreenProps {
  initialTab?: AdminTab;
  hideTabBar?: boolean;
}

const MONO_FONT = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

function formatMetricValue(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return value.toLocaleString();
}

function formatLogTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
}

function formatDeviceBadge(entry: ClientErrorLogEntry): string {
  const info = entry.device_info;
  if (info.isIOS && info.isWebKit) return 'iOS WebKit';
  if (info.isIOS) return 'iOS';
  if (info.isWebKit) return 'WebKit';
  return info.platform ? info.platform.toUpperCase() : 'UNKNOWN';
}

const VALID_ADMIN_TABS: readonly AdminTab[] = [
  'overview',
  'diagnostics',
  'announcements',
  'users',
  'templates',
  'catalog',
];

function resolveAdminTab(raw: unknown, fallback: AdminTab): AdminTab {
  if (typeof raw === 'string' && VALID_ADMIN_TABS.includes(raw as AdminTab)) {
    return raw as AdminTab;
  }
  return fallback;
}

const useSafeLocalSearchParams =
  typeof routerUseLocalSearchParams === 'function'
    ? routerUseLocalSearchParams
    : () => ({} as Record<string, string | string[] | undefined>);

export default function AdminDashboardScreen({
  initialTab = 'overview',
  hideTabBar,
}: AdminDashboardScreenProps = {}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { inAdminLayout } = useAdminLayoutContext();
  const shouldHideTabBar = hideTabBar ?? inAdminLayout;
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const searchParams = useSafeLocalSearchParams();
  const routeTab = resolveAdminTab(searchParams?.tab, initialTab);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [activeTab, setActiveTab] = useState<AdminTab>(routeTab);
  const [isRefreshing, setIsRefreshing] = useState(true);

  useEffect(() => {
    if (typeof searchParams?.tab === 'string') {
      setActiveTab(resolveAdminTab(searchParams.tab, initialTab));
    }
  }, [searchParams?.tab, initialTab]);

  // Tab 1: Overview & App Health
  const [overviewResult, setOverviewResult] = useState<AdminOverviewResult | null>(null);
  const [pwaHealth, setPwaHealth] = useState<PwaHealthSnapshot | null>(null);

  // Tab 2: Diagnostics Terminal
  const [errorLogs, setErrorLogs] = useState<ClientErrorLogEntry[]>([]);
  const [severityFilter, setSeverityFilter] = useState<DiagnosticsSeverityFilter>('all');
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});
  const [isClearingLogs, setIsClearingLogs] = useState(false);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Tab 3: Announcements
  const [announcements, setAnnouncements] = useState<AppAnnouncement[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newType, setNewType] = useState<AnnouncementType>('info');
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [isCreatingAnnouncement, setIsCreatingAnnouncement] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Record<string, boolean>>({});

  // Tab 4: User Directory & Support
  const [directoryResult, setDirectoryResult] = useState<AdminUserDirectoryResult>({
    users: [],
    source: 'local_fallback',
  });
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Tab 5: Trainer Templates & Assignments
  const [trainerTemplates, setTrainerTemplates] = useState<TrainerWorkoutTemplate[]>([]);
  const [recentAssignments, setRecentAssignments] = useState<AssignedWorkoutRecord[]>([]);
  const [preselectedUserIds, setPreselectedUserIds] = useState<string[]>([]);

  // Tab 6: Global Exercise Catalog Manager
  const [globalExercises, setGlobalExercises] = useState<GlobalExerciseRecord[]>([]);

  const loadAllAdminData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [
        overview,
        health,
        logs,
        announcementRows,
        directory,
        tplRows,
        assignmentRows,
        catalogRows,
      ] = await Promise.all([
        adminService.getOverviewMetrics(),
        adminService.getPwaHealthSnapshot(),
        adminService.getErrorLogs(),
        adminService.getAnnouncements(),
        adminService.getUserDirectory('').catch(() => ({
          users: [] as AdminDirectoryUser[],
          source: 'local_fallback' as const,
        })),
        adminService.listTrainerTemplates().catch(() => [] as TrainerWorkoutTemplate[]),
        adminService.listAssignedWorkouts().catch(() => [] as AssignedWorkoutRecord[]),
        adminService.listGlobalExercises().catch(() => [] as GlobalExerciseRecord[]),
      ]);
      if (!isMountedRef.current) return;
      setOverviewResult(overview);
      setPwaHealth(health);
      setErrorLogs(logs);
      setAnnouncements(announcementRows);
      setDirectoryResult(directory);
      setTrainerTemplates(tplRows);
      setRecentAssignments(assignmentRows);
      setGlobalExercises(catalogRows);
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadAllAdminData();
  }, [loadAllAdminData]);

  const filteredLogs = useMemo(() => {
    if (severityFilter === 'all') return errorLogs;
    if (severityFilter === 'crash') {
      return errorLogs.filter((log) => log.severity === 'crash' || log.severity === 'error');
    }
    return errorLogs.filter((log) => log.severity === 'warning' || log.severity === 'info');
  }, [errorLogs, severityFilter]);

  const activeAnnouncements = useMemo(
    () => announcements.filter((item) => item.is_active),
    [announcements],
  );

  const handleToggleStack = useCallback((logId: string) => {
    setExpandedLogIds((prev) => ({
      ...prev,
      [logId]: !prev[logId],
    }));
  }, []);

  const handleClearLogs = useCallback(async () => {
    setIsClearingLogs(true);
    try {
      await adminService.clearErrorLogs();
      setErrorLogs([]);
      setExpandedLogIds({});
      const refreshedOverview = await adminService.getOverviewMetrics();
      setOverviewResult(refreshedOverview);
    } finally {
      setIsClearingLogs(false);
    }
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    return false;
  }, []);

  const handleCopySingleLog = useCallback(
    async (log: ClientErrorLogEntry) => {
      const formatted = `[${log.severity.toUpperCase()}] [${log.created_at}] [${log.route || 'unknown'}] [${formatDeviceBadge(log)}] v${log.app_version}\n${log.error_name}: ${log.error_message}${log.stack_trace ? `\n\nStack:\n${log.stack_trace}` : ''}`;
      await copyToClipboard(formatted);
      setCopiedLogId(log.id);
      setTimeout(() => {
        setCopiedLogId((current) => (current === log.id ? null : current));
      }, 2000);
    },
    [copyToClipboard],
  );

  const handleCopyAllLogs = useCallback(async () => {
    if (filteredLogs.length === 0) return;
    const formatted = filteredLogs
      .map(
        (log) =>
          `[${log.severity.toUpperCase()}] [${log.created_at}] [${log.route || 'unknown'}] [${formatDeviceBadge(log)}] v${log.app_version}\n${log.error_name}: ${log.error_message}${log.stack_trace ? `\n\nStack:\n${log.stack_trace}` : ''}`,
      )
      .join('\n\n----------------------------------------\n\n');
    await copyToClipboard(formatted);
    setCopiedAll(true);
    setTimeout(() => {
      setCopiedAll(false);
    }, 2000);
  }, [filteredLogs, copyToClipboard]);

  const handleCreateAnnouncement = useCallback(async () => {
    const trimmedTitle = newTitle.trim();
    const trimmedBody = newBody.trim();
    if (!trimmedTitle || !trimmedBody) {
      setAnnouncementError('Please enter both a title and message body.');
      return;
    }

    setAnnouncementError(null);
    setIsCreatingAnnouncement(true);
    try {
      const created = await adminService.createAnnouncement({
        title: trimmedTitle,
        body: trimmedBody,
        type: newType,
        userId,
      });
      setAnnouncements((prev) => [created, ...prev]);
      setNewTitle('');
      setNewBody('');
      setNewType('info');
    } catch (err) {
      setAnnouncementError(
        err instanceof Error ? err.message : 'Unable to create announcement right now.',
      );
    } finally {
      setIsCreatingAnnouncement(false);
    }
  }, [newTitle, newBody, newType, userId]);

  const handleToggleAnnouncement = useCallback(async (item: AppAnnouncement) => {
    setTogglingIds((prev) => ({ ...prev, [item.id]: true }));
    try {
      const updated = await adminService.toggleAnnouncementActive(item.id, !item.is_active);
      if (updated) {
        setAnnouncements((prev) =>
          prev.map((row) => (row.id === item.id ? updated : row)),
        );
      }
    } finally {
      setTogglingIds((prev) => ({ ...prev, [item.id]: false }));
    }
  }, []);

  const handleQuickAssignUser = useCallback((user: AdminDirectoryUser) => {
    setPreselectedUserIds([user.user_id]);
    setActiveTab('templates');
  }, []);

  const handleDeleteUser = useCallback(async (targetUserId: string) => {
    const res = await adminService.deleteUserAccount(targetUserId);
    if (res.success) {
      setDirectoryResult((prev) => ({
        ...prev,
        users: prev.users.filter((u) => u.user_id !== targetUserId),
      }));
    }
    return res;
  }, []);

  const handleSaveTrainerTemplate = useCallback(
    async (input: SaveTrainerTemplateInput): Promise<TrainerWorkoutTemplate> => {
      const saved = await adminService.saveTrainerTemplate(input);
      setTrainerTemplates((prev) => {
        const exists = prev.some((row) => row.id === saved.id);
        return exists
          ? prev.map((row) => (row.id === saved.id ? saved : row))
          : [saved, ...prev];
      });
      return saved;
    },
    [],
  );

  const handleDeleteTrainerTemplate = useCallback(async (id: string) => {
    await adminService.deleteTrainerTemplate(id);
    setTrainerTemplates((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const handleAssignTemplate = useCallback(
    async (input: {
      templateId: string;
      userIds: string[];
      trainerNote: string;
    }): Promise<AssignedWorkoutRecord[]> => {
      const created = await adminService.assignTemplateToUsers({
        ...input,
        assignedBy: userId,
      });
      setRecentAssignments((prev) => [...created, ...prev]);
      return created;
    },
    [userId],
  );

  const handleSaveGlobalExercise = useCallback(
    async (input: SaveGlobalExerciseInput): Promise<GlobalExerciseRecord> => {
      const saved = await adminService.saveGlobalExercise(input);
      setGlobalExercises((prev) => {
        const exists = prev.some((row) => row.id === saved.id);
        return exists
          ? prev.map((row) => (row.id === saved.id ? saved : row))
          : [saved, ...prev];
      });
      return saved;
    },
    [],
  );

  const handleToggleGlobalExercise = useCallback(async (id: string, nextActive: boolean) => {
    const updated = await adminService.toggleGlobalExerciseActive(id, nextActive);
    if (updated) {
      setGlobalExercises((prev) => prev.map((row) => (row.id === id ? updated : row)));
    }
  }, []);

  const handleDeleteGlobalExercise = useCallback(async (id: string) => {
    await adminService.deleteGlobalExercise(id);
    setGlobalExercises((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const metrics = overviewResult?.metrics;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerTextCol}>
          <Text style={styles.pageTitle}>Admin Control Panel</Text>
          <Text style={styles.pageSubtitle}>
            Live operations, sanitized crash diagnostics, and athlete broadcasts
          </Text>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.versionBadge}>
            <Text style={styles.versionBadgeText}>v{env.version}</Text>
          </View>
          <Pressable
            testID="admin-refresh-button"
            style={styles.refreshButton}
            onPress={() => {
              void loadAllAdminData();
            }}
            disabled={isRefreshing}
          >
            <Text style={styles.refreshButtonText}>
              {isRefreshing ? 'Syncing...' : 'Refresh'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Inner Segmented Navigation (Only rendered when not embedded inside AdminLayout) */}
      {!shouldHideTabBar ? (
        <View style={styles.tabBar} accessibilityRole="tablist">
          <Pressable
            testID="admin-tab-overview"
            style={[styles.tabButton, activeTab === 'overview' && styles.tabButtonActive]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabLabel, activeTab === 'overview' && styles.tabLabelActive]}>
              Overview & Health
            </Text>
          </Pressable>

          <Pressable
            testID="admin-tab-diagnostics"
            style={[styles.tabButton, activeTab === 'diagnostics' && styles.tabButtonActive]}
            onPress={() => setActiveTab('diagnostics')}
          >
            <Text style={[styles.tabLabel, activeTab === 'diagnostics' && styles.tabLabelActive]}>
              Diagnostics ({errorLogs.length})
            </Text>
          </Pressable>

          <Pressable
            testID="admin-tab-announcements"
            style={[styles.tabButton, activeTab === 'announcements' && styles.tabButtonActive]}
            onPress={() => setActiveTab('announcements')}
          >
            <Text style={[styles.tabLabel, activeTab === 'announcements' && styles.tabLabelActive]}>
              Announcements ({activeAnnouncements.length})
            </Text>
          </Pressable>

          <Pressable
            testID="admin-tab-users"
            style={[styles.tabButton, activeTab === 'users' && styles.tabButtonActive]}
            onPress={() => setActiveTab('users')}
          >
            <Text style={[styles.tabLabel, activeTab === 'users' && styles.tabLabelActive]}>
              Users ({directoryResult.users.length})
            </Text>
          </Pressable>

          <Pressable
            testID="admin-tab-templates"
            style={[styles.tabButton, activeTab === 'templates' && styles.tabButtonActive]}
            onPress={() => setActiveTab('templates')}
          >
            <Text style={[styles.tabLabel, activeTab === 'templates' && styles.tabLabelActive]}>
              Trainer Templates ({trainerTemplates.length})
            </Text>
          </Pressable>

          <Pressable
            testID="admin-tab-catalog"
            style={[styles.tabButton, activeTab === 'catalog' && styles.tabButtonActive]}
            onPress={() => setActiveTab('catalog')}
          >
            <Text style={[styles.tabLabel, activeTab === 'catalog' && styles.tabLabelActive]}>
              Exercise Catalog ({globalExercises.length})
            </Text>
          </Pressable>
        </View>
      ) : null}

      {isRefreshing && !overviewResult && (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading live admin diagnostics...</Text>
        </View>
      )}

      {/* TAB 1: OVERVIEW & APP HEALTH */}
      {activeTab === 'overview' && (
        <View testID="admin-panel-overview" style={styles.tabSection}>
          {overviewResult?.notice ? (
            <View style={styles.noticeBanner} testID="admin-overview-notice">
              <Text style={styles.noticeBannerText}>{overviewResult.notice}</Text>
            </View>
          ) : null}

          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard} testID="kpi-total-users">
              <Text style={styles.kpiLabel}>TOTAL USERS</Text>
              <Text style={styles.kpiValue}>
                {formatMetricValue(metrics?.total_users)}
              </Text>
              <Text style={styles.kpiMeta}>Registered profiles</Text>
            </View>

            <View style={styles.kpiCard} testID="kpi-workouts-today">
              <Text style={styles.kpiLabel}>WORKOUTS TODAY</Text>
              <Text style={[styles.kpiValue, { color: colors.secondaryAccent }]}>
                {formatMetricValue(metrics?.workouts_today)}
              </Text>
              <Text style={styles.kpiMeta}>Completed since 00:00 UTC</Text>
            </View>

            <View style={styles.kpiCard} testID="kpi-workouts-week">
              <Text style={styles.kpiLabel}>WORKOUTS (7D)</Text>
              <Text style={styles.kpiValue}>
                {formatMetricValue(metrics?.workouts_this_week)}
              </Text>
              <Text style={styles.kpiMeta}>Trailing 7-day volume</Text>
            </View>

            <View style={styles.kpiCard} testID="kpi-total-completed">
              <Text style={styles.kpiLabel}>TOTAL COMPLETED</Text>
              <Text style={styles.kpiValue}>
                {formatMetricValue(metrics?.total_completed_workouts)}
              </Text>
              <Text style={styles.kpiMeta}>All-time synced sessions</Text>
            </View>

            <View style={styles.kpiCard} testID="kpi-errors-24h">
              <Text style={styles.kpiLabel}>ERRORS (24H)</Text>
              <Text
                style={[
                  styles.kpiValue,
                  (metrics?.recent_errors_24h ?? 0) > 0
                    ? { color: colors.error }
                    : { color: colors.secondaryAccent },
                ]}
              >
                {formatMetricValue(metrics?.recent_errors_24h ?? 0)}
              </Text>
              <Text style={styles.kpiMeta}>Sanitized crash & error logs</Text>
            </View>
          </View>

          {/* Live PWA Health Card */}
          <View style={styles.healthCard} testID="admin-pwa-health-card">
            <View style={styles.healthHeader}>
              <Text style={styles.sectionTitle}>Live PWA & Runtime Health</Text>
              <View
                style={[
                  styles.statusPill,
                  pwaHealth?.isOnline !== false ? styles.statusPillOk : styles.statusPillWarn,
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    pwaHealth?.isOnline !== false
                      ? { color: colors.secondaryAccent }
                      : { color: colors.error },
                  ]}
                >
                  {pwaHealth?.isOnline !== false ? 'ONLINE' : 'OFFLINE'}
                </Text>
              </View>
            </View>

            <View style={styles.healthRow}>
              <Text style={styles.healthKey}>App Version</Text>
              <Text style={styles.healthVal} testID="pwa-health-version">
                {pwaHealth?.displayVersion ?? env.displayVersion}
              </Text>
            </View>

            <View style={styles.healthRow}>
              <Text style={styles.healthKey}>Service Worker</Text>
              <Text style={styles.healthVal} testID="pwa-health-sw">
                {pwaHealth?.serviceWorkerStatus ?? 'Checking...'}
              </Text>
            </View>

            <View style={styles.healthRow}>
              <Text style={styles.healthKey}>Platform</Text>
              <Text style={styles.healthVal}>
                {(pwaHealth?.platform ?? Platform.OS).toUpperCase()}
              </Text>
            </View>

            <View style={[styles.healthRow, styles.healthRowLast]}>
              <Text style={styles.healthKey}>User Agent</Text>
              <Text style={styles.healthUaVal} numberOfLines={2}>
                {pwaHealth?.userAgent ?? Platform.OS}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* TAB 2: DIAGNOSTICS TERMINAL */}
      {activeTab === 'diagnostics' && (
        <View testID="admin-panel-diagnostics" style={styles.tabSection}>
          <View style={styles.diagToolbar}>
            <View style={styles.filterGroup}>
              {(
                [
                  { id: 'all', label: 'All', testID: 'diag-filter-all' },
                  { id: 'crash', label: 'Crash', testID: 'diag-filter-crash' },
                  { id: 'warning', label: 'Warning', testID: 'diag-filter-warning' },
                ] as const
              ).map((chip) => {
                const isSelected = severityFilter === chip.id;
                return (
                  <Pressable
                    key={chip.id}
                    testID={chip.testID}
                    style={[styles.filterChip, isSelected && styles.filterChipActive]}
                    onPress={() => setSeverityFilter(chip.id)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected && styles.filterChipTextActive,
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.diagActionsRow}>
              <Pressable
                testID="diag-copy-all-button"
                style={[
                  styles.copyLogsButton,
                  copiedAll && styles.copyLogsButtonActive,
                ]}
                onPress={() => {
                  void handleCopyAllLogs();
                }}
                disabled={filteredLogs.length === 0}
              >
                <Text
                  style={[
                    styles.copyLogsButtonText,
                    copiedAll && { color: colors.primary },
                  ]}
                >
                  {copiedAll ? '✓ Copied All!' : 'Copy All'}
                </Text>
              </Pressable>

              <Pressable
                testID="diag-clear-logs-button"
                style={styles.clearLogsButton}
                onPress={() => {
                  void handleClearLogs();
                }}
                disabled={isClearingLogs || errorLogs.length === 0}
              >
                <Text style={styles.clearLogsButtonText}>
                  {isClearingLogs ? 'Clearing...' : 'Clear Logs'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.terminalBox}>
            <View style={styles.terminalHeader}>
              <Text style={styles.terminalTitle}>
                BEBIG DIAGNOSTICS TERMINAL · {filteredLogs.length} ENTRIES
              </Text>
              <Text style={styles.terminalSubtitle}>PII & Tokens Redacted</Text>
            </View>

            {filteredLogs.length === 0 ? (
              <View style={styles.terminalEmpty} testID="diag-empty-state">
                <Text style={styles.terminalEmptyText}>
                  ✓ No error logs matching current filter.
                </Text>
              </View>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = Boolean(expandedLogIds[log.id]);
                const isSevere = log.severity === 'crash' || log.severity === 'error';
                return (
                  <View
                    key={log.id}
                    testID={`diag-log-row-${log.id}`}
                    style={styles.logRow}
                  >
                    <View style={styles.logMetaRow}>
                      <View
                        style={[
                          styles.severityBadge,
                          isSevere ? styles.severityCrash : styles.severityWarn,
                        ]}
                      >
                        <Text
                          style={[
                            styles.severityBadgeText,
                            isSevere
                              ? { color: '#FCA5A5' }
                              : { color: '#FDE68A' },
                          ]}
                        >
                          {(log.severity || 'error').toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.logTimestamp}>
                        {formatLogTimestamp(log.created_at)}
                      </Text>
                      <Text style={styles.logRoute}>{log.route}</Text>
                      <Text style={styles.logDevice}>{formatDeviceBadge(log)}</Text>
                      <Text style={styles.logVersion}>v{log.app_version}</Text>

                      <Pressable
                        testID={`diag-copy-log-${log.id}`}
                        onPress={() => {
                          void handleCopySingleLog(log);
                        }}
                        style={[
                          styles.copySingleLogBtn,
                          copiedLogId === log.id && styles.copySingleLogBtnActive,
                        ]}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Copy error log ${log.id}`}
                      >
                        <Text
                          style={[
                            styles.copySingleLogText,
                            copiedLogId === log.id && { color: colors.primary },
                          ]}
                        >
                          {copiedLogId === log.id ? '✓ Copied!' : 'Copy'}
                        </Text>
                      </Pressable>
                    </View>

                    <Text style={styles.logMessage}>
                      {log.error_name}: {log.error_message}
                    </Text>

                    {log.stack_trace ? (
                      <View style={styles.stackSection}>
                        <Pressable
                          testID={`diag-toggle-stack-${log.id}`}
                          onPress={() => handleToggleStack(log.id)}
                          style={styles.stackToggleBtn}
                        >
                          <Text style={styles.stackToggleText}>
                            {isExpanded ? '▾ Hide Stack Trace' : '▸ Expand Stack Trace'}
                          </Text>
                        </Pressable>

                        {isExpanded ? (
                          <View
                            testID={`diag-stack-trace-${log.id}`}
                            style={styles.stackTraceBox}
                          >
                            <Text style={styles.stackTraceText}>{log.stack_trace}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </View>
      )}

      {/* TAB 3: ANNOUNCEMENTS */}
      {activeTab === 'announcements' && (
        <View testID="admin-panel-announcements" style={styles.tabSection}>
          {/* Create Form */}
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Create App Announcement</Text>

            <View style={styles.typeChipRow}>
              {(
                [
                  { id: 'info', label: 'Info', testID: 'announcement-type-info' },
                  { id: 'release', label: 'Release', testID: 'announcement-type-release' },
                  {
                    id: 'maintenance',
                    label: 'Maintenance',
                    testID: 'announcement-type-maintenance',
                  },
                ] as const
              ).map((chip) => {
                const selected = newType === chip.id;
                return (
                  <Pressable
                    key={chip.id}
                    testID={chip.testID}
                    style={[styles.filterChip, selected && styles.filterChipActive]}
                    onPress={() => setNewType(chip.id)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selected && styles.filterChipTextActive,
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              testID="announcement-title-input"
              style={styles.textInput}
              placeholder="Announcement title (e.g., BeBig v2.4.5 Live)"
              placeholderTextColor={colors.textMuted}
              value={newTitle}
              onChangeText={setNewTitle}
              maxLength={140}
            />

            <TextInput
              testID="announcement-body-input"
              style={[styles.textInput, styles.textArea]}
              placeholder="Write a concise update for athletes..."
              placeholderTextColor={colors.textMuted}
              value={newBody}
              onChangeText={setNewBody}
              multiline
              numberOfLines={3}
              maxLength={1000}
            />

            {announcementError ? (
              <Text style={styles.formErrorText} testID="announcement-form-error">
                {announcementError}
              </Text>
            ) : null}

            <Pressable
              testID="announcement-create-button"
              style={styles.primaryButton}
              onPress={() => {
                void handleCreateAnnouncement();
              }}
              disabled={isCreatingAnnouncement}
            >
              <Text style={styles.primaryButtonText}>
                {isCreatingAnnouncement ? 'Publishing...' : 'Publish Announcement'}
              </Text>
            </Pressable>
          </View>

          {/* Active Banner Preview */}
          <View style={styles.previewCard} testID="announcement-active-preview">
            <Text style={styles.sectionTitle}>Active Banner Preview</Text>
            {activeAnnouncements.length === 0 ? (
              <Text style={styles.emptyHelperText}>
                No active banners right now. Publish or enable an announcement below.
              </Text>
            ) : (
              activeAnnouncements.map((item) => (
                <View
                  key={`preview_${item.id}`}
                  style={[
                    styles.bannerPreviewItem,
                    item.type === 'maintenance'
                      ? styles.bannerMaintenance
                      : item.type === 'release'
                        ? styles.bannerRelease
                        : styles.bannerInfo,
                  ]}
                >
                  <Text style={styles.bannerTypeTag}>{item.type.toUpperCase()}</Text>
                  <Text style={styles.bannerPreviewTitle}>{item.title}</Text>
                  <Text style={styles.bannerPreviewBody}>{item.body}</Text>
                </View>
              ))
            )}
          </View>

          {/* Manage All Announcements */}
          <View style={styles.listCard}>
            <Text style={styles.sectionTitle}>Manage Announcements ({announcements.length})</Text>
            {announcements.length === 0 ? (
              <Text style={styles.emptyHelperText}>No announcements created yet.</Text>
            ) : (
              announcements.map((item) => {
                const isUpdating = Boolean(togglingIds[item.id]);
                return (
                  <View
                    key={item.id}
                    testID={`announcement-row-${item.id}`}
                    style={styles.announcementRow}
                  >
                    <View style={styles.announcementTextCol}>
                      <View style={styles.announcementMetaRow}>
                        <Text style={styles.announcementTypeBadge}>
                          {item.type.toUpperCase()}
                        </Text>
                        <Text
                          style={[
                            styles.announcementStateText,
                            item.is_active
                              ? { color: colors.secondaryAccent }
                              : { color: colors.textMuted },
                          ]}
                        >
                          {item.is_active ? 'ACTIVE' : 'PAUSED'}
                        </Text>
                      </View>
                      <Text style={styles.announcementRowTitle}>{item.title}</Text>
                      <Text style={styles.announcementRowBody}>{item.body}</Text>
                    </View>

                    <Pressable
                      testID={`announcement-toggle-${item.id}`}
                      style={[
                        styles.toggleButton,
                        item.is_active ? styles.toggleButtonActive : styles.toggleButtonInactive,
                      ]}
                      onPress={() => {
                        void handleToggleAnnouncement(item);
                      }}
                      disabled={isUpdating}
                    >
                      <Text
                        style={[
                          styles.toggleButtonText,
                          item.is_active
                            ? { color: colors.secondaryAccent }
                            : { color: colors.textSecondary },
                        ]}
                      >
                        {isUpdating
                          ? '...'
                          : item.is_active
                            ? 'Deactivate'
                            : 'Activate'}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        </View>
      )}

      {/* TAB 4: USER DIRECTORY & SUPPORT */}
      {activeTab === 'users' && (
        <AdminUsersTab
          users={directoryResult.users}
          notice={directoryResult.notice}
          searchQuery={userSearchQuery}
          onChangeSearch={setUserSearchQuery}
          onQuickAssignUser={handleQuickAssignUser}
          onDeleteUser={handleDeleteUser}
          currentAdminUserId={userId}
        />
      )}

      {/* TAB 5: TRAINER TEMPLATES & CLIENT ASSIGNMENT */}
      {activeTab === 'templates' && (
        <AdminTrainerTemplatesTab
          templates={trainerTemplates}
          users={directoryResult.users}
          recentAssignments={recentAssignments}
          preselectedUserIds={preselectedUserIds}
          adminUserId={userId}
          onSaveTemplate={handleSaveTrainerTemplate}
          onDeleteTemplate={handleDeleteTrainerTemplate}
          onAssignTemplate={handleAssignTemplate}
        />
      )}

      {/* TAB 6: GLOBAL EXERCISE CATALOG MANAGER */}
      {activeTab === 'catalog' && (
        <AdminExerciseCatalogTab
          exercises={globalExercises}
          adminUserId={userId}
          onSaveExercise={handleSaveGlobalExercise}
          onToggleActive={handleToggleGlobalExercise}
          onDeleteExercise={handleDeleteGlobalExercise}
        />
      )}
    </ScrollView>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: spacing.xl * 2,
      gap: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerTextCol: {
      flex: 1,
      minWidth: 160,
    },
    pageTitle: {
      ...typography.h1,
      fontFamily: FONT_FAMILIES.displayExtraBold,
      color: colors.textPrimary,
    },
    pageSubtitle: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      marginTop: 2,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    versionBadge: {
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: radii.sm,
    },
    versionBadgeText: {
      ...typography.caption,
      ...NUMERIC_TABULAR_STYLE,
      color: colors.primary,
      fontFamily: FONT_FAMILIES.bodySemiBold,
    },
    refreshButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radii.sm,
    },
    refreshButtonText: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.primary,
    },
    tabBar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: 4,
      gap: 4,
    },
    tabButton: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.sm,
    },
    tabButtonActive: {
      backgroundColor: colors.primary,
    },
    tabLabel: {
      ...typography.caption,
      ...NUMERIC_TABULAR_STYLE,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.textSecondary,
    },
    tabLabelActive: {
      color: colors.primaryText,
    },
    loadingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    loadingText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
    },
    tabSection: {
      gap: spacing.md,
    },
    noticeBanner: {
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      borderRadius: radii.sm,
      padding: spacing.sm + 2,
    },
    noticeBannerText: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    kpiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      width: '100%',
    },
    kpiCard: {
      flexGrow: 1,
      flexBasis: 140,
      minWidth: 130,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    kpiLabel: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.textMuted,
      letterSpacing: 0.7,
    },
    kpiValue: {
      ...typography.numericHero,
      ...NUMERIC_TABULAR_STYLE,
      fontFamily: FONT_FAMILIES.displayExtraBold,
      color: colors.textPrimary,
      marginTop: spacing.xs,
    },
    kpiMeta: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    healthCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    healthHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    sectionTitle: {
      ...typography.titleMedium,
      fontFamily: FONT_FAMILIES.display,
      color: colors.textPrimary,
    },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: radii.full,
      borderWidth: 1,
    },
    statusPillOk: {
      backgroundColor: 'rgba(0, 229, 153, 0.12)',
      borderColor: 'rgba(0, 229, 153, 0.35)',
    },
    statusPillWarn: {
      backgroundColor: 'rgba(239, 68, 68, 0.14)',
      borderColor: 'rgba(239, 68, 68, 0.4)',
    },
    statusPillText: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodyBold,
      letterSpacing: 0.6,
    },
    healthRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: spacing.xs + 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    healthRowLast: {
      borderBottomWidth: 0,
      paddingBottom: 0,
    },
    healthKey: {
      ...typography.bodySmall,
      color: colors.textMuted,
    },
    healthVal: {
      ...typography.bodySmall,
      ...NUMERIC_TABULAR_STYLE,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.textPrimary,
      textAlign: 'right',
    },
    healthUaVal: {
      ...typography.caption,
      color: colors.textSecondary,
      flex: 1,
      textAlign: 'right',
      fontFamily: MONO_FONT,
    },
    diagToolbar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.sm,
    },
    filterGroup: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    typeChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    filterChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radii.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.textSecondary,
    },
    filterChipTextActive: {
      color: colors.primaryText,
    },
    clearLogsButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.error,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    clearLogsButtonText: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.error,
    },
    diagActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    copyLogsButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border ?? '#334155',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    copyLogsButtonActive: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(0, 229, 153, 0.1)',
    },
    copyLogsButtonText: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.textSecondary,
    },
    copySingleLogBtn: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radii.xs,
      borderWidth: 1,
      borderColor: colors.border ?? '#334155',
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      marginLeft: 'auto',
    },
    copySingleLogBtnActive: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(0, 229, 153, 0.12)',
    },
    copySingleLogText: {
      fontSize: 10,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.textMuted,
      fontWeight: '600',
    },
    terminalBox: {
      backgroundColor: '#060A12',
      borderWidth: 1,
      borderColor: '#1E293B',
      borderRadius: radii.md,
      overflow: 'hidden',
    },
    terminalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: '#0F172A',
      borderBottomWidth: 1,
      borderBottomColor: '#1E293B',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    terminalTitle: {
      fontFamily: MONO_FONT,
      fontSize: 12,
      fontWeight: '700',
      color: '#38BDF8',
      ...NUMERIC_TABULAR_STYLE,
    },
    terminalSubtitle: {
      fontFamily: MONO_FONT,
      fontSize: 11,
      color: '#64748B',
    },
    terminalEmpty: {
      padding: spacing.xl,
      alignItems: 'center',
    },
    terminalEmptyText: {
      fontFamily: MONO_FONT,
      fontSize: 13,
      color: '#10B981',
    },
    logRow: {
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: '#1E293B',
      gap: 6,
    },
    logMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.xs + 2,
    },
    severityBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    severityCrash: {
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
    },
    severityWarn: {
      backgroundColor: 'rgba(245, 158, 11, 0.2)',
    },
    severityBadgeText: {
      fontFamily: MONO_FONT,
      fontSize: 10,
      fontWeight: '700',
    },
    logTimestamp: {
      fontFamily: MONO_FONT,
      fontSize: 11,
      color: '#94A3B8',
      ...NUMERIC_TABULAR_STYLE,
    },
    logRoute: {
      fontFamily: MONO_FONT,
      fontSize: 11,
      color: '#38BDF8',
    },
    logDevice: {
      fontFamily: MONO_FONT,
      fontSize: 11,
      color: '#A78BFA',
    },
    logVersion: {
      fontFamily: MONO_FONT,
      fontSize: 11,
      color: '#64748B',
      ...NUMERIC_TABULAR_STYLE,
    },
    logMessage: {
      fontFamily: MONO_FONT,
      fontSize: 13,
      color: '#F8FAFC',
      lineHeight: 19,
    },
    stackSection: {
      marginTop: 4,
      gap: 6,
    },
    stackToggleBtn: {
      alignSelf: 'flex-start',
      paddingVertical: 2,
    },
    stackToggleText: {
      fontFamily: MONO_FONT,
      fontSize: 11,
      color: '#38BDF8',
    },
    stackTraceBox: {
      backgroundColor: '#020617',
      borderWidth: 1,
      borderColor: '#1E293B',
      borderRadius: radii.sm,
      padding: spacing.sm,
    },
    stackTraceText: {
      fontFamily: MONO_FONT,
      fontSize: 11,
      color: '#CBD5E1',
      lineHeight: 16,
    },
    formCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: spacing.sm,
      width: '100%',
    },
    textInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.textPrimary,
      ...typography.body,
      width: '100%',
    },
    textArea: {
      minHeight: 84,
      textAlignVertical: 'top',
      width: '100%',
    },
    formErrorText: {
      ...typography.caption,
      color: colors.error,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: radii.sm,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      alignSelf: 'flex-start',
    },
    primaryButtonText: {
      ...typography.bodyBold,
      color: colors.primaryText,
    },
    previewCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    bannerPreviewItem: {
      borderRadius: radii.sm,
      padding: spacing.md,
      borderWidth: 1,
      gap: 4,
    },
    bannerInfo: {
      backgroundColor: 'rgba(56, 189, 248, 0.1)',
      borderColor: 'rgba(56, 189, 248, 0.35)',
    },
    bannerRelease: {
      backgroundColor: 'rgba(0, 229, 153, 0.1)',
      borderColor: 'rgba(0, 229, 153, 0.35)',
    },
    bannerMaintenance: {
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    bannerTypeTag: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodyBold,
      color: colors.primary,
      letterSpacing: 0.8,
    },
    bannerPreviewTitle: {
      ...typography.bodyBold,
      color: colors.textPrimary,
    },
    bannerPreviewBody: {
      ...typography.bodySmall,
      color: colors.textSecondary,
    },
    listCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    emptyHelperText: {
      ...typography.bodySmall,
      color: colors.textMuted,
    },
    announcementRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: spacing.sm,
    },
    announcementTextCol: {
      flex: 1,
      minWidth: 200,
      gap: 2,
    },
    announcementMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    announcementTypeBadge: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodyBold,
      color: colors.primary,
    },
    announcementStateText: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodySemiBold,
    },
    announcementRowTitle: {
      ...typography.bodyBold,
      color: colors.textPrimary,
    },
    announcementRowBody: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    toggleButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radii.sm,
      borderWidth: 1,
    },
    toggleButtonActive: {
      borderColor: 'rgba(0, 229, 153, 0.4)',
      backgroundColor: 'rgba(0, 229, 153, 0.1)',
    },
    toggleButtonInactive: {
      borderColor: colors.border,
      backgroundColor: colors.surfaceSubtle,
    },
    toggleButtonText: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodySemiBold,
    },
  });
