import React from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSegments } from 'expo-router';
import { Text } from './Text';
import { Button } from './Button';
import { spacing, radii } from '../../constants/theme';

export interface PwaUpdateCardProps {
  visible: boolean;
  version: string;
  highlight?: string;
  updating?: boolean;
  errorMessage?: string | null;
  onUpdateNow: () => void;
  onLater: () => void;
}

export function PwaUpdateCard({
  visible,
  version,
  highlight,
  updating = false,
  errorMessage,
  onUpdateNow,
  onLater,
}: PwaUpdateCardProps) {
  let insets = { top: 0, bottom: 0, left: 0, right: 0 };
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    insets = useSafeAreaInsets();
  } catch {
    // Fallback outside SafeAreaProvider in tests
  }

  let hasBottomNav = true;
  try {
    const segments = useSegments() as string[];
    const first = segments?.[0];
    const second = segments?.[1];
    if (
      first === 'onboarding' ||
      first === 'auth' ||
      first === 'index' ||
      first === 'admin' ||
      !first ||
      (first === 'workout' && second === 'active')
    ) {
      hasBottomNav = false;
    }
  } catch {
    hasBottomNav = false;
  }

  if (!visible) return null;

  const bottomOffset = (hasBottomNav ? 76 : 16) + Math.max(insets.bottom, 8);
  const displayVersion = version && version !== '__BEBIG_SW_VERSION__' ? `v${version.replace(/^v/i, '')}` : 'Update';

  return (
    <View
      testID="pwa-update-card"
      pointerEvents="box-none"
      style={[styles.overlay, { bottom: bottomOffset }]}
    >
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.dot} />
          <Text variant="bodyBold" style={styles.title} testID="pwa-update-title">
            {`BeBig ${displayVersion} is ready`}
          </Text>
        </View>

        {highlight ? (
          <Text variant="caption" style={styles.highlight} numberOfLines={2}>
            {highlight}
          </Text>
        ) : null}

        {errorMessage ? (
          <Text variant="caption" style={styles.errorText}>
            {errorMessage}
          </Text>
        ) : null}

        <View style={styles.actionsRow}>
          <Pressable
            testID="pwa-update-later-button"
            onPress={onLater}
            disabled={updating}
            style={styles.laterButton}
            accessibilityRole="button"
            accessibilityLabel="Later"
          >
            <Text variant="caption" style={styles.laterText}>
              Later
            </Text>
          </Pressable>

          <Button
            testID="pwa-update-now-button"
            title="Update Now"
            onPress={onUpdateNow}
            loading={updating}
            disabled={updating}
            variant="primary"
            size="sm"
            style={styles.updateButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
    zIndex: 9000,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#161B26',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 14,
  },
  highlight: {
    color: '#94A3B8',
    lineHeight: 17,
  },
  errorText: {
    color: '#F87171',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  laterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  laterText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  updateButton: {
    minWidth: 108,
  },
});
