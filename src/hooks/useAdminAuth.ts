import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../features/auth';

export type AdminRole = 'super_admin' | 'admin' | 'coach' | 'support' | 'content_manager' | 'developer' | 'none';

export function useAdminAuth() {
  const { user, status } = useAuthStore();
  const [role, setRole] = useState<AdminRole>('none');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Safety timeout: prevent indefinite loading if auth init or network call hangs
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    }, 3000);

    async function checkAdminRole() {
      if (status === 'initializing') {
        return; // wait for auth to finish
      }

      if (!user) {
        if (isMounted) {
          setRole('none');
          setIsLoading(false);
          clearTimeout(timeoutId);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from('admin_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error) {
          if (isMounted) {
            setRole('none');
            if (error.code !== 'PGRST116') {
              console.error('Error fetching admin role:', error);
              setError(error as any);
            }
          }
        } else if (data && isMounted) {
          setRole(data.role as AdminRole);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err);
          setRole('none');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          clearTimeout(timeoutId);
        }
      }
    }

    checkAdminRole();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [user, status]);

  const hasAdminAccess = ['super_admin', 'admin', 'coach', 'support', 'content_manager', 'developer'].includes(role);
  
  // Specific role checks
  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'super_admin' || role === 'admin';
  const isCoach = role === 'coach';
  
  return {
    role,
    isLoading,
    hasAdminAccess,
    isSuperAdmin,
    isAdmin,
    isCoach,
    error
  };
}
