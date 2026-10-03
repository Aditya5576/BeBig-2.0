/**
 * BeBig 2.0 — Workout Calendar Screen (Refined)
 *
 * Polished mobile-first screen for viewing, creating, editing, and managing
 * scheduled workouts across calendar dates and future weeks.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect as routerFocusEffect } from 'expo-router';
import { useAppTheme } from '../../src/features/theme';
import { ScreenContainer, ScreenScrollView, Text, Button, Card, Icon } from '../../src/components/ui';
import { workoutRepository } from '../../src/features/workout';
import {
  ScheduledWorkout,
  scheduledWorkoutRepository,
  getTodayIsoDate,
} from '../../src/features/scheduling';
import {
  formatIsoDate,
  parseIsoDate,
  formatReadableDate,
  formatMonthYear,
  getWeekDays,
  addDaysToIsoDate,
} from '../../src/features/scheduling/utils/dateUtils';
import { ScheduledWorkoutCard } from '../../src/features/scheduling/components/ScheduledWorkoutCard';
import { ScheduleModal } from '../../src/features/scheduling/components/ScheduleModal';
import { ScheduledWorkoutPreviewModal } from '../../src/features/scheduling/components/ScheduledWorkoutPreviewModal';
import { templateRepository } from '../../src/features/templates';
import { spacing, radii } from '../../src/constants/theme';

const useFocusEffect =
  routerFocusEffect ||
  ((cb: () => void | (() => void)) => {
    React.useEffect(() => {
      return cb?.();
    }, []);
  });

export default function CalendarScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<string>(getTodayIsoDate());
  const [allSchedules, setAllSchedules] = useState<ScheduledWorkout[]>([]);
  const [templateNames, setTemplateNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<ScheduledWorkout | null>(null);

  // Preview Modal State
  const [previewWorkout, setPreviewWorkout] = useState<ScheduledWorkout | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const handleOpenPreview = (workout: ScheduledWorkout) => {
    setPreviewWorkout(workout);
    setPreviewVisible(true);
  };

  const handleStartScheduledWorkout = async (scheduledWorkout: ScheduledWorkout) => {
    try {
      const activeWorkout = await workoutRepository.getActiveWorkout();
      if (activeWorkout) {
        Alert.alert(
          'Active Workout in Progress',
          'You already have an active workout in progress. Discard it to start this scheduled workout?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Resume Active',
              onPress: () => router.push('/workout/active' as any),
            },
            {
              text: 'Discard & Start New',
              style: 'destructive',
              onPress: async () => {
                await workoutRepository.discardActiveWorkout();
                await startScheduled(scheduledWorkout);
                router.push('/workout/active' as any);
              },
            },
          ],
        );
        return;
      }
      await startScheduled(scheduledWorkout);
      router.push('/workout/active' as any);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to start scheduled workout.');
    }
  };

  const startScheduled = async (scheduledWorkout: ScheduledWorkout) => {
    if (scheduledWorkout.templateId) {
      const tpl = await templateRepository.getTemplateById(scheduledWorkout.templateId);
      if (tpl) {
        await workoutRepository.startWorkoutFromTemplate(tpl, scheduledWorkout.name, scheduledWorkout.id);
        return;
      }
    }
    await workoutRepository.startEmptyWorkout(scheduledWorkout.name, scheduledWorkout.id);
  };

  const loadCalendarData = useCallback(async () => {
    try {
      setLoading(true);
      const [schedules, templates] = await Promise.all([
        scheduledWorkoutRepository.getScheduledWorkouts(),
        templateRepository.getTemplates(),
      ]);

      setAllSchedules(schedules);

      const tMap: Record<string, string> = {};
      templates.forEach((t) => {
        tMap[t.id] = t.name;
      });
      setTemplateNames(tMap);
    } catch (err) {
      console.warn('[CalendarScreen] Failed to load schedule data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCalendarData();
    }, [loadCalendarData])
  );

  // Date Navigation Helpers
  const handlePrevMonth = () => {
    const current = parseIsoDate(selectedDate);
    current.setMonth(current.getMonth() - 1);
    setSelectedDate(formatIsoDate(current));
  };

  const handleNextMonth = () => {
    const current = parseIsoDate(selectedDate);
    current.setMonth(current.getMonth() + 1);
    setSelectedDate(formatIsoDate(current));
  };

  const handlePrevWeek = () => {
    setSelectedDate(addDaysToIsoDate(selectedDate, -7));
  };

  const handleNextWeek = () => {
    setSelectedDate(addDaysToIsoDate(selectedDate, 7));
  };

  const handleToday = () => {
    setSelectedDate(getTodayIsoDate());
  };

  // Week strip calculation
  const weekDays = useMemo(() => {
    return getWeekDays(selectedDate);
  }, [selectedDate]);

  // Set of dates that have active schedules
  const scheduledDatesSet = useMemo(() => {
    const set = new Set<string>();
    allSchedules.forEach((s) => {
      if (s.scheduledDate) {
        set.add(s.scheduledDate);
      }
    });
    return set;
  }, [allSchedules]);

  // Workouts for selected date
  const selectedDateWorkouts = useMemo(() => {
    return allSchedules.filter((s) => s.scheduledDate === selectedDate);
  }, [allSchedules, selectedDate]);

  // Handlers
  const handleOpenCreateModal = () => {
    setEditingWorkout(null);
    setModalVisible(true);
  };

  const handleOpenEditModal = (workout: ScheduledWorkout) => {
    setEditingWorkout(workout);
    setModalVisible(true);
  };

  const handleSkipWorkout = async (workout: ScheduledWorkout) => {
    try {
      await scheduledWorkoutRepository.skipScheduledWorkout(workout.id);
      await loadCalendarData();
    } catch (err) {
      console.error('[CalendarScreen] Failed to skip workout:', err);
    }
  };

  const handleDeleteWorkout = async (workout: ScheduledWorkout) => {
    try {
      await scheduledWorkoutRepository.deleteScheduledWorkout(workout.id);
      await loadCalendarData();
    } catch (err) {
      console.error('[CalendarScreen] Failed to delete workout:', err);
    }
  };

  const selectedMonthYearText = useMemo(() => {
    return formatMonthYear(parseIsoDate(selectedDate));
  }, [selectedDate]);

  return (
    <ScreenContainer>
      <ScreenScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 1. Header Row (Responsive layout with safe padding) */}
        <View style={styles.header}>
          <View style={styles.headerTextGroup}>
            <Text variant="titleLarge" style={styles.title}>
              Workout Calendar
            </Text>
            <Text variant="body" style={styles.subtitle}>
              Schedule and manage your routines
            </Text>
          </View>
          <Button
            title="+ Schedule"
            variant="primary"
            size="sm"
            onPress={handleOpenCreateModal}
            style={styles.headerBtn}
          />
        </View>

        {/* 2. Month Navigation & Today Shortcut */}
        <View style={styles.monthNavRow}>
          <View style={styles.monthTitleBox}>
            <Text variant="titleMedium" style={styles.monthTitle}>
              {selectedMonthYearText}
            </Text>
            {selectedDate === getTodayIsoDate() ? (
              <View style={styles.todayBadge}>
                <Text style={styles.todayBadgeText}>TODAY</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.monthControls}>
            <Pressable
              onPress={handleToday}
              style={styles.todayBtn}
              accessibilityLabel="Go to today"
              accessibilityRole="button"
            >
              <Text variant="caption" style={styles.todayBtnText}>
                Today
              </Text>
            </Pressable>

            <Pressable
              onPress={handlePrevMonth}
              style={styles.navArrowBtn}
              accessibilityLabel="Previous Month"
              accessibilityRole="button"
            >
              <Icon name="chevronLeft" size={20} color={colors.textPrimary} />
            </Pressable>

            <Pressable
              onPress={handleNextMonth}
              style={styles.navArrowBtn}
              accessibilityLabel="Next Month"
              accessibilityRole="button"
            >
              <Icon name="chevronRight" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        {/* 3. 7-Day Horizontal Week Strip with Week Navigation */}
        <View style={styles.weekSectionContainer}>
          <View style={styles.weekHeaderRow}>
            <Text variant="caption" style={styles.weekSectionLabel}>
              WEEK VIEW
            </Text>
            <View style={styles.weekNavControls}>
              <Pressable
                onPress={handlePrevWeek}
                style={styles.weekNavBtn}
                accessibilityLabel="Previous Week"
                accessibilityRole="button"
              >
                <Text variant="caption" style={styles.weekNavText}>
                  ‹ Prev Week
                </Text>
              </Pressable>
              <Pressable
                onPress={handleNextWeek}
                style={styles.weekNavBtn}
                accessibilityLabel="Next Week"
                accessibilityRole="button"
              >
                <Text variant="caption" style={styles.weekNavText}>
                  Next Week ›
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.weekStripContainer}>
            {weekDays.map((day) => {
              const isSelected = day.dateStr === selectedDate;
              const hasSchedule = scheduledDatesSet.has(day.dateStr);

              return (
                <Pressable
                  key={day.dateStr}
                  onPress={() => setSelectedDate(day.dateStr)}
                  style={[
                    styles.dayCard,
                    isSelected && styles.dayCardSelected,
                    day.isToday && !isSelected && styles.dayCardToday,
                  ]}
                  accessibilityLabel={`${day.dayName} ${day.dayNumber}`}
                  accessibilityRole="button"
                >
                  <Text
                    variant="caption"
                    style={[
                      styles.dayName,
                      isSelected ? styles.textSelected : day.isToday ? styles.textToday : null,
                    ]}
                  >
                    {day.dayName}
                  </Text>
                  <Text
                    variant="titleMedium"
                    style={[
                      styles.dayNumber,
                      isSelected ? styles.textSelected : day.isToday ? styles.textToday : null,
                    ]}
                  >
                    {day.dayNumber}
                  </Text>

                  {/* Schedule Dot Indicator */}
                  <View style={styles.dotContainer}>
                    {hasSchedule ? (
                      <View
                        style={[
                          styles.dot,
                          isSelected ? styles.dotSelected : styles.dotActive,
                        ]}
                      />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 4. Selected Date Header */}
        <View style={styles.dateHeaderRow}>
          <Text variant="titleMedium" style={styles.dateHeaderTitle}>
            {formatReadableDate(selectedDate)}
          </Text>
          {selectedDateWorkouts.length > 0 ? (
            <Text variant="caption" style={styles.countBadge}>
              {selectedDateWorkouts.length} {selectedDateWorkouts.length === 1 ? 'WORKOUT' : 'WORKOUTS'}
            </Text>
          ) : null}
        </View>

        {/* 5. Main Schedule List / Empty State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E5A93C" />
          </View>
        ) : selectedDateWorkouts.length > 0 ? (
          <View style={styles.scheduleList}>
            {selectedDateWorkouts.map((workout) => (
              <ScheduledWorkoutCard
                key={workout.id}
                scheduledWorkout={workout}
                templateName={workout.templateId ? templateNames[workout.templateId] : null}
                onView={handleOpenPreview}
                onEdit={handleOpenEditModal}
                onSkip={handleSkipWorkout}
                onDelete={handleDeleteWorkout}
              />
            ))}
          </View>
        ) : (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyIconBox}>
              <Icon name="calendar" size={32} color={colors.textSecondary} />
            </View>
            <Text variant="titleMedium" style={styles.emptyTitle}>
              No workouts scheduled
            </Text>
            <Text variant="body" style={styles.emptySubtitle}>
              You don't have any training sessions planned for this date.
            </Text>
            <Button
              title="+ Schedule Workout"
              variant="primary"
              size="md"
              onPress={handleOpenCreateModal}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}
      </ScreenScrollView>

      {/* Schedule Create / Edit Modal */}
      <ScheduleModal
        visible={modalVisible}
        initialDate={selectedDate}
        scheduledWorkout={editingWorkout}
        onClose={() => setModalVisible(false)}
        onSave={loadCalendarData}
      />

      {/* Scheduled Workout Read-Only Preview Modal */}
      <ScheduledWorkoutPreviewModal
        visible={previewVisible}
        scheduledWorkout={previewWorkout}
        onClose={() => setPreviewVisible(false)}
        onStart={(workout) => {
          setPreviewVisible(false);
          handleStartScheduledWorkout(workout);
        }}
      />
    </ScreenContainer>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: spacing.xxl,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.xs,
    },
    headerTextGroup: {
      flex: 1,
      marginRight: spacing.md,
    },
    title: {
      color: colors.textPrimary,
      fontWeight: '800',
      fontSize: 22,
    },
    subtitle: {
      color: colors.textSecondary,
      marginTop: 2,
      fontSize: 13,
    },
    headerBtn: {
      minWidth: 100,
      paddingHorizontal: spacing.sm,
    },
    monthNavRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
      backgroundColor: '#111218',
      borderRadius: radii.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    monthTitleBox: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    monthTitle: {
      color: colors.textPrimary,
      fontWeight: '700',
      fontSize: 16,
    },
    todayBadge: {
      backgroundColor: 'rgba(229, 169, 60, 0.2)',
      borderColor: '#E5A93C',
      borderWidth: 1,
      borderRadius: radii.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginLeft: spacing.sm,
    },
    todayBadgeText: {
      color: '#E5A93C',
      fontSize: 10,
      fontWeight: '800',
    },
    monthControls: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    todayBtn: {
      backgroundColor: '#181A22',
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.md,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 5,
      marginRight: spacing.xs,
    },
    todayBtnText: {
      color: colors.textPrimary,
      fontWeight: '600',
      fontSize: 12,
    },
    navArrowBtn: {
      padding: 6,
      marginLeft: 2,
    },
    weekSectionContainer: {
      marginBottom: spacing.lg,
    },
    weekHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs + 2,
      paddingHorizontal: spacing.xs,
    },
    weekSectionLabel: {
      color: colors.textSecondary,
      fontWeight: '800',
      fontSize: 11,
      letterSpacing: 0.8,
    },
    weekNavControls: {
      flexDirection: 'row',
      gap: 12,
    },
    weekNavBtn: {
      paddingVertical: 2,
    },
    weekNavText: {
      color: '#E5A93C',
      fontWeight: '700',
      fontSize: 12,
    },
    weekStripContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    dayCard: {
      flex: 1,
      backgroundColor: '#111218',
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.md,
      paddingVertical: spacing.md - 2,
      alignItems: 'center',
      marginHorizontal: 2,
    },
    dayCardSelected: {
      backgroundColor: '#E5A93C',
      borderColor: '#E5A93C',
    },
    dayCardToday: {
      borderColor: '#E5A93C',
    },
    dayName: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    dayNumber: {
      color: colors.textPrimary,
      fontWeight: '800',
      fontSize: 16,
    },
    textSelected: {
      color: '#090D16',
    },
    textToday: {
      color: '#E5A93C',
    },
    dotContainer: {
      height: 6,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 4,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
    },
    dotActive: {
      backgroundColor: '#E5A93C',
    },
    dotSelected: {
      backgroundColor: '#090D16',
    },
    dateHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    dateHeaderTitle: {
      color: colors.textPrimary,
      fontWeight: '700',
      fontSize: 16,
    },
    countBadge: {
      color: colors.textSecondary,
      fontWeight: '700',
      fontSize: 11,
      letterSpacing: 0.5,
    },
    scheduleList: {
      marginBottom: spacing.xl,
    },
    loadingContainer: {
      paddingVertical: spacing.xxl,
      alignItems: 'center',
    },
    emptyCard: {
      backgroundColor: '#111218',
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.lg,
      padding: spacing.xl,
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    emptyIconBox: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#181A22',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontWeight: '700',
      marginBottom: 4,
    },
    emptySubtitle: {
      color: colors.textSecondary,
      textAlign: 'center',
      fontSize: 13,
      maxWidth: 240,
    },
  });
