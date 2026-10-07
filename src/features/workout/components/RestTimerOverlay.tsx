import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Button, Card } from '../../../components/ui';
import { useAppTheme } from '../../theme';
import { ActiveRestTimer } from '../types';
import { spacing, radii } from '../../../constants/theme';

interface RestTimerOverlayProps {
  activeRestTimer: ActiveRestTimer;
  onExtend: (seconds: number) => void;
  onClear: () => void;
  onTogglePause?: () => void;
  onHeightChange?: (height: number) => void;
}

export function RestTimerOverlay({
  activeRestTimer,
  onExtend,
  onClear,
  onTogglePause,
  onHeightChange,
}: RestTimerOverlayProps) {
  const { colors } = useAppTheme();
  let insets = { bottom: 0, top: 0, left: 0, right: 0 };
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    insets = useSafeAreaInsets();
  } catch {
    insets = { bottom: 0, top: 0, left: 0, right: 0 };
  }
  
  const initialDiff = Math.ceil((activeRestTimer.targetEndTime - Date.now()) / 1000);
  const [restRemaining, setRestRemaining] = useState<number>(
    activeRestTimer.isPaused
      ? (activeRestTimer.pausedRemainingSeconds ?? 0)
      : Math.max(0, initialDiff),
  );
  const [isFinished, setIsFinished] = useState<boolean>(!activeRestTimer.isPaused && initialDiff <= 0);
  const [progressPercent, setProgressPercent] = useState<number>(0);

  useEffect(() => {
    const checkRest = () => {
      if (activeRestTimer.isPaused) {
        const remaining = activeRestTimer.pausedRemainingSeconds ?? 0;
        setRestRemaining((prev) => (prev !== remaining ? remaining : prev));
        setIsFinished((prev) => (prev !== false ? false : prev));
        const totalSec = activeRestTimer.durationSeconds || 1;
        const progress = Math.min(100, Math.max(0, ((totalSec - remaining) / totalSec) * 100));
        setProgressPercent((prev) => (prev !== progress ? progress : prev));
        return;
      }

      const now = Date.now();
      const diff = Math.ceil((activeRestTimer.targetEndTime - now) / 1000);
      
      const totalMs = activeRestTimer.durationSeconds * 1000;
      let progress = 100;
      if (totalMs > 0) {
        const startMs = activeRestTimer.targetEndTime - totalMs;
        const elapsedMs = now - startMs;
        progress = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
      }
      setProgressPercent((prev) => (prev !== progress ? progress : prev));

      if (diff <= 0) {
        setRestRemaining((prev) => (prev !== 0 ? 0 : prev));
        setIsFinished((prev) => (prev !== true ? true : prev));
      } else {
        setRestRemaining((prev) => (prev !== diff ? diff : prev));
        setIsFinished((prev) => (prev !== false ? false : prev));
      }
    };

    checkRest();
    if (activeRestTimer.isPaused) return;

    const interval = setInterval(checkRest, 1000);
    return () => clearInterval(interval);
  }, [
    activeRestTimer.targetEndTime,
    activeRestTimer.durationSeconds,
    activeRestTimer.isPaused,
    activeRestTimer.pausedRemainingSeconds,
  ]);

  const formatTime = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const styles = useMemo(() => createStyles(colors, insets), [colors, insets.bottom]);

  if (isFinished) {
    return (
      <View
        testID="persistent-rest-overlay"
        pointerEvents="box-none"
        style={styles.persistentRestOverlay}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0) onHeightChange?.(h);
        }}
      >
        <Card style={styles.restCompleteCard} testID="rest-complete-banner">
          <View style={styles.restCompleteContent}>
            <View style={styles.restCompleteInfo}>
              <Text variant="caption" style={styles.restCompleteLabel}>
                REST COMPLETE
              </Text>
              <Text variant="body" color="primary" style={styles.restCompleteTitle}>
                Ready for your next set!
              </Text>
              {activeRestTimer.exerciseName ? (
                <Text variant="caption" color="secondary" numberOfLines={1} style={styles.nextExerciseText}>
                  Target rest finished for {activeRestTimer.exerciseName}
                </Text>
              ) : null}
            </View>
            <Button
              testID="dismiss-rest-timer-button"
              title="Dismiss"
              onPress={onClear}
              variant="primary"
              size="md"
              style={styles.dismissRestButton}
            />
          </View>
        </Card>
      </View>
    );
  }

  return (
    <View
      testID="persistent-rest-overlay"
      pointerEvents="box-none"
      style={styles.persistentRestOverlay}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0) onHeightChange?.(h);
      }}
    >
      <Card style={styles.restBannerCard} testID="rest-timer-banner">
        {/* Progress Bar Background */}
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>

        {/* Top Level: Context + Dominant Countdown */}
        <View style={styles.timerHeaderRow}>
          <View style={styles.timerContext}>
            <View style={styles.restTag}>
              <Text variant="caption" style={styles.restTagText}>
                REST
              </Text>
            </View>
            {activeRestTimer.exerciseName ? (
              <Text variant="caption" color="secondary" numberOfLines={1} style={styles.exerciseNameText}>
                {activeRestTimer.exerciseName}
              </Text>
            ) : null}
          </View>

          <Text
            testID="rest-countdown-text"
            tabularNums
            style={[
              styles.restCountdownText,
              activeRestTimer.isPaused ? styles.restCountdownPaused : null,
            ]}
          >
            {activeRestTimer.isPaused ? `PAUSED (${formatTime(restRemaining)})` : formatTime(restRemaining)}
          </Text>
        </View>

        {/* Bottom Level: Comfortable Controls Row */}
        <View style={styles.controlsRow}>
          <Button
            testID="extend-rest-minus-15-button"
            title="-15s"
            onPress={() => onExtend(-15)}
            variant="outline"
            size="sm"
            style={styles.adjustButton}
          />
          {onTogglePause && (
            <Button
              testID="toggle-pause-rest-timer-button"
              title={activeRestTimer.isPaused ? 'RESUME' : 'PAUSE'}
              onPress={onTogglePause}
              variant="outline"
              size="sm"
              style={styles.actionButton}
            />
          )}
          <Button
            testID="skip-rest-timer-button"
            title="SKIP"
            onPress={onClear}
            variant="secondary"
            size="sm"
            style={styles.skipButton}
          />
          <Button
            testID="extend-rest-plus-15-button"
            title="+15s"
            onPress={() => onExtend(15)}
            variant="outline"
            size="sm"
            style={styles.adjustButton}
          />
        </View>
      </Card>
    </View>
  );
}

