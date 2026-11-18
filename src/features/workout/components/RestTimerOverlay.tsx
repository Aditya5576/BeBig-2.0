import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Text, Button, Card, Icon } from '../../../components/ui';
import { FONT_FAMILIES, NUMERIC_TABULAR_STYLE } from '../../../theme/typography';
import { useAppTheme } from '../../theme';
import { ActiveRestTimer } from '../types';

type RestTimerColors = ReturnType<typeof useAppTheme>['colors'];

interface RestTimerOverlayProps {
  activeRestTimer: ActiveRestTimer;
  onExtend: (seconds: number) => void;
  onClear: () => void;
  onTogglePause?: () => void;
  onHeightChange?: (height: number) => void;
  initialCollapsed?: boolean;
}

interface CountdownRingProps {
  progressPercent: number;
  size: number;
  strokeWidth: number;
  trackColor: string;
  progressColor: string;
  testID?: string;
}

/**
 * Lightweight vector countdown ring powered by react-native-svg (0 KB bitmap memory).
 */
function CountdownRing({
  progressPercent,
  size,
  strokeWidth,
  trackColor,
  progressColor,
  testID = 'rest-timer-progress-ring',
}: CountdownRingProps) {
  const clamped = Math.min(100, Math.max(0, progressPercent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const remainingFraction = Math.max(0, Math.min(1, (100 - clamped) / 100));
  const strokeDashoffset = circumference * (1 - remainingFraction);
  const center = size / 2;

  return (
    <View style={{ width: size, height: size }} testID={testID}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
    </View>
  );
}

export function RestTimerOverlay({
  activeRestTimer,
  onExtend,
  onClear,
  onTogglePause,
  onHeightChange,
  initialCollapsed = false,
}: RestTimerOverlayProps) {
  const { colors, activeMode } = useAppTheme();
  let insets = { bottom: 0, top: 0, left: 0, right: 0 };
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    insets = useSafeAreaInsets();
  } catch {
    insets = { bottom: 0, top: 0, left: 0, right: 0 };
  }

  const [isCollapsed, setIsCollapsed] = useState<boolean>(initialCollapsed);
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

  const bottomInset = insets.bottom;
  const isDark = activeMode !== 'light';
  const styles = useMemo(
    () => createStyles(colors, { bottom: bottomInset }, isDark),
    [colors, bottomInset, isDark],
  );

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
              <View style={styles.completeTitleRow}>
                <Icon name="check" size={13} strokeWidth={3} color={colors.primary} />
                <Text variant="caption" style={styles.restCompleteLabel}>
                  REST COMPLETE
                </Text>
              </View>
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

  const ringColor = activeRestTimer.isPaused ? colors.warning : colors.primary;

  if (isCollapsed) {
    return (
      <View
        testID="persistent-rest-overlay"
        pointerEvents="box-none"
        style={[styles.persistentRestOverlay, styles.collapsedOverlayContainer]}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0) onHeightChange?.(h);
        }}
      >
        <View style={styles.collapsedPill} testID="rest-timer-collapsed-pill">
          <Pressable
            testID="rest-timer-collapse-toggle"
            onPress={() => setIsCollapsed(false)}
            style={styles.collapsedMainTapArea}
            accessibilityRole="button"
            accessibilityLabel="Expand rest timer controls"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 6 }}
          >
            <CountdownRing
              progressPercent={progressPercent}
              size={28}
              strokeWidth={3}
              trackColor={colors.borderLight}
              progressColor={ringColor}
            />
            <Text
              testID="rest-countdown-text"
              tabularNums
              style={[
                styles.collapsedCountdownText,
                activeRestTimer.isPaused ? styles.restCountdownPaused : null,
              ]}
            >
              {activeRestTimer.isPaused ? `PAUSED (${formatTime(restRemaining)})` : formatTime(restRemaining)}
            </Text>
            <Icon name="chevronUp" size={14} strokeWidth={2.5} color={colors.textSecondary} />
          </Pressable>

          <View style={styles.collapsedDivider} />

          <Pressable
            testID="skip-rest-timer-button"
            onPress={onClear}
            style={styles.collapsedSkipButton}
            accessibilityRole="button"
            accessibilityLabel="Skip rest timer"
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
          >
            <Text variant="caption" style={styles.collapsedSkipText}>
              SKIP
            </Text>
          </Pressable>
        </View>
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

        {/* Top Level: SVG Countdown Ring + Context + Dominant Countdown + Collapse Toggle */}
        <View style={styles.timerHeaderRow}>
          <View style={styles.timerContext}>
            <CountdownRing
              progressPercent={progressPercent}
              size={30}
              strokeWidth={3}
              trackColor={colors.borderLight}
              progressColor={ringColor}
            />
            <View style={styles.timerContextLabels}>
              <View style={styles.restTagRow}>
                <View style={styles.restTag}>
                  <Icon name="clock" size={10} strokeWidth={2.5} color={colors.primary} />
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
            </View>
          </View>

          <View style={styles.headerRightCluster}>
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
            <Pressable
              testID="rest-timer-collapse-toggle"
              onPress={() => setIsCollapsed(true)}
              style={styles.collapseIconButton}
              accessibilityRole="button"
              accessibilityLabel="Collapse rest timer to compact pill"
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Icon name="chevronDown" size={16} strokeWidth={2.5} color={colors.textSecondary} />
            </Pressable>
          </View>
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

const createStyles = (colors: RestTimerColors, insets: { bottom: number }, isDark: boolean) => {
  const pillSurfaceBg = isDark ? '#131A26' : colors.surface;
  const pillBorderColor = isDark ? 'rgba(56, 189, 248, 0.42)' : colors.borderLight;

  return StyleSheet.create({
  persistentRestOverlay: {
    position: 'absolute',
    bottom: Math.max(insets.bottom, 8) + 4,
    left: 10,
    right: 10,
    backgroundColor: 'transparent',
    zIndex: 100,
  },
  collapsedOverlayContainer: {
    alignItems: 'center',
  },
  collapsedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: pillSurfaceBg,
    borderColor: colors.primary,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 12,
    paddingVertical: 6,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.42,
    shadowRadius: 12,
    elevation: 8,
  },
  collapsedMainTapArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsedCountdownText: {
    fontFamily: FONT_FAMILIES.display,
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.4,
    color: colors.primary,
    ...NUMERIC_TABULAR_STYLE,
  },
  collapsedDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.borderLight,
  },
  collapsedSkipButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 999,
  },
  collapsedSkipText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  restBannerCard: {
    backgroundColor: pillSurfaceBg,
    borderColor: pillBorderColor,
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    gap: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.42,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  restCompleteCard: {
    backgroundColor: pillSurfaceBg,
    borderColor: colors.primary,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.42,
    shadowRadius: 12,
    elevation: 8,
  },
  completeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  timerContextLabels: {
    flex: 1,
    minWidth: 0,
  },
  restTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  headerRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  collapseIconButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 229, 153, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 153, 0.3)',
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
    fontFamily: FONT_FAMILIES.display,
    fontWeight: '800',
    fontSize: 21,
    lineHeight: 25,
    letterSpacing: 0.5,
    color: colors.primary,
    textAlign: 'right',
    ...NUMERIC_TABULAR_STYLE,
  },
  restCountdownPaused: {
    fontSize: 17,
    lineHeight: 21,
    color: colors.warning,
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
};
