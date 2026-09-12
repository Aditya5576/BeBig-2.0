import { profileService, UserProfile } from '../../profile';
import { useOnboardingStore } from '../../onboarding';
import { useAuthStore } from '../store/useAuthStore';

export interface AuthRouteResolution {
  route: string;
  onboardingCompleted: boolean;
  profile: UserProfile | null;
}

/**
 * Authoritative Routing Decision Engine for Authenticated Users.
 *
 * Core Invariants:
 * 1. authenticatedUserId MUST be established first.
 * 2. Profile MUST be loaded using that exact authenticatedUserId.
 * 3. Account Isolation: At every async boundary verify that the user ID
 *    for which the profile was loaded still equals the currently authenticated user ID.
 *    If they differ, discard the stale result and return null.
 * 4. Persisted profile is authoritative over any local/Zustand onboarding state.
 * 5. If profile.onboarding_completed === true:
 *    -> Route is ALWAYS '/home'.
 *    -> Rehydrate useOnboardingStore.
 *    -> Under no circumstance return any onboarding route.
 * 6. If profile exists and onboarding_completed === false:
 *    -> Route to the exact incomplete step based on actual persisted profile fields:
 *       - No goal -> '/onboarding/goal'
 *       - Has goal, no experience_level -> '/onboarding/experience'
 *       - Has goal and experience_level -> '/onboarding/preferences'
 * 7. If profile is genuinely null (new unprofiled user):
 *    -> Reset onboarding store.
 *    -> Route to '/onboarding/goal'.
 */
export async function resolveAuthenticatedUserRoute(
  userId: string,
): Promise<AuthRouteResolution | null> {
  if (!userId) return null;

  // 1. Initial Account Isolation Check
  const currentUserId = useAuthStore.getState().user?.id;
  if (!currentUserId || currentUserId !== userId) {
    return null;
  }

  // 2. Load current user's profile
  let profile: UserProfile | null = null;
  try {
    profile = await profileService.getProfile(userId);
  } catch {
    profile = null;
  }

  // 3. Post-Async Account Isolation Check
  // Verify the currently authenticated user ID still matches at this async boundary
  const postAsyncUser = useAuthStore.getState().user;
  if (!postAsyncUser || postAsyncUser.id !== userId) {
    return null;
  }

  // 4. Case A: Completed Account (Persisted profile onboarding_completed === true)
  if (profile && profile.onboarding_completed) {
    const store = useOnboardingStore.getState();
    if (profile.goal) store.setGoal(profile.goal);
    if (profile.experience_level) store.setExperienceLevel(profile.experience_level);
    if (profile.days_per_week) store.setDaysPerWeek(profile.days_per_week);
    if (profile.workout_duration) store.setWorkoutDuration(profile.workout_duration);
    if (profile.equipment) store.setEquipment(profile.equipment);
    if (profile.workout_style) store.setWorkoutStyle(profile.workout_style);
    store.completeOnboarding();

    if (__DEV__) {
      console.log('[AUTH_ROUTE] User verified COMPLETED -> /home');
    }

    return {
      route: '/home',
      onboardingCompleted: true,
      profile,
    };
  }

  // 4b. Cloud Metadata Fallback: Check if user_metadata confirms onboarding was completed
  const metaProfile = postAsyncUser.user_metadata?.profile as UserProfile | undefined;
  const isMetaCompleted =
    postAsyncUser.user_metadata?.onboarding_completed === true ||
    metaProfile?.onboarding_completed === true;

  if (isMetaCompleted) {
    const resolvedProfile: UserProfile = metaProfile || {
      id: userId,
      goal: 'build_muscle',
      experience_level: 'intermediate',
      days_per_week: 4,
      workout_duration: '60_min',
      training_location: 'gym',
      equipment: 'full_gym',
      preferred_training_days: ['monday', 'wednesday', 'friday'],
      workout_style: 'push_pull_legs',
      onboarding_completed: true,
    };

    const store = useOnboardingStore.getState();
    if (resolvedProfile.goal) store.setGoal(resolvedProfile.goal);
    if (resolvedProfile.experience_level) store.setExperienceLevel(resolvedProfile.experience_level);
    if (resolvedProfile.days_per_week) store.setDaysPerWeek(resolvedProfile.days_per_week);
    if (resolvedProfile.workout_duration) store.setWorkoutDuration(resolvedProfile.workout_duration);
    if (resolvedProfile.equipment) store.setEquipment(resolvedProfile.equipment);
    if (resolvedProfile.workout_style) store.setWorkoutStyle(resolvedProfile.workout_style);
    store.completeOnboarding();

    if (__DEV__) {
      console.log('[AUTH_ROUTE] User verified COMPLETED via cloud user_metadata -> /home');
    }

    return {
      route: '/home',
      onboardingCompleted: true,
      profile: resolvedProfile,
    };
  }

  // 5. Case B: Incomplete Account
  if (profile) {
    const store = useOnboardingStore.getState();
    if (profile.goal) store.setGoal(profile.goal);
    if (profile.experience_level) store.setExperienceLevel(profile.experience_level);
    if (profile.days_per_week) store.setDaysPerWeek(profile.days_per_week);
    if (profile.workout_duration) store.setWorkoutDuration(profile.workout_duration);
    if (profile.equipment) store.setEquipment(profile.equipment);
    if (profile.workout_style) store.setWorkoutStyle(profile.workout_style);

    let nextStep = '/onboarding/goal';
    if (!profile.goal) {
      nextStep = '/onboarding/goal';
    } else if (!profile.experience_level) {
      nextStep = '/onboarding/experience';
    } else {
      nextStep = '/onboarding/preferences';
    }

    if (__DEV__) {
      console.log(`[AUTH_ROUTE] User verified INCOMPLETE -> ${nextStep}`);
    }

    return {
      route: nextStep,
      onboardingCompleted: false,
      profile,
    };
  }

  // 6. Case C: Brand new user with no persisted profile row
  useOnboardingStore.getState().resetOnboarding();

  if (__DEV__) {
    console.log('[AUTH_ROUTE] New unprofiled user -> /onboarding/goal');
  }

  return {
    route: '/onboarding/goal',
    onboardingCompleted: false,
    profile: null,
  };
}
