import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput, Image, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../src/components/ui';
import { useAuthStore } from '../src/features/auth';
import {
  useOnboardingStore,
  Goal,
  ExperienceLevel,
  WorkoutDuration,
  Equipment,
  DayOfWeek,
  WorkoutStyle,
  ChipGroup,
  SelectableCard,
} from '../src/features/onboarding';
import { profileService, avatarService, UserProfile } from '../src/features/profile';
import { guestStorage } from '../src/lib/storage';
import { colors, spacing, radii } from '../src/constants/theme';

export const ATHLETIC_AVATAR_PRESETS = [
  {
    id: 'barbell',
    label: '🏋️‍♂️ Barbell',
    url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=240&h=240&fit=crop&crop=faces',
  },
  {
    id: 'iron',
    label: '⚡ Iron',
    url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=240&h=240&fit=crop&crop=faces',
  },
  {
    id: 'champion',
    label: '🏆 Champion',
    url: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=240&h=240&fit=crop&crop=faces',
  },
  {
    id: 'runner',
    label: '🏃 Runner',
    url: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=240&h=240&fit=crop&crop=faces',
  },
];

const GOAL_OPTIONS: { id: Goal; title: string; description: string; badge?: string }[] = [
  {
    id: 'build_muscle',
    title: 'Build Muscle',
    description: 'Hypertrophy-focused training to stimulate maximum muscular growth and size.',
    badge: 'Hypertrophy',
  },
  {
    id: 'gain_strength',
    title: 'Gain Strength',
    description: 'Heavy compound movements designed to increase absolute strength and power.',
    badge: 'Strength',
  },
  {
    id: 'lose_fat',
    title: 'Lose Fat',
    description: 'High-density resistance workouts to retain lean muscle while burning calories.',
    badge: 'Conditioning',
  },
];

const EXPERIENCE_OPTIONS: {
  id: ExperienceLevel;
  title: string;
  description: string;
  badge: string;
}[] = [
  {
    id: 'beginner',
    title: 'Beginner',
    description: 'Less than 1 year of structured lifting. Focusing on form and foundational strength.',
    badge: '< 1 Year',
  },
  {
    id: 'intermediate',
    title: 'Intermediate',
    description: '1 to 3 years of consistent gym training. Familiar with main compound lifts.',
    badge: '1–3 Years',
  },
  {
    id: 'advanced',
    title: 'Advanced',
    description: '3+ years of dedicated, structured lifting with periodization and overload tracking.',
    badge: '3+ Years',
  },
];

const DAYS_PER_WEEK_OPTIONS = [
  { label: '2', value: 2, testID: 'days-2' },
  { label: '3', value: 3, testID: 'days-3' },
  { label: '4', value: 4, testID: 'days-4' },
  { label: '5', value: 5, testID: 'days-5' },
  { label: '6', value: 6, testID: 'days-6' },
  { label: '7', value: 7, testID: 'days-7' },
];

const DURATION_OPTIONS: { label: string; value: WorkoutDuration; testID: string }[] = [
  { label: '30 min', value: '30_min', testID: 'duration-30_min' },
  { label: '45 min', value: '45_min', testID: 'duration-45_min' },
  { label: '60 min', value: '60_min', testID: 'duration-60_min' },
  { label: '90+ min', value: '90_plus_min', testID: 'duration-90_plus_min' },
];

const EQUIPMENT_OPTIONS: { id: Equipment; title: string; description: string; testID: string }[] = [
  {
    id: 'full_gym',
    title: 'Gym',
    description: 'Barbells, dumbbells, cable towers, power racks, and specialized machines.',
    testID: 'equipment-full_gym',
  },
  {
    id: 'limited_equipment',
    title: 'Limited Equipment',
    description: 'Free weights, adjustable dumbbells, bench, and pull-up bar.',
    testID: 'equipment-limited_equipment',
  },
];

const DAYS_OF_WEEK_OPTIONS: { label: string; value: DayOfWeek; testID: string }[] = [
  { label: 'Mon', value: 'monday', testID: 'day-monday' },
  { label: 'Tue', value: 'tuesday', testID: 'day-tuesday' },
  { label: 'Wed', value: 'wednesday', testID: 'day-wednesday' },
  { label: 'Thu', value: 'thursday', testID: 'day-thursday' },
  { label: 'Fri', value: 'friday', testID: 'day-friday' },
  { label: 'Sat', value: 'saturday', testID: 'day-saturday' },
  { label: 'Sun', value: 'sunday', testID: 'day-sunday' },
];

const WORKOUT_STYLE_OPTIONS: {
  id: WorkoutStyle;
  title: string;
  description: string;
  badge: string;
  testID: string;
}[] = [
  {
    id: 'push_pull_legs',
    title: 'Push / Pull / Legs',
    description: 'Chest/Shoulders/Triceps, Back/Biceps, and Legs/Abs.',
    badge: 'Popular',
    testID: 'style-push_pull_legs',
  },
  {
    id: 'upper_lower',
    title: 'Upper / Lower',
    description: 'Alternating upper body and lower body focus sessions.',
    badge: 'Balanced',
    testID: 'style-upper_lower',
  },
  {
    id: 'full_body',
    title: 'Full Body',
    description: 'Full body stimulation in every session for high compound frequency.',
    badge: 'High Frequency',
    testID: 'style-full_body',
  },
];

function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    const emailPrefix = email.trim().split('@')[0];
    return emailPrefix.slice(0, 2).toUpperCase();
  }
  return 'BB';
}

