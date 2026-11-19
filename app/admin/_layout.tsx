import { useAppTheme } from '../../src/features/theme';
import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import {
  Slot,
  useRouter,
  usePathname,
  useLocalSearchParams as routerUseLocalSearchParams,
  Redirect,
} from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminAccess } from '../../src/features/admin';
import { useAuthStore } from '../../src/features/auth';
import { spacing, radii, typography } from '../../src/constants/theme';

export interface AdminLayoutContextType {
  inAdminLayout: boolean;
  isDesktop: boolean;
}

export const AdminLayoutContext = React.createContext<AdminLayoutContextType>({
  inAdminLayout: false,
  isDesktop: true,
});

export function useAdminLayoutContext() {
  return React.useContext(AdminLayoutContext);
}

const useSafeLocalSearchParams =
  typeof routerUseLocalSearchParams === 'function'
    ? routerUseLocalSearchParams
    : () => ({} as Record<string, string | string[] | undefined>);

export default function AdminLayout() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSafeLocalSearchParams();
  const activeTabParam = typeof searchParams?.tab === 'string' ? searchParams.tab : undefined;

  const status = useAuthStore((state) => state.status);
  const isGuest = useAuthStore((state) => state.isGuest);
  const { isLoading, isAdmin, role } = useAdminAccess();

  // 1. Auth or admin RBAC check still initializing
  if (status === 'initializing' || isLoading) {
    return (
      <View style={styles.centerContainer} testID="admin-guard-loading">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // 2. Unauthenticated -> redirect immediately to login/welcome
  if (status === 'unauthenticated') {
    return <Redirect href="/onboarding/welcome" />;
  }

  // 3. Guest or non-admin user -> block immediately with Access Restricted screen
  if (isGuest || status !== 'authenticated' || !isAdmin) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={['top', 'left', 'right', 'bottom']}
        testID="admin-access-restricted"
      >
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle}>Access Restricted</Text>
          <Text style={styles.errorSubtext}>
            Admin privileges are required to view the BeBig Control Panel.
          </Text>
          <Pressable
            testID="admin-return-home-button"
            style={styles.homeButton}
            onPress={() => router.replace('/home')}
          >
            <Text style={styles.homeButtonText}>Return Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // 4. Unified 6-Module Admin Navigation Links (zero placeholder links)
  const links: { name: string; path: string; matchTab?: string }[] = [
    { name: 'Overview & Health', path: '/admin', matchTab: 'overview' },
    { name: 'Diagnostics Terminal', path: '/admin/monitoring', matchTab: 'diagnostics' },
    { name: 'Announcements', path: '/admin?tab=announcements', matchTab: 'announcements' },
    { name: 'Users', path: '/admin?tab=users', matchTab: 'users' },
    { name: 'Trainer Templates', path: '/admin/templates', matchTab: 'templates' },
    { name: 'Exercise Catalog', path: '/admin/exercises', matchTab: 'catalog' },
  ];

  const isNavLinkActive = (link: { name: string; path: string; matchTab?: string }): boolean => {
    if (link.path.includes('?tab=')) {
      return pathname === '/admin' && activeTabParam === link.matchTab;
    }
    if (link.path === '/admin') {
      return (
        (pathname === '/admin' || pathname === '/admin/dashboard') &&
        (!activeTabParam || activeTabParam === 'overview')
      );
    }
    return pathname === link.path || pathname.startsWith(`${link.path}/`);
  };

  return (
    <AdminLayoutContext.Provider value={{ inAdminLayout: true, isDesktop }}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {/* CSS Media Query Rules for RNW SSR & Static Export compatibility */}
        {Platform.OS === 'web' ? (
          <style
            dangerouslySetInnerHTML={{
              __html: `
                @media (max-width: 767px) {
                  .admin-desktop-sidebar { display: none !important; width: 0 !important; }
                  .admin-mobile-nav { display: flex !important; }
                  .admin-workspace { flex-direction: column !important; }
                  .admin-main-content { width: 100% !important; max-width: 100% !important; padding: 16px !important; box-sizing: border-box !important; }
                }
                @media (min-width: 768px) {
                  .admin-desktop-sidebar { display: flex !important; width: 220px !important; flex-shrink: 0 !important; }
                  .admin-mobile-nav { display: none !important; }
                  .admin-workspace { flex-direction: row !important; }
                  .admin-main-content { flex: 1 !important; padding: 24px !important; }
                }
              `,
            }}
          />
        ) : null}

        {/* 1. Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.brandTitle}>BeBig Admin</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{role.toUpperCase()}</Text>
            </View>
          </View>
          <Pressable
            testID="admin-exit-button"
            style={styles.exitButton}
            onPress={() => router.replace('/home')}
          >
            <Text style={styles.exitButtonText}>Exit to App</Text>
          </Pressable>
        </View>

        {/* 2. Mobile Horizontal Navigation Bar (Only on width < 768) */}
        {!isDesktop ? (
          <View
            testID="admin-mobile-nav"
            style={styles.mobileNavContainer}
            {...({ dataSet: { class: 'admin-mobile-nav' } } as any)}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mobileNavContent}
            >
              {links.map((link) => {
                const isActive = isNavLinkActive(link);
                return (
                  <Pressable
                    key={link.name}
                    testID={`admin-nav-${link.matchTab}`}
                    style={[
                      styles.mobileNavItem,
                      isActive && styles.mobileNavItemActive,
                    ]}
                    onPress={() => router.push(link.path as any)}
                  >
                    <Text
                      style={[
                        styles.mobileNavText,
                        isActive && styles.mobileNavTextActive,
                      ]}
                    >
                      {link.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* 3. Main Workspace Container */}
        <View
          style={[
            styles.workspace,
            { flexDirection: isDesktop ? 'row' : 'column' },
          ]}
          {...({ dataSet: { class: 'admin-workspace' } } as any)}
        >
          {/* Desktop Sidebar Navigation (Only on width >= 768) */}
          {isDesktop ? (
            <View
              testID="admin-desktop-sidebar"
              style={styles.sidebar}
              {...({ dataSet: { class: 'admin-desktop-sidebar' } } as any)}
            >
              <ScrollView showsVerticalScrollIndicator={false}>
                {links.map((link) => {
                  const isActive = isNavLinkActive(link);
                  return (
                    <Pressable
                      key={link.name}
                      testID={`admin-sidebar-nav-${link.matchTab}`}
                      style={[
                        styles.sidebarItem,
                        isActive && styles.sidebarItemActive,
                      ]}
                      onPress={() => router.push(link.path as any)}
                    >
                      <Text
                        style={[
                          styles.sidebarText,
                          isActive && styles.sidebarTextActive,
                        ]}
                      >
                        {link.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* Content Area (100% width on mobile) */}
          <View
            style={[
              styles.mainContent,
              { padding: isDesktop ? spacing.lg : spacing.md },
            ]}
            {...({ dataSet: { class: 'admin-main-content' } } as any)}
          >
            <Slot />
          </View>
        </View>
      </SafeAreaView>
    </AdminLayoutContext.Provider>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  errorTitle: {
    ...typography.titleLarge,
    color: colors.error,
    marginBottom: spacing.xs,
  },
  errorSubtext: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  homeButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.sm,
  },
  homeButtonText: {
    ...typography.bodyBold,
    color: colors.primaryText,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 52,
    width: '100%',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  roleBadge: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  roleBadgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  exitButton: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  exitButtonText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  mobileNavContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.xs + 2,
    width: '100%',
  },
  mobileNavContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  mobileNavItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mobileNavItemActive: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.primary,
  },
  mobileNavText: {
    ...typography.label,
    fontSize: 13,
    color: colors.textMuted,
  },
  mobileNavTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  workspace: {
    flex: 1,
    width: '100%',
    minWidth: 0,
  },
  sidebar: {
    width: 220,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    flexShrink: 0,
  },
  sidebarItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sidebarItemActive: {
    backgroundColor: colors.surfaceSubtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  sidebarText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  sidebarTextActive: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  mainContent: {
    flex: 1,
    backgroundColor: colors.background,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
});




