import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, radii, typography } from '../../../src/constants/theme';
import {
  getAdminUserDetails,
  AdminUserDetails,
} from '../../../src/features/admin/api/userManagement';

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [user, setUser] = useState<AdminUserDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetails = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await getAdminUserDetails(id);
      if (!data) {
        setError('User account not found');
      } else {
        setUser(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load user details');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const formatEnumValue = (val?: string | null) => {
    if (!val) return 'Not specified';
    return val
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.dark.primary} />
        <Text style={styles.loadingText}>Loading user profile...</Text>
      </View>
    );
  }

  if (error || !user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Error Loading User</Text>
        <Text style={styles.errorMessage}>{error || 'User not found'}</Text>
        <Pressable style={styles.retryButton} onPress={loadDetails}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>← Back to Users</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Back Bar */}
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back to Users List</Text>
        </Pressable>
      </View>

      {/* Main Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>
            {(user.display_name || user.email || 'U')[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.profileHeaderDetails}>
          <Text style={styles.profileName} numberOfLines={1} ellipsizeMode="tail">
            {user.display_name || 'No display name'}
          </Text>
          <Text style={styles.profileEmail} numberOfLines={1} ellipsizeMode="tail">
            {user.email || 'No email registered'}
          </Text>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.badge,
                user.onboarding_completed
                  ? styles.badgeOnboarded
                  : styles.badgePending,
              ]}
            >
              <Text style={styles.badgeText}>
                {user.onboarding_completed ? 'Onboarding Complete' : 'Onboarding Pending'}
              </Text>
            </View>
            {user.role ? (
              <View style={[styles.badge, styles.badgeRole]}>
                <Text style={styles.badgeRoleText}>{user.role}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Identity Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Identity & Account</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>User ID</Text>
          <Text
            style={[styles.infoValue, styles.monoText]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {user.id}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={[styles.infoValue, styles.wrapText]}>
            {user.email || 'N/A'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Display Name</Text>
          <Text style={[styles.infoValue, styles.wrapText]}>
            {user.display_name || 'N/A'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Account Created</Text>
          <Text style={styles.infoValue}>{formatDate(user.created_at)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Last Sign In</Text>
          <Text style={styles.infoValue}>
            {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : 'Never'}
          </Text>
        </View>
      </View>

      {/* Training / Profile Metadata Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Training & Physical Profile</Text>

        <View style={styles.gridRow}>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Height</Text>
            <Text style={styles.gridValue}>{user.height || 'Not set'}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Weight</Text>
            <Text style={styles.gridValue}>{user.weight || 'Not set'}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Age</Text>
            <Text style={styles.gridValue}>
              {user.age !== null && user.age !== undefined ? user.age : 'Not set'}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Primary Goal</Text>
          <Text style={[styles.infoValue, styles.wrapText]}>
            {formatEnumValue(user.goal)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Experience Level</Text>
          <Text style={[styles.infoValue, styles.wrapText]}>
            {formatEnumValue(user.experience_level)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Training Frequency</Text>
          <Text style={styles.infoValue}>
            {user.days_per_week ? `${user.days_per_week} days / week` : 'Not set'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Workout Duration</Text>
          <Text style={[styles.infoValue, styles.wrapText]}>
            {formatEnumValue(user.workout_duration)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Available Equipment</Text>
          <Text style={[styles.infoValue, styles.wrapText]}>
            {formatEnumValue(user.equipment)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Workout Style</Text>
          <Text style={[styles.infoValue, styles.wrapText]}>
            {formatEnumValue(user.workout_style)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Preferred Days</Text>
          <Text style={[styles.infoValue, styles.wrapText]}>
            {user.preferred_training_days && user.preferred_training_days.length > 0
              ? user.preferred_training_days.join(', ')
              : 'Not set'}
          </Text>
        </View>
      </View>

      {/* Admin Authorization Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Admin Security & Permissions</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Assigned Admin Role</Text>
          <Text
            style={[
              styles.infoValue,
              user.role ? styles.roleHighlight : styles.noRoleText,
            ]}
          >
            {user.role ? user.role.toUpperCase() : 'None (Standard User)'}
          </Text>
        </View>

        <View style={styles.readOnlyNotice}>
          <Text style={styles.readOnlyNoticeText}>
            🔒 Read-only security boundary. Role modifications, user suspensions, and destructive actions are restricted and must be executed via secure server functions.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  topBar: {
    marginBottom: spacing.xs,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.dark.surface,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.dark.border,
    minHeight: 38,
    justifyContent: 'center',
  },
  backButtonText: {
    ...typography.label,
    color: colors.dark.textSecondary,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dark.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.dark.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.dark.primary,
  },
  avatarText: {
    ...typography.titleMedium,
    color: colors.dark.primary,
    fontWeight: 'bold',
  },
  profileHeaderDetails: {
    flex: 1,
    flexShrink: 1,
  },
  profileName: {
    ...typography.titleMedium,
    color: colors.dark.textPrimary,
    marginBottom: 2,
  },
  profileEmail: {
    ...typography.body,
    fontSize: 13,
    color: colors.dark.textSecondary,
    marginBottom: spacing.xs + 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  badgeOnboarded: {
    backgroundColor: '#064E3B',
  },
  badgePending: {
    backgroundColor: colors.dark.surfaceSubtle,
  },
  badgeText: {
    ...typography.caption,
    color: colors.dark.textPrimary,
    fontWeight: '600',
  },
  badgeRole: {
    backgroundColor: colors.dark.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.dark.primary,
  },
  badgeRoleText: {
    ...typography.caption,
    color: colors.dark.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.dark.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dark.border,
    padding: spacing.md,
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.dark.textPrimary,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
    paddingBottom: spacing.xs + 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
    gap: spacing.md,
  },
  infoLabel: {
    ...typography.body,
    fontSize: 13,
    color: colors.dark.textSecondary,
  },
  infoValue: {
    ...typography.body,
    fontSize: 13,
    fontWeight: '500',
    color: colors.dark.textPrimary,
    textAlign: 'right',
  },
  wrapText: {
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  monoText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.dark.textSecondary,
    maxWidth: 200,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.dark.surfaceSubtle,
    borderRadius: radii.sm,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  gridItem: {
    alignItems: 'center',
    flex: 1,
  },
  gridLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.dark.textMuted,
    marginBottom: 2,
  },
  gridValue: {
    ...typography.titleMedium,
    color: colors.dark.primary,
    fontSize: 15,
  },
  roleHighlight: {
    color: colors.dark.primary,
    fontWeight: 'bold',
  },
  noRoleText: {
    color: colors.dark.textMuted,
  },
  readOnlyNotice: {
    marginTop: spacing.sm + 2,
    backgroundColor: colors.dark.surfaceSubtle,
    borderRadius: radii.sm,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  readOnlyNoticeText: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 18,
    color: colors.dark.textSecondary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.dark.background,
  },
  loadingText: {
    ...typography.body,
    color: colors.dark.textSecondary,
    marginTop: spacing.md,
  },
  errorTitle: {
    ...typography.titleLarge,
    color: colors.dark.error,
    marginBottom: spacing.xs,
  },
  errorMessage: {
    ...typography.body,
    color: colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.dark.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.xs,
    marginBottom: spacing.xs,
  },
  retryButtonText: {
    ...typography.bodyBold,
    color: colors.dark.primaryText,
  },
  backLink: {
    padding: spacing.xs,
  },
  backLinkText: {
    ...typography.body,
    color: colors.dark.textSecondary,
  },
});


