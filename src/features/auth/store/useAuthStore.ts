import { create } from 'zustand';
import { guestStorage } from '../../../lib/storage';
import { isSupabaseConfigured } from '../../../lib/supabase';
import { OnboardingState } from '../../onboarding/types';
import { authService } from '../services/authService';
import { AuthSession, AuthState, GuestSession } from '../types';
import { purgeLegacyUnscopedStorage } from '../utils/userScope';
import { workoutStorage } from '../../workout/storage/workoutStorage';
import { templateStorage } from '../../templates/storage/templateStorage';
import { customExerciseStorage } from '../../exercises/storage/customExerciseStorage';

interface AuthActions {
  initializeAuth: () => Promise<void>;
  setSession: (session: AuthSession | null) => void;
  enterGuestMode: (onboardingData?: OnboardingState) => Promise<void>;
  exitGuestMode: () => Promise<void>;
  setError: (error: string | null) => void;
  signOut: () => Promise<void>;
}

let authSubscription: { unsubscribe: () => void } | null = null;

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  status: 'initializing',
  user: null,
  session: null,
  guestSession: null,
  isGuest: false,
  isConfigured: isSupabaseConfigured(),
  error: null,

  initializeAuth: async () => {
    // Purge legacy unscoped storage records so old global test data is never leaked
    void purgeLegacyUnscopedStorage();

    const configured = isSupabaseConfigured();
    set({ isConfigured: configured });

    try {
      // 1. Check for active Supabase session (cloud authenticated user has precedence)
      if (configured) {
        const currentSession = await authService.getCurrentSession();
        if (currentSession) {
          set({
            status: 'authenticated',
            isGuest: false,
            user: currentSession.user,
            session: currentSession,
            guestSession: null,
            error: null,
          });

          // Ensure single active subscription
          if (authSubscription) {
            authSubscription.unsubscribe();
          }

          authSubscription = authService.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
              set({
                status: session ? 'authenticated' : 'unauthenticated',
                isGuest: false,
                user: session ? session.user : null,
                session: session,
                guestSession: null,
              });
            } else if (event === 'SIGNED_OUT') {
              workoutStorage.clearMemoryCache();
              templateStorage.clearMemoryCache();
              customExerciseStorage.clearMemoryCache();
              set({
                status: 'unauthenticated',
                isGuest: false,
                user: null,
                session: null,
                guestSession: null,
              });
            }
          });
          return;
        }
      }

      // 2. If no cloud session, check for active local guest session
      const storedGuestSession = await guestStorage.getGuestSession();
      if (storedGuestSession) {
        set({
          status: 'guest',
          isGuest: true,
          guestSession: storedGuestSession,
          user: null,
          session: null,
          error: null,
        });
        return;
      }

      // 3. Otherwise unauthenticated
      set({
        status: 'unauthenticated',
        isGuest: false,
        user: null,
        session: null,
        guestSession: null,
      });

      // Still attach auth state listener if Supabase is configured
      if (configured) {
        if (authSubscription) {
          authSubscription.unsubscribe();
        }
        authSubscription = authService.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            set({
              status: session ? 'authenticated' : 'unauthenticated',
              isGuest: false,
              user: session ? session.user : null,
              session: session,
              guestSession: null,
            });
          } else if (event === 'SIGNED_OUT') {
            set({
              status: 'unauthenticated',
              isGuest: false,
              user: null,
              session: null,
              guestSession: null,
            });
          }
        });
      }
    } catch {
      set({
        status: 'unauthenticated',
        isGuest: false,
        user: null,
        session: null,
        guestSession: null,
      });
    }
  },

  setSession: (session: AuthSession | null) => {
    set({
      status: session ? 'authenticated' : 'unauthenticated',
      isGuest: false,
      user: session ? session.user : null,
      session,
      guestSession: null,
      error: null,
    });
  },

  enterGuestMode: async (onboardingData?: OnboardingState) => {
    const now = new Date().toISOString();
    const guestSession: GuestSession = {
      id: `guest_${Date.now()}`,
      createdAt: now,
      lastActiveAt: now,
    };

    await guestStorage.setGuestSession(guestSession);
    if (onboardingData) {
      await guestStorage.saveOnboardingData({
        ...onboardingData,
        hasCompletedOnboarding: true,
      });
    }

    set({
      status: 'guest',
      isGuest: true,
      guestSession,
      user: null,
      session: null,
      error: null,
    });
  },

  exitGuestMode: async () => {
    workoutStorage.clearMemoryCache();
    templateStorage.clearMemoryCache();
    customExerciseStorage.clearMemoryCache();
    await guestStorage.clearGuestSession();
    // Preserves local onboarding and workout preferences per requirement
    set({
      status: 'unauthenticated',
      isGuest: false,
      guestSession: null,
      error: null,
    });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  signOut: async () => {
    workoutStorage.clearMemoryCache();
    templateStorage.clearMemoryCache();
    customExerciseStorage.clearMemoryCache();
    const state = useAuthStore.getState();
    if (state.isGuest) {
      await guestStorage.clearGuestSession();
    } else {
      await authService.signOut();
    }
    set({
      status: 'unauthenticated',
      isGuest: false,
      user: null,
      session: null,
      guestSession: null,
      error: null,
    });
  },
}));
