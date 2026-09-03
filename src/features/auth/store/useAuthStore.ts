import { create } from 'zustand';
import { isSupabaseConfigured } from '../../../lib/supabase';
import { authService } from '../services/authService';
import { AuthSession, AuthState } from '../types';

interface AuthActions {
  initializeAuth: () => Promise<void>;
  setSession: (session: AuthSession | null) => void;
  setError: (error: string | null) => void;
  signOut: () => Promise<void>;
}

let authSubscription: { unsubscribe: () => void } | null = null;

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  status: 'initializing',
  user: null,
  session: null,
  isConfigured: isSupabaseConfigured(),
  error: null,

  initializeAuth: async () => {
    const configured = isSupabaseConfigured();
    set({ isConfigured: configured });

    if (!configured) {
      set({
        status: 'unauthenticated',
        user: null,
        session: null,
      });
      return;
    }

    try {
      const currentSession = await authService.getCurrentSession();
      if (currentSession) {
        set({
          status: 'authenticated',
          user: currentSession.user,
          session: currentSession,
          error: null,
        });
      } else {
        set({
          status: 'unauthenticated',
          user: null,
          session: null,
        });
      }

      // Ensure single active subscription
      if (authSubscription) {
        authSubscription.unsubscribe();
      }

      authSubscription = authService.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          set({
            status: session ? 'authenticated' : 'unauthenticated',
            user: session ? session.user : null,
            session: session,
          });
        } else if (event === 'SIGNED_OUT') {
          set({
            status: 'unauthenticated',
            user: null,
            session: null,
          });
        }
      });
    } catch {
      set({
        status: 'unauthenticated',
        user: null,
        session: null,
      });
    }
  },

  setSession: (session: AuthSession | null) => {
    set({
      status: session ? 'authenticated' : 'unauthenticated',
      user: session ? session.user : null,
      session,
      error: null,
    });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  signOut: async () => {
    await authService.signOut();
    set({
      status: 'unauthenticated',
      user: null,
      session: null,
      error: null,
    });
  },
}));