const createStyles = (colors: any, insets: { bottom: number }) => StyleSheet.create({
  persistentRestOverlay: {
    position: 'absolute',
    bottom: Math.max(insets.bottom, 8) + 4,
    left: 10,
    right: 10,
    backgroundColor: 'transparent',
    zIndex: 100,
  },
  restBannerCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderLight,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
    overflow: 'hidden',
  },
  restCompleteCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  progressBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: colors.borderLight,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  timerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 1,
  },
  timerContext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  restTag: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  restTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.primary,
  },
  exerciseNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    flexShrink: 1,
  },
  restCountdownText: {
    fontWeight: '800',
    fontSize: 21,
    lineHeight: 25,
    letterSpacing: 0.5,
    color: colors.primary,
    textAlign: 'right',
  },
  restCountdownPaused: {
    fontSize: 17,
    lineHeight: 21,
    color: colors.warning || colors.primary,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  adjustButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 0,
    borderRadius: 6,
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.borderLight,
  },
  actionButton: {
    flex: 1.2,
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 0,
    borderRadius: 6,
  },
  skipButton: {
    flex: 1.0,
    minHeight: 34,
    paddingHorizontal: 8,
    paddingVertical: 0,
    borderRadius: 6,
  },
  restCompleteContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  restCompleteInfo: {
    flex: 1,
    gap: 1,
  },
  restCompleteLabel: {
    fontWeight: '800',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    color: colors.success,
  },
  restCompleteTitle: {
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 17,
  },
  nextExerciseText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dismissRestButton: {
    minHeight: 34,
    paddingHorizontal: 16,
    paddingVertical: 0,
    borderRadius: 6,
  },
});
