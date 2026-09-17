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
import { colors } from '../../../src/constants/theme';
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
          <Text style={styles.profileName}>
            {user.display_name || 'No display name'}
          </Text>
          <Text style={styles.profileEmail}>{user.email || 'No email registered'}</Text>
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
          <Text style={[styles.infoValue, styles.monoText]}>{user.id}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user.email || 'N/A'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Display Name</Text>
          <Text style={styles.infoValue}>{user.display_name || 'N/A'}</Text>
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
          <Text style={styles.infoValue}>{formatEnumValue(user.goal)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Experience Level</Text>
          <Text style={styles.infoValue}>
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
          <Text style={styles.infoValue}>
            {formatEnumValue(user.workout_duration)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Available Equipment</Text>
          <Text style={styles.infoValue}>{formatEnumValue(user.equipment)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Workout Style</Text>
          <Text style={styles.infoValue}>
            {formatEnumValue(user.workout_style)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Preferred Days</Text>
          <Text style={styles.infoValue}>
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
    backgroundColor: '#0a0a0a',
  },
  content: {
    paddingBottom: 40,
    gap: 16,
  },
  topBar: {
    marginBottom: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#161616',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#282828',
  },
  backButtonText: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    padding: 20,
    gap: 16,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.dark.primary,
  },
  avatarText: {
    color: colors.dark.primary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileHeaderDetails: {
    flex: 1,
  },
  profileName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  profileEmail: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeOnboarded: {
    backgroundColor: '#064e3b',
  },
  badgePending: {
    backgroundColor: '#27272a',
  },
  badgeText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '600',
  },
  badgeRole: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  badgeRoleText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    padding: 20,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    paddingBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#181818',
  },
  infoLabel: {
    color: '#888',
    fontSize: 14,
  },
  infoValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  monoText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#aaa',
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#161616',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  gridItem: {
    alignItems: 'center',
    flex: 1,
  },
  gridLabel: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
  },
  gridValue: {
    color: colors.dark.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  roleHighlight: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  noRoleText: {
    color: '#666',
  },
  readOnlyNotice: {
    marginTop: 16,
    backgroundColor: '#181818',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#262626',
  },
  readOnlyNoticeText: {
    color: '#888',
    fontSize: 12,
    lineHeight: 18,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
    marginTop: 12,
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: colors.dark.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  backLink: {
    padding: 8,
  },
  backLinkText: {
    color: '#888',
    fontSize: 14,
  },
});
