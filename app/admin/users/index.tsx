import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radii, typography } from '../../../src/constants/theme';
import {
  getAdminUsers,
  AdminUserListItem,
} from '../../../src/features/admin/api/userManagement';

const PAGE_LIMIT = 20;

const ROLE_OPTIONS = [
  { label: 'All Roles', value: null },
  { label: 'super_admin', value: 'super_admin' },
  { label: 'admin', value: 'admin' },
  { label: 'coach', value: 'coach' },
  { label: 'support', value: 'support' },
  { label: 'content_manager', value: 'content_manager' },
  { label: 'developer', value: 'developer' },
];

const ONBOARDING_OPTIONS = [
  { label: 'All Onboarding', value: null },
  { label: 'Completed', value: true },
  { label: 'Incomplete', value: false },
];

export default function UsersScreen() {
  const router = useRouter();

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filter state
  const [selectedOnboarding, setSelectedOnboarding] = useState<boolean | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);

  // Data state
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Stale request tracking
  const requestIdRef = useRef(0);

  // Debounce search input changes
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 350);

    return () => clearTimeout(handler);
  }, [searchInput]);

  // Reset page to 1 when filters change
  const handleOnboardingChange = (val: boolean | null) => {
    setSelectedOnboarding(val);
    setPage(1);
  };

  const handleRoleChange = (val: string | null) => {
    setSelectedRole(val);
    setPage(1);
  };

  // Main data fetcher
  const loadUsers = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    const offset = (page - 1) * PAGE_LIMIT;

    try {
      const data = await getAdminUsers({
        searchTerm: debouncedSearch,
        filterOnboarding: selectedOnboarding,
        filterRole: selectedRole,
        pageLimit: PAGE_LIMIT,
        pageOffset: offset,
      });

      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      setUsers(data);
      setHasMore(data.length === PAGE_LIMIT);
    } catch (err: any) {
      if (currentRequestId === requestIdRef.current) {
        setError(err.message || 'Failed to load users');
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [debouncedSearch, selectedOnboarding, selectedRole, page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const formatDate = (isoString: string) => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const renderUserCard = ({ item }: { item: AdminUserListItem }) => {
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => router.push(`/admin/users/${item.id}` as any)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.nameContainer}>
            <Text style={styles.displayName} numberOfLines={1} ellipsizeMode="tail">
              {item.display_name || 'No display name'}
            </Text>
            <Text style={styles.emailText} numberOfLines={1} ellipsizeMode="tail">
              {item.email || 'No email registered'}
            </Text>
          </View>
          {item.role ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{item.role}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusBadge,
                item.onboarding_completed
                  ? styles.statusCompleted
                  : styles.statusIncomplete,
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {item.onboarding_completed ? 'Onboarded' : 'Pending Onboarding'}
              </Text>
            </View>
          </View>

          <Text style={styles.dateText}>Joined {formatDate(item.created_at)}</Text>
        </View>

        <View style={styles.idContainer}>
          <Text style={styles.idLabel}>UUID:</Text>
          <Text style={styles.idText} numberOfLines={1} ellipsizeMode="middle">
            {item.id}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>User Management</Text>
      <Text style={styles.subtitle}>
        View and inspect registered BeBig 2.0 accounts.
      </Text>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by email, name, or ID..."
          placeholderTextColor={colors.dark.textMuted}
          value={searchInput}
          onChangeText={setSearchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchInput !== '' && (
          <Pressable style={styles.clearButton} onPress={() => setSearchInput('')}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </Pressable>
        )}
      </View>

      {/* Filter Horizontal Bars */}
      <View style={styles.filtersSection}>
        {/* Onboarding Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollView}
          contentContainerStyle={styles.filterScrollContent}
        >
          {ONBOARDING_OPTIONS.map((opt) => {
            const isSelected = selectedOnboarding === opt.value;
            return (
              <Pressable
                key={opt.label}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => handleOnboardingChange(opt.value)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Role Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollView}
          contentContainerStyle={styles.filterScrollContent}
        >
          {ROLE_OPTIONS.map((opt) => {
            const isSelected = selectedRole === opt.value;
            return (
              <Pressable
                key={opt.label}
                style={[styles.chip, isSelected && styles.chipActiveRole]}
                onPress={() => handleRoleChange(opt.value)}
              >
                <Text
                  style={[
                    styles.chipText,
                    isSelected && styles.chipTextActiveRole,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Main List Area */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.dark.primary} />
          <Text style={styles.loadingText}>Loading accounts...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle}>Error Loading Users</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadUsers}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : users.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyTitle}>No Users Found</Text>
          <Text style={styles.emptySubtitle}>
            No accounts match your search or filter criteria.
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUserCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        />
      )}

      {/* Pagination Footer */}
      {!isLoading && !error && (
        <View style={styles.paginationFooter}>
          <Pressable
            style={[styles.pageButton, page === 1 && styles.pageButtonDisabled]}
            disabled={page === 1}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
          >
            <Text
              style={[
                styles.pageButtonText,
                page === 1 && styles.pageButtonTextDisabled,
              ]}
            >
              Previous
            </Text>
          </Pressable>

          <Text style={styles.pageIndicator}>Page {page}</Text>

          <Pressable
            style={[styles.pageButton, !hasMore && styles.pageButtonDisabled]}
            disabled={!hasMore}
            onPress={() => setPage((p) => p + 1)}
          >
            <Text
              style={[
                styles.pageButtonText,
                !hasMore && styles.pageButtonTextDisabled,
              ]}
            >
              Next
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  title: {
    ...typography.titleLarge,
    color: colors.dark.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.dark.textSecondary,
    marginBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dark.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    color: colors.dark.textPrimary,
    height: 44,
    fontSize: 14,
  },
  clearButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  clearButtonText: {
    ...typography.caption,
    color: colors.dark.textSecondary,
    fontWeight: '600',
  },
  filtersSection: {
    marginBottom: spacing.sm,
    gap: spacing.xs + 2,
  },
  filterScrollView: {
    flexGrow: 0,
  },
  filterScrollContent: {
    paddingRight: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: colors.dark.surface,
    borderWidth: 1,
    borderColor: colors.dark.border,
    marginRight: spacing.xs + 2,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.dark.surfaceSubtle,
    borderColor: colors.dark.primary,
  },
  chipActiveRole: {
    backgroundColor: '#1E293B',
    borderColor: colors.dark.primary,
  },
  chipText: {
    ...typography.caption,
    color: colors.dark.textMuted,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.dark.primary,
    fontWeight: '600',
  },
  chipTextActiveRole: {
    color: colors.dark.primary,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.dark.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dark.border,
    padding: spacing.md,
  },
  cardPressed: {
    backgroundColor: colors.dark.surfaceSubtle,
    borderColor: colors.dark.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  nameContainer: {
    flex: 1,
    marginRight: spacing.sm,
    flexShrink: 1,
  },
  displayName: {
    ...typography.bodyBold,
    color: colors.dark.textPrimary,
    marginBottom: 2,
  },
  emailText: {
    ...typography.body,
    fontSize: 13,
    color: colors.dark.textSecondary,
  },
  roleBadge: {
    backgroundColor: colors.dark.surfaceSubtle,
    borderColor: colors.dark.primary,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  roleBadgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: colors.dark.primary,
    textTransform: 'uppercase',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginBottom: spacing.xs + 2,
  },
  statusContainer: {
    flexDirection: 'row',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  statusCompleted: {
    backgroundColor: '#064E3B',
  },
  statusIncomplete: {
    backgroundColor: colors.dark.surfaceSubtle,
  },
  statusBadgeText: {
    ...typography.caption,
    color: colors.dark.textPrimary,
    fontWeight: '500',
  },
  dateText: {
    ...typography.caption,
    color: colors.dark.textMuted,
  },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
    paddingTop: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: colors.dark.border,
  },
  idLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.dark.textMuted,
    fontWeight: '600',
  },
  idText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.dark.textSecondary,
    fontFamily: 'monospace',
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
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
  },
  retryButtonText: {
    ...typography.bodyBold,
    color: colors.dark.primaryText,
  },
  emptyTitle: {
    ...typography.titleLarge,
    color: colors.dark.textPrimary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.dark.textSecondary,
    textAlign: 'center',
  },
  paginationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.dark.border,
  },
  pageButton: {
    backgroundColor: colors.dark.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.dark.border,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    ...typography.label,
    color: colors.dark.textPrimary,
  },
  pageButtonTextDisabled: {
    color: colors.dark.textMuted,
  },
  pageIndicator: {
    ...typography.body,
    color: colors.dark.textSecondary,
    fontSize: 13,
  },
});


