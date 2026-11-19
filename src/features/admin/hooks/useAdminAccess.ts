/**
 * BeBig 2.0 — Fail-Closed Admin Access Hook (Milestone 1)
 *
 * Checks the authenticated user's `profiles.is_admin` flag (with backwards
 * compatibility for `admin_roles`) via `adminService.checkAdminAccess`.
 * Strictly returns `isAdmin: false` for guests and unauthenticated users
 * without performing any network calls.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../auth';
import { adminService, AdminAccessRole } from '../services/adminService';

export interface UseAdminAccessResult {
  isAdmin: boolean;
  isLoading: boolean;
  role: AdminAccessRole;
  refresh: () => Promise<void>;
}

const ACCESS_CHECK_TIMEOUT_MS = 3500;

export function useAdminAccess(): UseAdminAccessResult {
  const status = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const isGuest = useAuthStore((state) => state.isGuest);

  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<AdminAccessRole>('none');
  const [isLoading, setIsLoading] = useState(true);

  const runCheck = useCallback(async () => {
    if (status === 'initializing') {
      setIsLoading(true);
      return;
    }

    // Strictly fail closed for guests and unauthenticated users (zero network calls)
    if (status !== 'authenticated' || isGuest || !userId) {
      setIsAdmin(false);
      setRole('none');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await adminService.checkAdminAccess(userId);
      setIsAdmin(result.isAdmin);
      setRole(result.role);
    } catch {
      setIsAdmin(false);
      setRole('none');
    } finally {
      setIsLoading(false);
    }
  }, [status, isGuest, userId]);

  useEffect(() => {
    let isMounted = true;

    if (status === 'initializing') {
      setIsLoading(true);
      return;
    }

    if (status !== 'authenticated' || isGuest || !userId) {
      setIsAdmin(false);
      setRole('none');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const timeoutId = setTimeout(() => {
      if (isMounted) {
        setIsAdmin(false);
        setRole('none');
        setIsLoading(false);
      }
    }, ACCESS_CHECK_TIMEOUT_MS);

    void (async () => {
      try {
        const result = await adminService.checkAdminAccess(userId);
        if (isMounted) {
          setIsAdmin(result.isAdmin);
          setRole(result.role);
        }
      } catch {
        if (isMounted) {
          setIsAdmin(false);
          setRole('none');
        }
      } finally {
        clearTimeout(timeoutId);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [status, isGuest, userId]);

  return {
    isAdmin,
    isLoading,
    role,
    refresh: runCheck,
  };
}
