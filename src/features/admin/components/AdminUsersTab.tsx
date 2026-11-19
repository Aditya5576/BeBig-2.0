import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '../../theme';
import {
  FONT_FAMILIES,
  NUMERIC_TABULAR_STYLE,
  radii,
  spacing,
  typography,
} from '../../../constants/theme';
import type { AdminDirectoryUser } from '../services/adminService';

export interface AdminUsersTabProps {
  users: AdminDirectoryUser[];
  notice?: string;
  searchQuery: string;
  onChangeSearch: (query: string) => void;
  onQuickAssignUser: (user: AdminDirectoryUser) => void;
}

function formatShortDate(iso: string | null): string {
  if (!iso) return 'No workouts yet';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Recently';
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function AdminUsersTab({
  users,
  notice,
  searchQuery,
  onChangeSearch,
  onQuickAssignUser,
}: AdminUsersTabProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.user_id.toLowerCase().includes(q),
    );
  }, [users, searchQuery]);

  return (
    <View testID="admin-panel-users" style={styles.container}>
      {notice ? (
        <View style={styles.noticeBanner} testID="admin-users-notice">
          <Text style={styles.noticeBannerText}>{notice}</Text>
        </View>
      ) : null}

      <View style={styles.searchCard}>
        <Text style={styles.sectionTitle}>User Directory & Support</Text>
        <TextInput
          testID="admin-user-search-input"
          style={styles.searchInput}
          placeholder="Search athletes by name or email..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={onChangeSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.resultCountText} testID="admin-user-count">
          Showing {filteredUsers.length} of {users.length} athletes
        </Text>
      </View>

      {filteredUsers.length === 0 ? (
        <View style={styles.emptyCard} testID="admin-users-empty">
          <Text style={styles.emptyText}>No matching users found.</Text>
        </View>
      ) : (
        <View style={styles.userList}>
          {filteredUsers.map((user) => (
            <View
              key={user.user_id}
              testID={`admin-user-card-${user.user_id}`}
              style={styles.userCard}
            >
              <View style={styles.userInfoCol}>
                <View style={styles.userNameRow}>
                  <Text style={styles.userName}>{user.full_name}</Text>
                  {user.is_admin ? (
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminBadgeText}>ADMIN</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.userEmail}>{user.email || 'No email recorded'}</Text>

                <View style={styles.userStatsRow}>
                  <Text
                    style={styles.userStatPill}
                    testID={`admin-user-workouts-${user.user_id}`}
                  >
                    {user.total_workouts} workouts
                  </Text>
                  <Text style={styles.userStatMeta}>
                    Last active: {formatShortDate(user.last_workout_at)}
                  </Text>
                </View>
              </View>

              <Pressable
                testID={`admin-user-assign-${user.user_id}`}
                style={styles.assignShortcutButton}
                onPress={() => onQuickAssignUser(user)}
              >
                <Text style={styles.assignShortcutText}>Assign Workout</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    container: {
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
    searchCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    sectionTitle: {
      ...typography.titleMedium,
      fontFamily: FONT_FAMILIES.display,
      color: colors.textPrimary,
    },
    searchInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.textPrimary,
      ...typography.body,
    },
    resultCountText: {
      ...typography.caption,
      ...NUMERIC_TABULAR_STYLE,
      color: colors.textMuted,
    },
    emptyCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.lg,
      alignItems: 'center',
    },
    emptyText: {
      ...typography.bodySmall,
      color: colors.textMuted,
    },
    userList: {
      gap: spacing.sm,
    },
    userCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.sm,
    },
    userInfoCol: {
      flex: 1,
      minWidth: 200,
      gap: 4,
    },
    userNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    userName: {
      ...typography.bodyBold,
      fontFamily: FONT_FAMILIES.bodyBold,
      color: colors.textPrimary,
    },
    adminBadge: {
      backgroundColor: 'rgba(56, 189, 248, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(56, 189, 248, 0.4)',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radii.sm,
    },
    adminBadgeText: {
      ...typography.caption,
      fontSize: 10,
      fontFamily: FONT_FAMILIES.bodyBold,
      color: colors.primary,
    },
    userEmail: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    userStatsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: 2,
    },
    userStatPill: {
      ...typography.caption,
      ...NUMERIC_TABULAR_STYLE,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.secondaryAccent,
    },
    userStatMeta: {
      ...typography.caption,
      ...NUMERIC_TABULAR_STYLE,
      color: colors.textMuted,
    },
    assignShortcutButton: {
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
    },
    assignShortcutText: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.primary,
    },
  });
