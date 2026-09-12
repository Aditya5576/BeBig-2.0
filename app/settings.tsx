import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
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
import { profileService, UserProfile } from '../src/features/profile';
import { guestStorage } from '../src/lib/storage';
import { colors, spacing, radii } from '../src/constants/theme';

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

export default function SettingsScreen() {
  const router = useRouter();

  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);
  const signOut = useAuthStore((state) => state.signOut);
  const exitGuestMode = useAuthStore((state) => state.exitGuestMode);

  // Store profile values
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

  // Editable draft state
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [editExperience, setEditExperience] = useState<ExperienceLevel | null>(null);
  const [editDaysPerWeek, setEditDaysPerWeek] = useState<number | null>(null);
  const [editDuration, setEditDuration] = useState<WorkoutDuration | null>(null);
  const [editEquipment, setEditEquipment] = useState<Equipment | null>(null);
  const [editPreferredDays, setEditPreferredDays] = useState<DayOfWeek[]>([]);
  const [editStyle, setEditStyle] = useState<WorkoutStyle | null>(null);

  const editGoalRef = React.useRef<Goal | null>(null);
  const editExperienceRef = React.useRef<ExperienceLevel | null>(null);
  const editDaysPerWeekRef = React.useRef<number | null>(null);
  const editDurationRef = React.useRef<WorkoutDuration | null>(null);
  const editEquipmentRef = React.useRef<Equipment | null>(null);
  const editPreferredDaysRef = React.useRef<DayOfWeek[]>([]);
  const editStyleRef = React.useRef<WorkoutStyle | null>(null);

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
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSuccessMessage(null);
  };

  const handleToggleDay = (day: DayOfWeek) => {
    const prev = editPreferredDaysRef.current;
    const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
    editPreferredDaysRef.current = next;
    setEditPreferredDays(next);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSuccessMessage(null);

    const updatedGoal = editGoalRef.current || editGoal || storeGoal;
    const updatedExperience = editExperienceRef.current || editExperience || storeExperience;
    const updatedDaysPerWeek = editDaysPerWeekRef.current || editDaysPerWeek || storeDaysPerWeek;
    const updatedDuration = editDurationRef.current || editDuration || storeDuration;
    const updatedEquipment = editEquipmentRef.current || editEquipment || storeEquipment;
    const updatedDays = editPreferredDaysRef.current.length > 0 ? editPreferredDaysRef.current : editPreferredDays;
    const updatedStyle = editStyleRef.current || editStyle || storeStyle;

    try {
      if (user?.id) {
        await profileService.upsertProfile(user.id, {
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
    } catch {
      // In case of network error, show error or fallback
    } finally {
      setSaving(false);
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

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.navRow}>
            <Button
              testID="settings-back-button"
              title="← Home"
              onPress={() => router.back()}
              variant="ghost"
              size="sm"
              style={styles.backButton}
            />
          </View>

          <View style={styles.headerTitleRow}>
            <Text
              variant="titleLarge"
              color="primary"
              testID="settings-screen-title"
              style={styles.screenTitle}
            >
              Settings & Profile
            </Text>
            <Text variant="caption" color="secondary">
              Manage your athletic profile and account preferences
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

        {/* 1. Account / Identity Section */}
        <Card style={styles.sectionCard} testID="settings-account-card">
          <View style={styles.cardHeaderRow}>
            <Text variant="label" color="muted">
              ACCOUNT & IDENTITY
            </Text>
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
        </Card>

        {/* 2. Fitness Profile Section */}
        <Card style={styles.sectionCard} testID="settings-profile-card">
          <View style={styles.cardHeaderRow}>
            <Text variant="label" color="muted">
              FITNESS PROFILE
            </Text>
            {!isEditing && (
              <Pressable
                testID="edit-profile-button"
                onPress={handleStartEdit}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text variant="label" color="accent">
                  Edit Profile ›
                </Text>
              </Pressable>
            )}
          </View>

          {!isEditing ? (
            /* VIEW MODE */
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
                <Text variant="bodyBold" color="accent" testID="profile-view-days">
                  {storeDays && storeDays.length > 0
                    ? storeDays.map((d) => d.slice(0, 3).toUpperCase()).join(', ')
                    : 'Flexible'}
                </Text>
              </View>

              <Button
                testID="edit-profile-cta"
                title="Edit Fitness Profile"
                onPress={handleStartEdit}
                variant="secondary"
                size="md"
                style={styles.editCtaButton}
              />
            </View>
          ) : (
            /* EDIT MODE */
            <View style={styles.profileEditContainer}>
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
          )}
        </Card>

        {/* 3. Account Actions Section */}
        <Card style={styles.sectionCard} testID="settings-actions-card">
          <Text variant="label" color="muted" style={styles.sectionLabel}>
            ACCOUNT ACTIONS
          </Text>

          <Button
            testID="settings-logout-button"
            title={isGuest ? 'Exit Guest Mode' : 'Log Out'}
            onPress={handleSignOut}
            variant="outline"
            size="lg"
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

        {/* 4. App Information Section */}
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
    paddingLeft: 0,
    minHeight: 44,
  },
  headerTitleRow: {
    gap: 4,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '700',
  },
  successBanner: {
    backgroundColor: '#0E291B',
    borderColor: colors.dark.success,
    borderWidth: 1,
    padding: spacing.sm + 2,
    borderRadius: radii.md,
  },
  successText: {
    color: colors.dark.success,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    marginBottom: spacing.xs,
  },
  cloudBadge: {
    backgroundColor: '#0E291B',
    borderColor: colors.dark.success,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  badgeText: {
    color: colors.dark.success,
    fontWeight: '700',
    fontSize: 11,
  },
  guestBadge: {
    backgroundColor: '#1E293B',
    borderColor: colors.dark.borderLight,
  },
  guestBadgeText: {
    color: colors.dark.primary,
    fontWeight: '700',
    fontSize: 11,
  },
  guestNoticeBox: {
    paddingVertical: spacing.xs,
    gap: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  profileViewContainer: {
    gap: 2,
  },
  editCtaButton: {
    marginTop: spacing.md,
    width: '100%',
    minHeight: 44,
  },
  profileEditContainer: {
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  editSection: {
    gap: spacing.xs,
  },
  editSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionsList: {
    gap: spacing.xs,
  },
  editActionRow: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  saveButton: {
    width: '100%',
    minHeight: 48,
  },
  cancelButton: {
    width: '100%',
    minHeight: 44,
  },
  logoutButton: {
    borderColor: colors.dark.error,
    width: '100%',
    minHeight: 48,
  },
  deletionNoticeBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.dark.background,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dark.border,
    gap: 4,
  },
  deletionTitle: {
    fontWeight: '600',
    color: colors.dark.textMuted,
  },
  deletionText: {
    lineHeight: 18,
    color: colors.dark.textMuted,
  },
  appInfoContent: {
    gap: 4,
  },
  developerCredit: {
    marginTop: spacing.xs,
    letterSpacing: 0.5,
  },
  versionText: {
    fontSize: 11,
    color: colors.dark.textMuted,
  },
});
