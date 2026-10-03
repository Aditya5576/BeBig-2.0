import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useRouter, useFocusEffect as routerFocusEffect } from 'expo-router';
import { useAppTheme } from '../../../src/features/theme';
import { ScreenContainer, ScreenScrollView, Text } from '../../../src/components/ui';
import { workoutRepository, WorkoutSession } from '../../../src/features/workout';
import { calculateWeeklyPerformance } from '../../../src/features/performance';
import { WeeklyPerformanceCard } from '../../../src/features/performance/WeeklyPerformanceCard';
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workoutRepository.getCompletedWorkouts();
      setWorkouts(data);
    } catch {
      setWorkouts([]);
    } finally {
      setLoading(false);
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

  return (
    <ScreenContainer>
      <ScreenScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            testID="weekly-perf-back-button"
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text variant="bodyBold" color="accent">
              ‹ Back
            </Text>
          </Pressable>

          <View style={styles.titleBlock}>
            <Text variant="display" color="primary" testID="weekly-performance-screen-title">
              Weekly Performance
            </Text>
            <Text variant="body" color="secondary">
              Factual training progression between calendar weeks.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <WeeklyPerformanceCard summary={weeklyPerformance} />
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
      gap: spacing.lg,
    },
    header: {
      gap: spacing.xs,
    },
    backButton: {
      alignSelf: 'flex-start',
      paddingVertical: 4,
    },
    titleBlock: {
      gap: 2,
    },
    loadingContainer: {
      padding: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
