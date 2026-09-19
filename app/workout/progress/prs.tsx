import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect as routerFocusEffect } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../../src/components/ui';
import {
  workoutRepository,
  calculatePersonalRecords,
  PersonalRecord,
  formatWorkoutDate,
} from '../../../src/features/workout';
import { colors, spacing, radii } from '../../../src/constants/theme';

const useFocusEffect = routerFocusEffect || React.useEffect;

export default function PersonalRecordsScreen() {
  const router = useRouter();

  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      setLoading(true);
      void (async () => {
        try {
          const workouts = await workoutRepository.getCompletedWorkouts();
          if (!isMounted) return;
          const { allPRs } = calculatePersonalRecords(workouts);
          setRecords(allPRs || []);
        } catch {
          if (isMounted) setRecords([]);
        } finally {
          if (isMounted) setLoading(false);
        }
      })();
      return () => {
        isMounted = false;
      };
    }, []),
  );

  // Highest weight PR (first in descending-sorted allPRs)
  const heaviestLift = records.length > 0 ? records[0] : null;

  // Most recently achieved PR
  const mostRecentPR = useMemo(() => {
    if (records.length === 0) return null;
    return [...records].sort((a, b) => {
      const timeA = a.achievedAt ? new Date(a.achievedAt).getTime() : 0;
      const timeB = b.achievedAt ? new Date(b.achievedAt).getTime() : 0;
      return timeB - timeA;
    })[0];
  }, [records]);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            testID="prs-back-button"
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text variant="bodyBold" color="accent" style={styles.backButtonText}>
              ‹ Back
            </Text>
          </Pressable>

          <View style={styles.titleContainer}>
            <View style={styles.trophyBadge}>
              <Text variant="caption" color="accent" style={styles.trophyBadgeText}>
                RECORD BOARD
              </Text>
            </View>
            <Text variant="display" color="primary" testID="prs-title">
              Personal Records
            </Text>
            <Text variant="body" color="secondary">
              Your verified all-time highest weight lifts per exercise.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.dark.primary} />
          </View>
        ) : records.length === 0 ? (
          /* Empty State */
          <Card style={styles.emptyCard} testID="prs-empty-state">
            <View style={styles.emptyIconContainer}>
              <Text variant="display" style={styles.emptyEmoji}>
                🏆
              </Text>
            </View>
            <Text variant="titleLarge" color="primary" style={styles.emptyTitle}>
              No Personal Records Yet
            </Text>
            <Text variant="body" color="secondary" style={styles.emptySubtitle}>
              Complete your first workout to start setting personal records. Your heaviest
              successful set for each exercise will be tracked here automatically.
            </Text>
            <Button
              testID="prs-start-workout-button"
              title="Start Workout"
              onPress={() => router.push('/workout/start' as any)}
              variant="primary"
              size="lg"
              style={styles.emptyButton}
            />
          </Card>
        ) : (
          /* Populated State */
          <View style={styles.contentSection}>
            {/* Summary Highlights */}
            <View style={styles.summaryGrid}>
              <Card style={styles.summaryCard} testID="prs-summary-total">
                <Text variant="caption" color="muted" style={styles.summaryLabel}>
                  TOTAL RECORDS
                </Text>
                <Text variant="titleLarge" color="primary" style={styles.summaryValue}>
                  🏆 {records.length}
                </Text>
                <Text variant="caption" color="secondary">
                  Unique exercises
                </Text>
              </Card>

              <Card style={styles.summaryCard} testID="prs-summary-heaviest">
                <Text variant="caption" color="muted" style={styles.summaryLabel}>
                  HEAVIEST LIFT
                </Text>
                <Text variant="titleLarge" color="accent" style={styles.summaryValue}>
                  {heaviestLift ? `${heaviestLift.maxWeight} kg` : '—'}
                </Text>
                <Text variant="caption" color="secondary" numberOfLines={1}>
                  {heaviestLift ? heaviestLift.exerciseName : 'No lifts'}
                </Text>
              </Card>

              <Card style={styles.summaryCard} testID="prs-summary-recent">
                <Text variant="caption" color="muted" style={styles.summaryLabel}>
                  LATEST RECORD
                </Text>
                <Text variant="titleMedium" color="primary" style={styles.summaryValue} numberOfLines={1}>
                  {mostRecentPR ? mostRecentPR.exerciseName : '—'}
                </Text>
                <Text variant="caption" color="secondary" numberOfLines={1}>
                  {mostRecentPR?.achievedAt ? formatWorkoutDate(mostRecentPR.achievedAt) : 'No lifts'}
                </Text>
              </Card>
            </View>

            {/* Records List Header */}
            <View style={styles.listHeaderRow}>
              <Text variant="titleMedium" color="primary">
                All-Time Records ({records.length})
              </Text>
              <Text variant="caption" color="muted">
                Ranked by max weight
              </Text>
            </View>

            {/* Records List */}
            <View style={styles.recordsList} testID="prs-list">
              {records.map((pr, index) => {
                const rankMedal =
                  index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

                return (
                  <Card key={pr.exerciseId} style={styles.prCard} testID={`pr-card-${pr.exerciseId}`}>
                    <Pressable
                      testID={`pr-item-${pr.exerciseId}`}
                      onPress={() =>
                        router.push({
                          pathname: '/workout/progress/exercise/[id]',
                          params: { id: pr.exerciseId, name: pr.exerciseName },
                        } as any)
                      }
                      style={({ pressed }) => [
                        styles.prPressable,
                        pressed && styles.prPressablePressed,
                      ]}
                    >
                      <View style={styles.prMainRow}>
                        {/* Rank Badge */}
                        <View style={styles.rankContainer}>
                          <Text variant="bodyBold" style={styles.rankText}>
                            {rankMedal}
                          </Text>
                        </View>

                        {/* Exercise & Date Info */}
                        <View style={styles.prInfo}>
                          <Text
                            variant="bodyBold"
                            color="primary"
                            style={styles.exerciseName}
                            numberOfLines={2}
                            testID={`pr-name-${pr.exerciseId}`}
                          >
                            {pr.exerciseName}
                          </Text>
                          <Text
                            variant="caption"
                            color="secondary"
                            style={styles.achievedDate}
                            testID={`pr-date-${pr.exerciseId}`}
                          >
                            {pr.achievedAt ? `Achieved ${formatWorkoutDate(pr.achievedAt)}` : 'Recorded in workout'}
                          </Text>
                        </View>

                        {/* Max Weight Display */}
                        <View style={styles.weightContainer}>
                          <Text
                            variant="titleMedium"
                            color="accent"
                            style={styles.weightValue}
                            testID={`pr-weight-${pr.exerciseId}`}
                          >
                            {pr.maxWeight} kg
                          </Text>
                          <Text variant="caption" color="muted">
                            {pr.reps} {pr.reps === 1 ? 'rep' : 'reps'}
                          </Text>
                        </View>

                        <Text variant="body" color="muted" style={styles.chevron}>
                          ›
                        </Text>
                      </View>
                    </Pressable>
                  </Card>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xxl * 3,
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
    marginBottom: spacing.xs,
  },
  backButtonText: {
    fontWeight: '700',
  },
  titleContainer: {
    marginTop: spacing.xs,
  },
  trophyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  trophyBadgeText: {
    color: '#F59E0B',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.border,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyEmoji: {
    fontSize: 32,
  },
  emptyTitle: {
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  emptyButton: {
    width: '100%',
  },
  contentSection: {
    marginTop: spacing.xs,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryCard: {
    flex: 1,
    padding: spacing.sm + 2,
    borderRadius: radii.md,
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.border,
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  summaryLabel: {
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontWeight: '700',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
    paddingHorizontal: spacing.xs,
  },
  recordsList: {
    gap: spacing.xs + 2,
  },
  prCard: {
    padding: 0,
    borderRadius: radii.md,
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.border,
    overflow: 'hidden',
  },
  prPressable: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  prPressablePressed: {
    backgroundColor: colors.dark.surfaceElevated,
  },
  prMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankContainer: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs + 2,
  },
  rankText: {
    fontWeight: '700',
  },
  prInfo: {
    flex: 1,
    flexShrink: 1,
    paddingRight: spacing.sm,
  },
  exerciseName: {
    fontWeight: '700',
    lineHeight: 20,
  },
  achievedDate: {
    marginTop: 2,
  },
  weightContainer: {
    alignItems: 'flex-end',
    marginRight: spacing.xs,
  },
  weightValue: {
    fontWeight: '700',
  },
  chevron: {
    marginLeft: spacing.xs,
  },
});
