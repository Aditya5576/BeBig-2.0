import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Slot, useRouter, usePathname, Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminAuth } from '../../src/hooks/useAdminAuth';
import { useAuthStore } from '../../src/features/auth';
import { colors, spacing, radii, typography } from '../../src/constants/theme';

export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();

  const { status } = useAuthStore();
  const { isLoading, hasAdminAccess, role } = useAdminAuth();

  // 1. Unauthenticated or not initialized loading state
  if (status === 'initializing' || isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.dark.primary} />
      </View>
    );
  }

  // 2. Unauthenticated -> redirect to login/welcome
  if (status === 'unauthenticated') {
    return <Redirect href="/onboarding/welcome" />;
  }

  // 3. Authenticated but unauthorized screen
  if (!hasAdminAccess) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle}>Unauthorized Access</Text>
          <Text style={styles.errorSubtext}>
            You do not have permission to access the BeBig Admin Panel.
          </Text>
          <Pressable style={styles.homeButton} onPress={() => router.replace('/home')}>
            <Text style={styles.homeButtonText}>Return Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // 4. Navigation Links Definition
  const links = [
    { name: 'Dashboard', path: '/admin' },
    { name: 'Users', path: '/admin/users' },
    { name: 'Coaches', path: '/admin/coaches' },
    { name: 'Exercises', path: '/admin/exercises' },
    { name: 'Templates', path: '/admin/templates' },
    { name: 'Analytics', path: '/admin/analytics' },
    { name: 'Monitoring', path: '/admin/monitoring' },
    { name: 'Cloud Health', path: '/admin/cloud-health' },
    { name: 'Feature Flags', path: '/admin/feature-flags' },
    { name: 'Admins & Roles', path: '/admin/roles' },
    { name: 'Audit Logs', path: '/admin/audit' },
    { name: 'Developer Tools', path: '/admin/dev-tools' },
    { name: 'Settings', path: '/admin/settings' },
  ];

  return (
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
          style={styles.exitButton}
          onPress={() => router.replace('/home')}
        >
          <Text style={styles.exitButtonText}>Exit to App</Text>
        </Pressable>
      </View>

      {/* 2. Mobile Horizontal Navigation Bar */}
      <View
        style={styles.mobileNavContainer}
        {...({ dataSet: { class: 'admin-mobile-nav' } } as any)}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mobileNavContent}
        >
          {links.map((link) => {
            const isActive =
              pathname === link.path ||
              (link.path !== '/admin' && pathname.startsWith(link.path));
            return (
              <Pressable
                key={link.name}
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

      {/* 3. Main Workspace Container */}
      <View
        style={styles.workspace}
        {...({ dataSet: { class: 'admin-workspace' } } as any)}
      >
        {/* Desktop Sidebar Navigation */}
        <View
          style={styles.sidebar}
          {...({ dataSet: { class: 'admin-desktop-sidebar' } } as any)}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {links.map((link) => {
              const isActive =
                pathname === link.path ||
                (link.path !== '/admin' && pathname.startsWith(link.path));
              return (
                <Pressable
                  key={link.name}
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

        {/* Content Area */}
        <View
          style={styles.mainContent}
          {...({ dataSet: { class: 'admin-main-content' } } as any)}
        >
          <Slot />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.dark.background,
  },
  errorTitle: {
    ...typography.titleLarge,
    color: colors.dark.error,
    marginBottom: spacing.xs,
  },
  errorSubtext: {
    ...typography.body,
    color: colors.dark.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  homeButton: {
    backgroundColor: colors.dark.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.sm,
  },
  homeButtonText: {
    ...typography.bodyBold,
    color: colors.dark.primaryText,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.dark.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
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
    color: colors.dark.textPrimary,
  },
  roleBadge: {
    backgroundColor: colors.dark.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.dark.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  roleBadgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: colors.dark.primary,
  },
  exitButton: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.dark.surfaceSubtle,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  exitButtonText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.dark.textSecondary,
  },
  mobileNavContainer: {
    backgroundColor: colors.dark.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
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
    backgroundColor: colors.dark.background,
    borderWidth: 1,
    borderColor: colors.dark.border,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mobileNavItemActive: {
    backgroundColor: colors.dark.surfaceSubtle,
    borderColor: colors.dark.primary,
  },
  mobileNavText: {
    ...typography.label,
    fontSize: 13,
    color: colors.dark.textMuted,
  },
  mobileNavTextActive: {
    color: colors.dark.primary,
    fontWeight: '700',
  },
  workspace: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
  },
  sidebar: {
    width: 220,
    backgroundColor: colors.dark.surface,
    borderRightWidth: 1,
    borderRightColor: colors.dark.border,
  },
  sidebarItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  sidebarItemActive: {
    backgroundColor: colors.dark.surfaceSubtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.dark.primary,
  },
  sidebarText: {
    ...typography.body,
    color: colors.dark.textSecondary,
  },
  sidebarTextActive: {
    ...typography.bodyBold,
    color: colors.dark.primary,
  },
  mainContent: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.dark.background,
    width: '100%',
    maxWidth: '100%',
  },
});




