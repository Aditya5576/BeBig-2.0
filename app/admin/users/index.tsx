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
import { colors } from '../../../src/constants/theme';
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
      setPage(1); // reset to page 1 on new search
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

      // Ignore response if a newer request was dispatched
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
            <Text style={styles.displayName}>
              {item.display_name || 'No display name'}
            </Text>
            <Text style={styles.emailText}>{item.email || 'No email'}</Text>
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

        <Text style={styles.idText}>ID: {item.id}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>User Management</Text>
      <Text style={styles.subtitle}>
        View and inspect all accounts registered on BeBig 2.0.
      </Text>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by email, name, or ID..."
          placeholderTextColor="#666"
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
          <Text style={styles.loadingText}>Loading users...</Text>
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
    backgroundColor: '#0a0a0a',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    height: 44,
    fontSize: 14,
  },
  clearButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearButtonText: {
    color: '#888',
    fontSize: 12,
  },
  filtersSection: {
    marginBottom: 12,
    gap: 8,
  },
  filterScrollView: {
    flexGrow: 0,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#282828',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#262626',
    borderColor: colors.dark.primary,
  },
  chipActiveRole: {
    backgroundColor: '#1e293b',
    borderColor: '#38bdf8',
  },
  chipText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.dark.primary,
    fontWeight: '600',
  },
  chipTextActiveRole: {
    color: '#38bdf8',
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#121212',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222',
    padding: 16,
  },
  cardPressed: {
    backgroundColor: '#1a1a1a',
    borderColor: '#333',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  nameContainer: {
    flex: 1,
    marginRight: 8,
  },
  displayName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  emailText: {
    color: '#aaa',
    fontSize: 13,
  },
  roleBadge: {
    backgroundColor: '#1e293b',
    borderColor: '#38bdf8',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusCompleted: {
    backgroundColor: '#064e3b',
  },
  statusIncomplete: {
    backgroundColor: '#27272a',
  },
  statusBadgeText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '500',
  },
  dateText: {
    color: '#666',
    fontSize: 12,
  },
  idText: {
    color: '#444',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
  },
  retryButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  paginationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  pageButton: {
    backgroundColor: '#1c1c1c',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  pageButtonTextDisabled: {
    color: '#666',
  },
  pageIndicator: {
    color: '#888',
    fontSize: 13,
  },
});
