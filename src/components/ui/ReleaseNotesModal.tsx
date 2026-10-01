/**
 * BeBig 2.0 — Release Notes Modal Dialog
 *
 * Version-specific "What's New" notification rendered once per app release.
 * Local-first, offline, non-blocking.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSegments } from 'expo-router';
import { Text } from './Text';
import { Button } from './Button';
import { useAppTheme } from '../../features/theme';
import { radii, spacing } from '../../constants/theme';
import { getAppVersionInfo } from '../../config/version';
import { releaseNotesService } from '../../lib/releaseNotes/releaseNotesService';

export interface ReleaseNotesModalProps {
  forcedVersion?: string;
  onDismiss?: () => void;
  autoCheck?: boolean;
}

export function ReleaseNotesModal({
  forcedVersion,
  onDismiss,
  autoCheck = true,
}: ReleaseNotesModalProps) {
  const { colors } = useAppTheme();
  let insets = { top: 0, bottom: 0, left: 0, right: 0 };
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    insets = useSafeAreaInsets();
  } catch {
    insets = { top: 0, bottom: 0, left: 0, right: 0 };
  }

  let segments: string[] = [];
  try {
    if (typeof useSegments === 'function') {
      const segs = useSegments();
      if (Array.isArray(segs)) {
        segments = segs;
      }
    }
  } catch {
    segments = [];
  }

  const firstSegment = segments[0];
  // Active splash screen conditions: app/index gatekeeper screen active or initializing
  const isSplashActive = firstSegment === 'index' || firstSegment === '(index)' || !firstSegment;

  const styles = useMemo(() => createStyles(colors), [colors]);

  const appVersion = forcedVersion || getAppVersionInfo().version;
  const [visible, setVisible] = useState(false);
  const [notes, setNotes] = useState(() =>
    releaseNotesService.getReleaseNotesForVersion(appVersion),
  );

  useEffect(() => {
    setNotes(releaseNotesService.getReleaseNotesForVersion(appVersion));

    if (!autoCheck || isSplashActive) {
      return;
    }

    let isMounted = true;
    void (async () => {
      try {
        const shouldShow = await releaseNotesService.shouldShowReleaseNotes(appVersion);
        if (isMounted && shouldShow) {
          setVisible(true);
        }
      } catch {
        // Non-blocking fallback
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [appVersion, autoCheck, isSplashActive]);

  const handleDismiss = async () => {
    setVisible(false);
    try {
      await releaseNotesService.acknowledgeReleaseNotes(appVersion);
    } catch {
      // Non-blocking acknowledgement
    }
    onDismiss?.();
  };

  if (!visible || isSplashActive) {
    return null;
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleDismiss}
      testID="release-notes-modal"
    >
      <Pressable
        testID="release-notes-backdrop"
        style={styles.backdrop}
        onPress={handleDismiss}
      >
        <Pressable
          testID="release-notes-container"
          style={styles.dialogCard}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.badgeContainer}>
              <Text variant="caption" style={styles.badgeText}>
                v{appVersion}
              </Text>
            </View>
            <Text variant="titleMedium" color="primary" style={styles.headerTitle}>
              🎉 What's New
            </Text>
          </View>

          {/* Highlights List */}
          <ScrollView style={styles.contentScroll} bounces={false}>
            <View style={styles.bulletsContainer}>
              {notes.highlights.map((item, index) => (
                <View key={index} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text variant="body" color="primary" style={styles.bulletText}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Action Button */}
          <View style={styles.actionContainer}>
            <Button
              testID="release-notes-dismiss-button"
              title="Got it"
              variant="primary"
              size="md"
              onPress={handleDismiss}
              style={styles.dismissButton}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
      zIndex: 9999,
    },
    dialogCard: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: colors.surfaceElevated || colors.surface,
      borderColor: colors.borderLight,
      borderWidth: 1.5,
      borderRadius: radii.xl,
      padding: spacing.lg,
      gap: spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 20,
    },
    headerRow: {
      alignItems: 'flex-start',
      gap: spacing.xs,
    },
    badgeContainer: {
      backgroundColor: colors.primary + '25',
      borderColor: colors.primary,
      borderWidth: 1,
      borderRadius: radii.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    badgeText: {
      color: colors.primary,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    headerTitle: {
      fontWeight: '900',
      letterSpacing: 0.3,
    },
    contentScroll: {
      maxHeight: 240,
    },
    bulletsContainer: {
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    bulletDot: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: 'bold',
      lineHeight: 22,
    },
    bulletText: {
      flex: 1,
      lineHeight: 22,
      fontWeight: '500',
    },
    actionContainer: {
      marginTop: spacing.xs,
    },
    dismissButton: {
      width: '100%',
      minHeight: 44,
    },
  });
