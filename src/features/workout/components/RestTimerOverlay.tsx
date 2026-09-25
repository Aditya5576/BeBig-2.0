import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Button, Card } from '../../../components/ui';
import { useAppTheme } from '../../theme';
import { ActiveRestTimer } from '../types';
import { spacing } from '../../../constants/theme';

interface RestTimerOverlayProps {
  activeRestTimer: ActiveRestTimer;
  onExtend: (seconds: number) => void;
  onClear: () => void;
}

export function RestTimerOverlay({
  activeRestTimer,
  onExtend,
  onClear,
}: RestTimerOverlayProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  
  const [restRemaining, setRestRemaining] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);

  useEffect(() => {
    const checkRest = () => {
      const now = Date.now();
      const diff = Math.ceil((activeRestTimer.targetEndTime - now) / 1000);
      
      const totalMs = activeRestTimer.durationSeconds * 1000;
      if (totalMs > 0) {
        const startMs = activeRestTimer.targetEndTime - totalMs;
        const elapsedMs = now - startMs;
        const progress = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
        setProgressPercent(progress);
      } else {
        setProgressPercent(100);
      }

      if (diff <= 0) {
        setRestRemaining(0);
        setIsFinished(true);
      } else {
        setRestRemaining(diff);
        setIsFinished(false);
      }
    };

    checkRest();
    const interval = setInterval(checkRest, 1000);
    return () => clearInterval(interval);
  }, [activeRestTimer.targetEndTime, activeRestTimer.durationSeconds]);

  const formatTime = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const styles = createStyles(colors, insets);

  if (isFinished) {
    return (
      <View style={styles.persistentRestOverlay}>
        <Card style={styles.restCompleteCard} testID="rest-complete-banner">
          <View style={styles.restBannerContent}>
            <View style={styles.restInfo}>
              <Text variant="caption" style={styles.restCompleteLabel}>
                REST COMPLETE
              </Text>
              <Text variant="body" color="primary" style={styles.restCompleteTitle}>
                Ready for your next set!
              </Text>
              {activeRestTimer.exerciseName ? (
                <Text variant="caption" color="secondary" numberOfLines={1}>
                  Target rest finished for {activeRestTimer.exerciseName}
                </Text>
              ) : null}
            </View>
            <Button
              testID="dismiss-rest-timer-button"
              title="Dismiss"
              onPress={onClear}
              variant="primary"
              size="sm"
              style={styles.dismissRestButton}
            />
          </View>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.persistentRestOverlay}>
      <Card style={styles.restBannerCard} testID="rest-timer-banner">
        {/* Progress Bar Background */}
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>

        <View style={styles.restBannerContentCenter}>
          <View style={styles.timerHeader}>
            <Text variant="display" color="primary" tabularNums style={styles.restCountdownText}>
              {formatTime(restRemaining)}
            </Text>
            {activeRestTimer.exerciseName ? (
              <Text variant="body" color="secondary" numberOfLines={1}>
                Next: {activeRestTimer.exerciseName}
              </Text>
            ) : null}
          </View>

          <View style={styles.controlsRow}>
            <Button
              testID="extend-rest-minus-15-button"
              title="-15s"
              onPress={() => onExtend(-15)}
              variant="outline"
              size="sm"
              style={styles.adjustButton}
            />
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
        </View>
      </Card>
    </View>
  );
}

const createStyles = (colors: any, insets: { bottom: number }) => StyleSheet.create({
  persistentRestOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: Math.max(insets.bottom, 12),
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 10,
    zIndex: 50,
  },
  restBannerCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
    borderWidth: 1.5,
    padding: spacing.md,
    overflow: 'hidden',
  },
  restCompleteCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.success,
    borderWidth: 1.5,
    padding: spacing.sm,
  },
  progressBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.borderLight,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  restBannerContentCenter: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  timerHeader: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  restCountdownText: {
    fontWeight: '900',
    letterSpacing: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    width: '100%',
  },
  adjustButton: {
    minHeight: 36,
    minWidth: 70,
    paddingHorizontal: spacing.sm,
  },
  skipButton: {
    minHeight: 36,
    minWidth: 100,
    paddingHorizontal: spacing.md,
  },
  restBannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restInfo: {
    flex: 1,
    gap: 2,
  },
  restCompleteLabel: {
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.success,
  },
  restCompleteTitle: {
    fontWeight: '800',
  },
  dismissRestButton: {
    minHeight: 40,
    minWidth: 90,
  },
});