export default function SettingsScreen() {
  const router = useRouter();

  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);
  const signOut = useAuthStore((state) => state.signOut);
  const exitGuestMode = useAuthStore((state) => state.exitGuestMode);

  // Personal information state
  const [displayName, setDisplayName] = useState<string>('');
  const [age, setAge] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<any>(null);
  const pendingAvatarFileRef = useRef<{ file: any; mimeType: string } | null>(null);

  // Store training values
  const storeGoal = useOnboardingStore((state) => state.goal);
  const storeExperience = useOnboardingStore((state) => state.experienceLevel);
  const storeDaysPerWeek = useOnboardingStore((state) => state.daysPerWeek);
  const storeDuration = useOnboardingStore((state) => state.workoutDuration);
  const storeEquipment = useOnboardingStore((state) => state.equipment);
  const storeDays = useOnboardingStore((state) => state.preferredTrainingDays);
  const storeStyle = useOnboardingStore((state) => state.workoutStyle);

  const setStoreGoal = useOnboardingStore((state) => state.setGoal);
  const setStoreExperience = useOnboardingStore((state) => state.setExperienceLevel);
  const setStoreDaysPerWeek = useOnboardingStore((state) => state.setDaysPerWeek);
  const setStoreDuration = useOnboardingStore((state) => state.setWorkoutDuration);
  const setStoreEquipment = useOnboardingStore((state) => state.setEquipment);
  const setStorePreferredDays = useOnboardingStore((state) => state.setPreferredTrainingDays);
  const setStoreStyle = useOnboardingStore((state) => state.setWorkoutStyle);
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);

  // Local state for view/edit modes
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Editable draft state
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');

  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [editExperience, setEditExperience] = useState<ExperienceLevel | null>(null);
  const [editDaysPerWeek, setEditDaysPerWeek] = useState<number | null>(null);
  const [editDuration, setEditDuration] = useState<WorkoutDuration | null>(null);
  const [editEquipment, setEditEquipment] = useState<Equipment | null>(null);
  const [editPreferredDays, setEditPreferredDays] = useState<DayOfWeek[]>([]);
  const [editStyle, setEditStyle] = useState<WorkoutStyle | null>(null);

  const editDisplayNameRef = useRef('');
  const editAgeRef = useRef('');
  const editHeightRef = useRef('');
  const editWeightRef = useRef('');
  const editAvatarUrlRef = useRef('');

  const editGoalRef = useRef<Goal | null>(null);
  const editExperienceRef = useRef<ExperienceLevel | null>(null);
  const editDaysPerWeekRef = useRef<number | null>(null);
  const editDurationRef = useRef<WorkoutDuration | null>(null);
  const editEquipmentRef = useRef<Equipment | null>(null);
  const editPreferredDaysRef = useRef<DayOfWeek[]>([]);
  const editStyleRef = useRef<WorkoutStyle | null>(null);

  const updateGoal = (g: Goal) => {
    editGoalRef.current = g;
    setEditGoal(g);
  };
  const updateExperience = (e: ExperienceLevel) => {
    editExperienceRef.current = e;
    setEditExperience(e);
  };
  const updateDaysPerWeek = (d: number) => {
    editDaysPerWeekRef.current = d;
    setEditDaysPerWeek(d);
  };
  const updateDuration = (dur: WorkoutDuration) => {
    editDurationRef.current = dur;
    setEditDuration(dur);
  };
  const updateEquipment = (eq: Equipment) => {
    editEquipmentRef.current = eq;
    setEditEquipment(eq);
  };
  const updateStyle = (s: WorkoutStyle) => {
    editStyleRef.current = s;
    setEditStyle(s);
  };

  // Guard: Unauthenticated users are redirected to Welcome
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/onboarding/welcome');
    }
  }, [status, router]);

  // Hydrate profile data on mount safely
  useEffect(() => {
    let isMounted = true;
    const hydrate = async () => {
      try {
        if (user?.id) {
          const profile = await profileService.getProfile(user.id);
          if (profile && isMounted) {
            if (profile.display_name) setDisplayName(profile.display_name);
            if (profile.age !== undefined && profile.age !== null) setAge(profile.age);
            if (profile.height !== undefined && profile.height !== null) setHeight(profile.height);
            if (profile.weight !== undefined && profile.weight !== null) setWeight(profile.weight);
            setAvatarUrl(profile.avatar_url ?? null);

            if (profile.goal) setStoreGoal(profile.goal);
            if (profile.experience_level) setStoreExperience(profile.experience_level);
            if (profile.days_per_week) setStoreDaysPerWeek(profile.days_per_week);
            if (profile.workout_duration) setStoreDuration(profile.workout_duration);
            if (profile.equipment) setStoreEquipment(profile.equipment);
            if (profile.preferred_training_days) setStorePreferredDays(profile.preferred_training_days);
            if (profile.workout_style) setStoreStyle(profile.workout_style);
          }
        } else if (isGuest) {
          const guestData = await guestStorage.getOnboardingData();
          if (guestData && isMounted) {
            if (guestData.goal) setStoreGoal(guestData.goal);
            if (guestData.experienceLevel) setStoreExperience(guestData.experienceLevel);
            if (guestData.daysPerWeek) setStoreDaysPerWeek(guestData.daysPerWeek);
            if (guestData.workoutDuration) setStoreDuration(guestData.workoutDuration);
            if (guestData.equipment) setStoreEquipment(guestData.equipment);
            if (guestData.preferredTrainingDays) setStorePreferredDays(guestData.preferredTrainingDays);
            if (guestData.workoutStyle) setStoreStyle(guestData.workoutStyle);
          }
        }
      } catch {
        // Silently handled
      }
    };
    void hydrate();
    return () => {
      isMounted = false;
    };
  }, [
    user?.id,
    isGuest,
    setStoreGoal,
    setStoreExperience,
    setStoreDaysPerWeek,
    setStoreDuration,
    setStoreEquipment,
    setStorePreferredDays,
    setStoreStyle,
  ]);

  const handleStartEdit = () => {
    pendingAvatarFileRef.current = null;
    editDisplayNameRef.current = displayName;
    editAgeRef.current = age ? String(age) : '';
    editHeightRef.current = height ? String(height) : '';
    editWeightRef.current = weight ? String(weight) : '';
    editAvatarUrlRef.current = avatarUrl || '';

    setEditDisplayName(displayName);
    setEditAge(age ? String(age) : '');
    setEditHeight(height ? String(height) : '');
    setEditWeight(weight ? String(weight) : '');
    setEditAvatarUrl(avatarUrl || '');

    const initGoal = storeGoal || 'build_muscle';
    const initExp = storeExperience || 'intermediate';
    const initDays = storeDaysPerWeek || 4;
    const initDur = storeDuration || '60_min';
    const initEq = storeEquipment || 'full_gym';
    const initPrefDays = storeDays || [];
    const initStyle = storeStyle || 'push_pull_legs';

    editGoalRef.current = initGoal;
    editExperienceRef.current = initExp;
    editDaysPerWeekRef.current = initDays;
    editDurationRef.current = initDur;
    editEquipmentRef.current = initEq;
    editPreferredDaysRef.current = initPrefDays;
    editStyleRef.current = initStyle;

    setEditGoal(initGoal);
    setEditExperience(initExp);
    setEditDaysPerWeek(initDays);
    setEditDuration(initDur);
    setEditEquipment(initEq);
    setEditPreferredDays(initPrefDays);
    setEditStyle(initStyle);

    setSuccessMessage(null);
    setErrorMessage(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    pendingAvatarFileRef.current = null;
    setIsEditing(false);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleToggleDay = (day: DayOfWeek) => {
    const prev = editPreferredDaysRef.current;
    const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
    editPreferredDaysRef.current = next;
    setEditPreferredDays(next);
  };

  const handleSaveProfile = async () => {
    const currentAgeStr = editAgeRef.current !== undefined ? editAgeRef.current : editAge;
    const currentHeightStr = editHeightRef.current !== undefined ? editHeightRef.current : editHeight;
    const currentWeightStr = editWeightRef.current !== undefined ? editWeightRef.current : editWeight;
    const currentNameStr = editDisplayNameRef.current !== undefined ? editDisplayNameRef.current : editDisplayName;
    const currentAvatarStr = editAvatarUrlRef.current !== undefined ? editAvatarUrlRef.current : editAvatarUrl;

    // Validate personal information
    let parsedAge: number | null = null;
    if (currentAgeStr && currentAgeStr.trim()) {
      const num = parseInt(currentAgeStr.trim(), 10);
      if (isNaN(num) || num < 10 || num > 120) {
        setErrorMessage('Age must be between 10 and 120 years.');
        return;
      }
      parsedAge = num;
    }

    let parsedHeight: number | null = null;
    if (currentHeightStr && currentHeightStr.trim()) {
      const num = parseFloat(currentHeightStr.trim());
      if (isNaN(num) || num < 50 || num > 250) {
        setErrorMessage('Height must be between 50 and 250 cm.');
        return;
      }
      parsedHeight = num;
    }

    let parsedWeight: number | null = null;
    if (currentWeightStr && currentWeightStr.trim()) {
      const num = parseFloat(currentWeightStr.trim());
      if (isNaN(num) || num < 20 || num > 300) {
        setErrorMessage('Weight must be between 20 and 300 kg.');
        return;
      }
      parsedWeight = num;
    }

    setSaving(true);
    setErrorMessage(null);

    const updatedGoal = editGoalRef.current || editGoal || storeGoal;
    const updatedExperience = editExperienceRef.current || editExperience || storeExperience;
    const updatedDaysPerWeek = editDaysPerWeekRef.current || editDaysPerWeek || storeDaysPerWeek;
    const updatedDuration = editDurationRef.current || editDuration || storeDuration;
    const updatedEquipment = editEquipmentRef.current || editEquipment || storeEquipment;
    const updatedDays = editPreferredDaysRef.current.length > 0 ? editPreferredDaysRef.current : editPreferredDays;
    const updatedStyle = editStyleRef.current || editStyle || storeStyle;
    const trimmedDisplayName = currentNameStr.trim();
    let trimmedAvatarUrl = currentAvatarStr.trim() || null;

    try {
      let newlyUploadedAvatarUrl: string | null = null;
      if (pendingAvatarFileRef.current && user?.id) {
        setUploadingAvatar(true);
        const { file, mimeType } = pendingAvatarFileRef.current;
        const uploadedUrl = await avatarService.uploadAvatar(user.id, file, mimeType);
        trimmedAvatarUrl = uploadedUrl;
        newlyUploadedAvatarUrl = uploadedUrl;
        setUploadingAvatar(false);
      }

      const previousAvatarUrl = avatarUrl;

      try {
        if (user?.id) {
          await profileService.upsertProfile(user.id, {
            display_name: trimmedDisplayName || null,
            age: parsedAge,
            height: parsedHeight,
            weight: parsedWeight,
            avatar_url: trimmedAvatarUrl,
            goal: updatedGoal,
            experience_level: updatedExperience,
            days_per_week: updatedDaysPerWeek,
            workout_duration: updatedDuration,
            equipment: updatedEquipment,
            preferred_training_days: updatedDays,
            workout_style: updatedStyle,
            onboarding_completed: true,
          });
        } else if (isGuest) {
          const guestData = await guestStorage.getOnboardingData();
          await guestStorage.saveOnboardingData({
            ...guestData,
            goal: updatedGoal,
            experienceLevel: updatedExperience,
            daysPerWeek: updatedDaysPerWeek,
            workoutDuration: updatedDuration,
            trainingLocation: 'gym',
            equipment: updatedEquipment,
            preferredTrainingDays: updatedDays,
            workoutStyle: updatedStyle,
            hasCompletedOnboarding: true,
          });
        }
      } catch (upsertError: any) {
        // If we just uploaded a new avatar but profile save failed, clean up the orphan
        if (newlyUploadedAvatarUrl && user?.id) {
          void avatarService.deleteAvatarByUrl(user.id, newlyUploadedAvatarUrl);
        }
        throw upsertError;
      }

      // Update personal info state
      setDisplayName(trimmedDisplayName);
      setAge(parsedAge);
      setHeight(parsedHeight);
      setWeight(parsedWeight);
      setAvatarUrl(trimmedAvatarUrl);
      setAvatarLoadError(false);

      // Clean up previous avatar if replaced or cleared
      if (user?.id && previousAvatarUrl && previousAvatarUrl !== trimmedAvatarUrl) {
        void avatarService.deleteAvatarByUrl(user.id, previousAvatarUrl);
      }
      pendingAvatarFileRef.current = null;

      // Update store so entire app has updated state
      if (updatedGoal) setStoreGoal(updatedGoal);
      if (updatedExperience) setStoreExperience(updatedExperience);
      if (updatedDaysPerWeek) setStoreDaysPerWeek(updatedDaysPerWeek);
      if (updatedDuration) setStoreDuration(updatedDuration);
      if (updatedEquipment) setStoreEquipment(updatedEquipment);
      setStorePreferredDays(updatedDays);
      if (updatedStyle) setStoreStyle(updatedStyle);

      setSuccessMessage('Fitness profile updated successfully!');
      setIsEditing(false);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
      setUploadingAvatar(false);
    }
  };

  const handleSignOut = async () => {
    if (isGuest) {
      await exitGuestMode();
      resetOnboarding();
      router.replace('/onboarding/welcome');
    } else {
      await signOut();
      resetOnboarding();
      router.replace('/onboarding/welcome');
    }
  };

  const handleClearCache = () => {
    try {
      const { platformStorage } = require('../src/lib/storage');
      platformStorage.clearMemoryCache();
      profileService.clearMemoryCache();
      setSuccessMessage('Local memory and exercise cache cleared.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setErrorMessage('Failed to clear local cache.');
    }
  };

  const handleDevResetOnboarding = () => {
    Alert.alert(
      'Developer Diagnostic Reset',
      'This will reset your local onboarding store to test initial routing. This is for developer verification only.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset & Test Questionnaire',
          style: 'destructive',
          onPress: () => {
            resetOnboarding();
            router.replace('/onboarding/goal' as any);
          },
        },
      ],
    );
  };

  const formatText = (text: string | null | undefined) => {
    if (!text) return 'Not set';
    return text
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const formatEquipment = (eq: Equipment | null | undefined) => {
    if (eq === 'full_gym') return 'Gym (Full Equipment)';
    if (eq === 'limited_equipment') return 'Limited Equipment';
    return 'Not set';
  };

  const formatWorkoutStyle = (ws: WorkoutStyle | null | undefined) => {
    if (ws === 'push_pull_legs') return 'Push / Pull / Legs';
    if (ws === 'upper_lower') return 'Upper / Lower';
    if (ws === 'full_body') return 'Full Body';
    return 'Not set';
  };

  const athleteHeaderName = displayName || (user?.email ? user.email.split('@')[0] : 'Athlete');
  const initials = getInitials(displayName, user?.email);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text
              variant="titleLarge"
              color="primary"
              testID="settings-screen-title"
              style={styles.screenTitle}
            >
              Profile
            </Text>
            <Text variant="caption" color="secondary">
              Manage your athletic identity, training profile, and preferences
            </Text>
          </View>
        </View>

        {/* Success Banner */}
        {successMessage && (
          <View testID="save-success-banner" style={styles.successBanner}>
            <Text variant="caption" color="accent" style={styles.successText}>
              ✓ {successMessage}
            </Text>
          </View>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <View testID="profile-error-banner" style={styles.errorBanner}>
            <Text variant="caption" style={styles.errorText}>
              ⚠ {errorMessage}
            </Text>
          </View>
        )}

        {/* 1. Athlete Profile Header Card */}
        <Card style={styles.profileHeaderCard} testID="settings-profile-header-card">
          <View style={styles.profileHeaderContent}>
            <View style={styles.avatarWrapper}>
              {avatarUrl && !avatarLoadError ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImage}
                  onError={() => setAvatarLoadError(true)}
                  testID="profile-avatar-image"
                />
              ) : (
                <View style={styles.avatarFallback} testID="profile-avatar-fallback">
                  <Text style={styles.avatarInitialsText}>{initials}</Text>
                </View>
              )}
            </View>

            <View style={styles.profileHeaderText}>
              <Text variant="titleMedium" color="primary" testID="profile-header-name">
                {athleteHeaderName}
              </Text>
              {user?.email && (
                <Text variant="caption" color="secondary" testID="profile-header-email">
                  {user.email}
                </Text>
              )}
              <View style={styles.headerBadgeRow}>
                {user ? (
                  <View style={styles.cloudBadge}>
                    <Text variant="caption" color="accent" style={styles.badgeText}>
                      Cloud Synced
                    </Text>
                  </View>
                ) : isGuest ? (
                  <View style={[styles.cloudBadge, styles.guestBadge]}>
                    <Text variant="caption" color="accent" style={styles.guestBadgeText}>
                      Guest Mode
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {!isEditing && (
              <Pressable
                testID="edit-profile-button"
                onPress={handleStartEdit}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.headerEditAction}
                accessibilityLabel="Edit Profile"
                accessibilityRole="button"
              >
                <Text variant="label" color="accent">
                  Edit Profile ›
                </Text>
              </Pressable>
            )}
          </View>
        </Card>

        {!isEditing ? (
          /* ========================================================
             VIEW MODE: Display Personal Info & Training Profile
             ======================================================== */
          <>
            {/* 2. Personal Information Card */}
            <Card style={styles.sectionCard} testID="settings-personal-info-card">
              <View style={styles.cardHeaderRow}>
                <Text variant="label" color="muted">
                  PERSONAL INFORMATION
                </Text>
              </View>

              <View style={styles.fieldRow}>
                <Text variant="caption" color="muted">
                  Display Name
                </Text>
                <Text variant="bodyBold" color="primary" testID="profile-view-name">
                  {displayName || 'Not set'}
                </Text>
              </View>

              <View style={styles.fieldRow}>
                <Text variant="caption" color="muted">
                  Age
                </Text>
                <Text variant="bodyBold" color="primary" testID="profile-view-age">
                  {age ? `${age} yrs` : 'Not set'}
                </Text>
              </View>

              <View style={styles.fieldRow}>
                <Text variant="caption" color="muted">
                  Height
                </Text>
                <Text variant="bodyBold" color="primary" testID="profile-view-height">
                  {height ? `${height} cm` : 'Not set'}
                </Text>
              </View>

              <View style={[styles.fieldRow, styles.noBorder]}>
                <Text variant="caption" color="muted">
                  Weight
                </Text>
                <Text variant="bodyBold" color="primary" testID="profile-view-weight">
                  {weight ? `${weight} kg` : 'Not set'}
                </Text>
              </View>
            </Card>

            {/* 3. Training Profile Card */}
            <Card style={styles.sectionCard} testID="settings-profile-card">
              <View style={styles.cardHeaderRow}>
                <Text variant="label" color="muted">
                  TRAINING PROFILE
                </Text>
              </View>

              <View style={styles.profileViewContainer}>
                <View style={styles.fieldRow}>
                  <Text variant="caption" color="muted">
                    Primary Goal
                  </Text>
                  <Text variant="bodyBold" color="primary" testID="profile-view-goal">
                    {formatText(storeGoal)}
                  </Text>
                </View>

                <View style={styles.fieldRow}>
                  <Text variant="caption" color="muted">
                    Experience Level
                  </Text>
                  <Text variant="bodyBold" color="primary" testID="profile-view-experience">
                    {formatText(storeExperience)}
                  </Text>
                </View>

                <View style={styles.fieldRow}>
                  <Text variant="caption" color="muted">
                    Weekly Frequency
                  </Text>
                  <Text variant="bodyBold" color="primary" testID="profile-view-frequency">
                    {storeDaysPerWeek ? `${storeDaysPerWeek} days / week` : 'Not set'}
                  </Text>
                </View>

                <View style={styles.fieldRow}>
                  <Text variant="caption" color="muted">
                    Session Duration
                  </Text>
                  <Text variant="bodyBold" color="primary" testID="profile-view-duration">
                    {formatText(storeDuration)}
                  </Text>
                </View>

                <View style={styles.fieldRow}>
                  <Text variant="caption" color="muted">
                    Equipment Access
                  </Text>
                  <Text variant="bodyBold" color="primary" testID="profile-view-equipment">
                    {formatEquipment(storeEquipment)}
                  </Text>
                </View>

                <View style={styles.fieldRow}>
                  <Text variant="caption" color="muted">
                    Workout Style
                  </Text>
                  <Text variant="bodyBold" color="primary" testID="profile-view-style">
                    {formatWorkoutStyle(storeStyle)}
                  </Text>
                </View>

                <View style={[styles.fieldRow, styles.noBorder]}>
                  <Text variant="caption" color="muted">
                    Preferred Days
                  </Text>
                  <View style={styles.daysBadgeRow} testID="profile-view-days">
                    {storeDays && storeDays.length > 0 ? (
                      storeDays.map((d) => (
                        <View key={d} style={styles.dayBadge}>
                          <Text variant="caption" color="accent" style={styles.dayBadgeText}>
                            {d.slice(0, 3).toUpperCase()}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <View style={styles.dayBadge}>
                        <Text variant="caption" color="secondary" style={styles.dayBadgeText}>
                          Flexible
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </Card>
          </>
        ) : (
          /* ========================================================
             EDIT MODE: Comprehensive Athletic Profile Editor
             ======================================================== */
          <Card style={styles.sectionCard} testID="settings-profile-card">
            <View style={styles.cardHeaderRow}>
              <Text variant="label" color="muted">
                EDIT ATHLETIC PROFILE
              </Text>
            </View>

            <View style={styles.profileEditContainer}>
              {/* Personal Information Inputs */}
              <View style={styles.editSection}>
                <Text variant="label" color="primary" style={styles.editSectionLabel}>
                  Personal Details
                </Text>

                <View style={styles.inputGroup}>
                  <Text variant="caption" color="secondary">
                    Display Name
                  </Text>
                  <TextInput
                    testID="input-display-name"
                    value={editDisplayName}
                    onChangeText={(val) => {
                      editDisplayNameRef.current = val;
                      setEditDisplayName(val);
                    }}
                    placeholder="e.g. Aditya Patil"
                    placeholderTextColor={colors.dark.textMuted}
                    style={styles.textInput}
                  />
                </View>

                <View style={styles.formRow}>
                  <View style={[styles.inputGroup, styles.formCol]}>
                    <Text variant="caption" color="secondary">
                      Age (years)
                    </Text>
                    <TextInput
                      testID="input-age"
                      value={editAge}
                      onChangeText={(val) => {
                        editAgeRef.current = val;
                        setEditAge(val);
                      }}
                      keyboardType="numeric"
                      placeholder="e.g. 25"
                      placeholderTextColor={colors.dark.textMuted}
                      style={styles.textInput}
                    />
                  </View>

                  <View style={[styles.inputGroup, styles.formCol]}>
                    <Text variant="caption" color="secondary">
                      Height (cm)
                    </Text>
                    <TextInput
                      testID="input-height"
                      value={editHeight}
                      onChangeText={(val) => {
                        editHeightRef.current = val;
                        setEditHeight(val);
                      }}
                      keyboardType="numeric"
                      placeholder="e.g. 180"
                      placeholderTextColor={colors.dark.textMuted}
                      style={styles.textInput}
                    />
                  </View>

                  <View style={[styles.inputGroup, styles.formCol]}>
                    <Text variant="caption" color="secondary">
                      Weight (kg)
                    </Text>
                    <TextInput
                      testID="input-weight"
                      value={editWeight}
                      onChangeText={(val) => {
                        editWeightRef.current = val;
                        setEditWeight(val);
                      }}
                      keyboardType="numeric"
                      placeholder="e.g. 78"
                      placeholderTextColor={colors.dark.textMuted}
                      style={styles.textInput}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text variant="caption" color="secondary">
                    Profile Avatar
                  </Text>

                  {/* Avatar Live Preview */}
                  <View style={styles.avatarPreviewRow} testID="avatar-preview-box">
                    <View style={styles.previewAvatarWrapper}>
                      {editAvatarUrl ? (
                        <Image
                          source={{ uri: editAvatarUrl }}
                          style={styles.avatarPreviewImage}
                          onError={() => {}}
                        />
                      ) : (
                        <View style={styles.avatarFallback}>
                          <Text style={styles.avatarInitialsText}>{initials}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.previewTextCol}>
                      <Text variant="bodyBold" color="primary">
                        Avatar Preview
                      </Text>
                      <Text variant="caption" color="muted">
                        Select an athletic preset, enter an image URL, or upload a photo.
                      </Text>
                    </View>
                  </View>

                  {/* Athletic Presets */}
                  <Text variant="caption" color="muted" style={styles.presetLabel}>
                    Athletic Presets:
                  </Text>
                  <View style={styles.presetsRow}>
                    {ATHLETIC_AVATAR_PRESETS.map((p) => (
                      <Pressable
                        key={p.id}
                        testID={`avatar-preset-${p.id}`}
                        onPress={() => {
                          pendingAvatarFileRef.current = null;
                          editAvatarUrlRef.current = p.url;
                          setEditAvatarUrl(p.url);
                        }}
                        style={[
                          styles.presetChip,
                          editAvatarUrl === p.url && styles.presetChipActive,
                        ]}
                      >
                        <Text variant="caption" color={editAvatarUrl === p.url ? 'accent' : 'secondary'}>
                          {p.label}
                        </Text>
                      </Pressable>
                    ))}
                    {editAvatarUrl ? (
                      <Pressable
                        testID="clear-avatar-button"
                        onPress={() => {
                          pendingAvatarFileRef.current = null;
                          editAvatarUrlRef.current = '';
                          setEditAvatarUrl('');
                        }}
                        style={styles.presetChipClear}
                      >
                        <Text variant="caption" color="muted">
                          ✕ Clear
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {/* Custom Avatar Grouping */}
                  <View style={styles.avatarCustomGroup}>
                    <Text variant="caption" color="muted">
                      Custom Avatar Photo or Image URL:
                    </Text>

                    {/* Web File Upload if supported */}
                    {Platform.OS === 'web' && typeof document !== 'undefined' && (
                      <View style={styles.uploadRow}>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          style={{ display: 'none' }}
                          ref={fileInputRef}
                          onChange={(e: any) => {
                            const file = e.target?.files?.[0];
                            if (!file) return;
                            const validation = avatarService.validateAvatarFile(file);
                            if (!validation.valid) {
                              setErrorMessage(validation.error || 'Invalid image file.');
                              return;
                            }
                            setErrorMessage(null);
                            pendingAvatarFileRef.current = { file, mimeType: file.type || 'image/jpeg' };

                            if (typeof URL !== 'undefined' && URL.createObjectURL) {
                              const previewUrl = URL.createObjectURL(file);
                              editAvatarUrlRef.current = previewUrl;
                              setEditAvatarUrl(previewUrl);
                            } else {
                              const reader = new FileReader();
                              reader.onload = (uploadEvent) => {
                                const result = uploadEvent.target?.result as string;
                                if (result) {
                                  editAvatarUrlRef.current = result;
                                  setEditAvatarUrl(result);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                            // Clear input value to allow re-selection of the same file
                            e.target.value = '';
                          }}
                        />
                        <Button
                          testID="upload-avatar-button"
                          title={uploadingAvatar ? 'Uploading...' : '📷 Upload Photo'}
                          variant="secondary"
                          size="sm"
                          disabled={uploadingAvatar}
                          onPress={() => fileInputRef.current?.click()}
                          style={styles.uploadButton}
                        />
                      </View>
                    )}

                    {/* Avatar URL Text Input */}
                    <TextInput
                      testID="input-avatar-url"
                      value={editAvatarUrl}
                      onChangeText={(val) => {
                        editAvatarUrlRef.current = val;
                        setEditAvatarUrl(val);
                      }}
                      placeholder="Or enter image URL (https://...)"
                      placeholderTextColor={colors.dark.textMuted}
                      style={styles.textInput}
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              </View>

              {/* Goal Selection */}
              <View style={styles.editSection}>
                <Text variant="label" color="primary" style={styles.editSectionLabel}>
                  Primary Fitness Goal
                </Text>
                <View style={styles.optionsList}>
                  {GOAL_OPTIONS.map((opt) => (
                    <SelectableCard
                      key={opt.id}
                      testID={`goal-${opt.id}`}
                      title={opt.title}
                      description={opt.description}
                      badge={opt.badge}
                      selected={editGoal === opt.id}
                      onSelect={() => updateGoal(opt.id)}
                    />
                  ))}
                </View>
              </View>

              {/* Experience Level Selection */}
              <View style={styles.editSection}>
                <Text variant="label" color="primary" style={styles.editSectionLabel}>
                  Experience Level
                </Text>
                <View style={styles.optionsList}>
                  {EXPERIENCE_OPTIONS.map((opt) => (
                    <SelectableCard
                      key={opt.id}
                      testID={`experience-${opt.id}`}
                      title={opt.title}
                      description={opt.description}
                      badge={opt.badge}
                      selected={editExperience === opt.id}
                      onSelect={() => updateExperience(opt.id)}
                    />
                  ))}
                </View>
              </View>

              {/* Days Per Week */}
              <View style={styles.editSection}>
                <Text variant="label" color="primary" style={styles.editSectionLabel}>
                  Days Per Week
                </Text>
                <ChipGroup<number>
                  options={DAYS_PER_WEEK_OPTIONS}
                  selectedValue={editDaysPerWeek}
                  onSelect={(days) => updateDaysPerWeek(days)}
                />
              </View>

              {/* Session Duration */}
              <View style={styles.editSection}>
                <Text variant="label" color="primary" style={styles.editSectionLabel}>
                  Session Duration
                </Text>
                <ChipGroup<WorkoutDuration>
                  options={DURATION_OPTIONS}
                  selectedValue={editDuration}
                  onSelect={(dur) => updateDuration(dur)}
                />
              </View>

              {/* Equipment */}
              <View style={styles.editSection}>
                <Text variant="label" color="primary" style={styles.editSectionLabel}>
                  Equipment Access
                </Text>
                <View style={styles.optionsList}>
                  {EQUIPMENT_OPTIONS.map((opt) => (
                    <SelectableCard
                      key={opt.id}
                      testID={opt.testID}
                      title={opt.title}
                      description={opt.description}
                      selected={editEquipment === opt.id}
                      onSelect={() => updateEquipment(opt.id)}
                    />
                  ))}
                </View>
              </View>

              {/* Preferred Days */}
              <View style={styles.editSection}>
                <Text variant="label" color="primary" style={styles.editSectionLabel}>
                  Preferred Training Days
                </Text>
                <ChipGroup<DayOfWeek>
                  options={DAYS_OF_WEEK_OPTIONS}
                  selectedValues={editPreferredDays}
                  onSelect={handleToggleDay}
                  multiSelect={true}
                  chipStyle={styles.multiSelectDayChip}
                />
              </View>

              {/* Workout Style */}
              <View style={styles.editSection}>
                <Text variant="label" color="primary" style={styles.editSectionLabel}>
                  Workout Style
                </Text>
                <View style={styles.optionsList}>
                  {WORKOUT_STYLE_OPTIONS.map((opt) => (
                    <SelectableCard
                      key={opt.id}
                      testID={opt.testID}
                      title={opt.title}
                      description={opt.description}
                      badge={opt.badge}
                      selected={editStyle === opt.id}
                      onSelect={() => updateStyle(opt.id)}
                    />
                  ))}
                </View>
              </View>

              {/* Edit Actions */}
              <View style={styles.editActionRow}>
                <Button
                  testID="save-profile-button"
                  title={saving ? 'Saving Changes...' : 'Save Changes'}
                  onPress={handleSaveProfile}
                  variant="primary"
                  size="lg"
                  disabled={saving}
                  style={styles.saveButton}
                />
                <Button
                  testID="cancel-edit-button"
                  title="Cancel"
                  onPress={handleCancelEdit}
                  variant="outline"
                  size="lg"
                  disabled={saving}
                  style={styles.cancelButton}
                />
              </View>
            </View>
          </Card>
        )}

        {/* 4. Account Actions & Security Card */}
        <Card style={styles.sectionCard} testID="settings-account-card">
          <View style={styles.cardHeaderRow}>
            <Text variant="label" color="muted">
              ACCOUNT & SECURITY
            </Text>
          </View>

          {user && (
            <>
              <View style={styles.fieldRow}>
                <Text variant="caption" color="muted">
                  Email
                </Text>
                <Text variant="bodyBold" color="primary" testID="settings-user-email">
                  {user.email ?? 'No email associated'}
                </Text>
              </View>

              <View style={styles.fieldRow}>
                <Text variant="caption" color="muted">
                  Auth Method
                </Text>
                <Text variant="bodyBold" color="primary" testID="settings-provider">
                  {user.provider === 'email' || !user.provider
                    ? 'Email & Password'
                    : user.provider.toUpperCase()}
                </Text>
              </View>
            </>
          )}

          {isGuest && (
            <View testID="settings-guest-badge" style={styles.guestNoticeBox}>
              <Text variant="bodyBold" color="primary">
                Local Device Athlete
              </Text>
              <Text variant="caption" color="secondary">
                Your workout data is stored locally. Sign up or log in to sync your routines to the cloud.
              </Text>
            </View>
          )}

          <Button
            testID="settings-logout-button"
            title={isGuest ? 'Exit Guest Mode' : 'Log Out'}
            onPress={handleSignOut}
            variant="outline"
            size="md"
            style={styles.logoutButton}
          />

          {/* Account Deletion Notice */}
          <View style={styles.deletionNoticeBox} testID="account-deletion-notice">
            <Text variant="caption" color="muted" style={styles.deletionTitle}>
              Account Deletion
            </Text>
            <Text variant="caption" color="muted" style={styles.deletionText}>
              Account deletion requires a secure backend flow and was intentionally not implemented in this milestone.
            </Text>
          </View>
        </Card>

        {/* 5. Development & Diagnostic Tools Card (Testing Only) */}
        <Card style={styles.devToolsCard} testID="settings-dev-tools-card">
          <View style={styles.cardHeaderRow}>
            <Text variant="caption" color="muted" style={styles.devToolsHeading}>
              DEVELOPMENT & DIAGNOSTIC TOOLS (TESTING ONLY)
            </Text>
          </View>

          <Text variant="caption" color="secondary" style={styles.devToolsDesc}>
            These diagnostic actions are for engineering verification and do not affect normal athletic use.
          </Text>

          <View style={styles.devActionsRow}>
            <Button
              testID="dev-clear-cache-button"
              title="Clear Local Cache"
              onPress={handleClearCache}
              variant="outline"
              size="sm"
              style={styles.devButton}
            />
            <Button
              testID="dev-reset-onboarding-button"
              title="Reset Onboarding (Dev Only)"
              onPress={handleDevResetOnboarding}
              variant="ghost"
              size="sm"
            />
          </View>
        </Card>

        {/* 6. App Information Card */}
        <Card style={styles.sectionCard} testID="settings-app-info-card">
          <Text variant="label" color="muted" style={styles.sectionLabel}>
            APP INFORMATION
          </Text>
          <View style={styles.appInfoContent}>
            <Text variant="titleMedium" color="primary">
              BeBig 2.0
            </Text>
            <Text variant="caption" color="secondary">
              Progressive Overload & Strength Architecture
            </Text>
            <Text variant="caption" color="muted" testID="developer-credit" style={styles.developerCredit}>
              Developed by Aditya Patil
            </Text>
            <Text variant="caption" color="muted" style={styles.versionText}>
              Version 2.0.0 (Production PWA)
            </Text>
          </View>
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingVertical: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl * 3,
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
  },
  headerTitleRow: {
    gap: spacing.xs,
  },
  screenTitle: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  successBanner: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  successText: {
    fontWeight: '700',
    color: colors.dark.success,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  errorText: {
    fontWeight: '700',
    color: colors.dark.error,
  },
  profileHeaderCard: {
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.border,
    padding: spacing.md,
  },
  profileHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarWrapper: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E5A93C',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.dark.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialsText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#E5A93C',
    letterSpacing: 1,
  },
  profileHeaderText: {
    flex: 1,
    gap: spacing.xs,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  headerEditAction: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  cloudBadge: {
    backgroundColor: 'rgba(229, 169, 60, 0.12)',
    borderColor: 'rgba(229, 169, 60, 0.4)',
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  guestBadge: {
    backgroundColor: 'rgba(156, 163, 175, 0.12)',
    borderColor: 'rgba(156, 163, 175, 0.4)',
  },
  badgeText: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  guestBadgeText: {
    color: colors.dark.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  noBorder: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  daysBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
  },
  dayBadge: {
    backgroundColor: 'rgba(229, 169, 60, 0.12)',
    borderColor: 'rgba(229, 169, 60, 0.3)',
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  dayBadgeText: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  formCol: {
    flex: 1,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: colors.dark.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.dark.textPrimary,
    fontSize: 16,
  },
  profileViewContainer: {
    gap: 0,
  },
  profileEditContainer: {
    gap: spacing.lg,
  },
  editSection: {
    gap: spacing.sm,
  },
  editSectionLabel: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  multiSelectDayChip: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  avatarCustomGroup: {
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: colors.dark.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  optionsList: {
    gap: spacing.sm,
  },
  editActionRow: {
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.dark.border,
  },
  saveButton: {
    width: '100%',
  },
  cancelButton: {
    width: '100%',
  },
  sectionLabel: {
    marginBottom: spacing.xs,
  },
  guestNoticeBox: {
    backgroundColor: colors.dark.surfaceElevated,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  logoutButton: {
    marginTop: spacing.sm,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  deletionNoticeBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.dark.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dark.border,
    gap: spacing.xs,
  },
  deletionTitle: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deletionText: {
    lineHeight: 18,
  },
  appInfoContent: {
    gap: spacing.xs,
  },
  developerCredit: {
    marginTop: spacing.xs,
  },
  versionText: {
    opacity: 0.7,
  },
  avatarPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.dark.surfaceElevated,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  previewAvatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    overflow: 'hidden',
    backgroundColor: colors.dark.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPreviewImage: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
  },
  previewTextCol: {
    flex: 1,
    gap: 2,
  },
  presetLabel: {
    marginTop: spacing.xs,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  presetChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.dark.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  presetChipActive: {
    borderColor: colors.dark.primary,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  presetChipClear: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  uploadRow: {
    alignSelf: 'flex-start',
    marginVertical: 2,
  },
  uploadButton: {
    paddingHorizontal: spacing.md,
  },
  devToolsCard: {
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.borderLight,
    padding: spacing.md,
    gap: spacing.sm,
  },
  devToolsHeading: {
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.dark.textMuted,
  },
  devToolsDesc: {
    lineHeight: 18,
  },
  devActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  devButton: {
    borderColor: colors.dark.borderLight,
  },
});
