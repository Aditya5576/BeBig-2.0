import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useRouter, useFocusEffect as routerFocusEffect } from 'expo-router';
import { useAppTheme } from '../../../src/features/theme';
import { ScreenContainer, ScreenScrollView, Text, Icon } from '../../../src/components/ui';
import { workoutRepository, WorkoutSession } from '../../../src/features/workout';
import { calculateWeeklyPerformance, calculateProgressAnalytics, AnalyticsPeriod } from '../../../src/features/performance';
import { WeeklyPerformanceCard } from '../../../src/features/performance/WeeklyPerformanceCard';
import { ProgressOverviewCard } from '../../../src/features/performance/components/ProgressOverviewCard';
import { FocusProgressSection } from '../../../src/features/performance/components/FocusProgressSection';
import { AIWeeklyAnalysisCard, coachService, AIWeeklyAnalysisResult } from '../../../src/features/coach';
import { spacing } from '../../../src/constants/theme';

const useFocusEffect =
  routerFocusEffect ||
  ((cb: () => void | (() => void)) => {
    React.useEffect(() => {
      return cb?.();
    }, []);
  });

export default function WeeklyPerformanceScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();

  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<AIWeeklyAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<AnalyticsPeriod>('week');

  const fetchAnalysis = useCallback(async (currentWorkouts: WorkoutSession[]) => {
    setAnalysisLoading(true);
    try {
      const res = await coachService.generateWeeklyWorkoutAnalysis(currentWorkouts);
      setAnalysis(res);
    } catch {
      setAnalysis(null);
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workoutRepository.getCompletedWorkouts();
      setWorkouts(data);
      void fetchAnalysis(data);
    } catch {
      setWorkouts([]);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [fetchAnalysis]);

  const handleRefresh = useCallback(async () => {
    setAnalysisLoading(true);
    try {
      const data = await workoutRepository.getCompletedWorkouts();
      setWorkouts(data);
      const res = await coachService.generateWeeklyWorkoutAnalysis(data, { forceRefresh: true });
      setAnalysis(res);
    } catch {
      setAnalysis(null);
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const weeklyPerformance = useMemo(() => {
    return calculateWeeklyPerformance(workouts);
  }, [workouts]);

  const progressAnalytics = useMemo(() => {
    return calculateProgressAnalytics(workouts, selectedPeriod);
  }, [workouts, selectedPeriod]);

  return (
    <ScreenContainer>
      <ScreenScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Pressable
              testID="weekly-perf-back-button"
              onPress={() => router.back()}
              style={styles.backButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Back"
              accessibilityRole="button"
            >
              <Text variant="bodyBold" color="accent">
                ‹ Back
              </Text>
            </Pressable>

            <Pressable
              testID="weekly-perf-settings-button"
              onPress={() => router.push('/settings' as any)}
              style={styles.settingsButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Settings"
              accessibilityRole="button"
            >
              <Icon name="profile" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.titleBlock}>
            <Text variant="display" color="primary" testID="weekly-performance-screen-title">
              Weekly Performance
            </Text>
            <Text variant="body" color="secondary" style={styles.subtitle}>
              Factual progressive overload, focus trends, and set comparisons.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {/* 1. Overall Multi-Period Progress Overview */}
            <ProgressOverviewCard
              overview={progressAnalytics.overview}
              selectedPeriod={selectedPeriod}
              onSelectPeriod={setSelectedPeriod}
            />

            {/* 2. Dynamic Workout Focus Progression */}
            <FocusProgressSection
              focuses={progressAnalytics.focuses}
              allExercises={progressAnalytics.allExercises}
            />

            {/* 3. AI Weekly Analysis Card */}
            <AIWeeklyAnalysisCard
              analysis={analysis}
              loading={analysisLoading}
              onRefresh={handleRefresh}
            />

            {/* 4. Factual Set and Exercise Performance Card */}
            <WeeklyPerformanceCard summary={weeklyPerformance} />
          </>
        )}
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingVertical: spacing.md,
      paddingBottom: spacing.xxl + 48,
      gap: spacing.md,
    },
    header: {
      gap: spacing.sm,
    },
    headerTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    backButton: {
      minHeight: 36,
      justifyContent: 'center',
      paddingVertical: 4,
    },
    settingsButton: {
      minHeight: 36,
      minWidth: 36,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
    },
    titleBlock: {
      gap: 4,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
    },
    loadingContainer: {
      padding: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
