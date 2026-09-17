import { supabase } from '../../../lib/supabase';

export interface AdminUserListItem {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  onboarding_completed: boolean;
  role: string | null;
}

export interface AdminUserDetails {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  display_name: string | null;
  onboarding_completed: boolean;
  height: string | null;
  weight: string | null;
  age: number | null;
  goal: string | null;
  experience_level: string | null;
  days_per_week: number | null;
  workout_duration: string | null;
  equipment: string | null;
  preferred_training_days: string[] | null;
  workout_style: string | null;
  role: string | null;
}

export interface GetAdminUsersParams {
  searchTerm?: string;
  filterOnboarding?: boolean | null;
  filterRole?: string | null;
  pageLimit?: number;
  pageOffset?: number;
}

/**
 * Fetch paginated list of users for Admin User Management.
 * Calls RPC `admin_get_users`.
 */
export async function getAdminUsers(
  params: GetAdminUsersParams = {}
): Promise<AdminUserListItem[]> {
  const {
    searchTerm = '',
    filterOnboarding = null,
    filterRole = null,
    pageLimit = 20,
    pageOffset = 0,
  } = params;

  const { data, error } = await supabase.rpc('admin_get_users', {
    search_term: searchTerm.trim() || null,
    filter_onboarding: filterOnboarding,
    filter_role: filterRole && filterRole.trim() !== '' ? filterRole.trim() : null,
    page_limit: pageLimit,
    page_offset: pageOffset,
  });

  if (error) {
    throw new Error(error.message || 'Failed to fetch admin user list');
  }

  return (data || []) as AdminUserListItem[];
}

/**
 * Fetch specific user details for Admin User Detail view.
 * Calls RPC `admin_get_user_details`.
 */
export async function getAdminUserDetails(
  targetUserId: string
): Promise<AdminUserDetails | null> {
  if (!targetUserId) {
    throw new Error('Target user ID is required');
  }

  const { data, error } = await supabase.rpc('admin_get_user_details', {
    target_user_id: targetUserId,
  });

  if (error) {
    throw new Error(error.message || 'Failed to fetch user details');
  }

  const userList = (data || []) as AdminUserDetails[];
  return userList.length > 0 ? userList[0] : null;
}
