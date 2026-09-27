import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useAppTheme } from '../../features/theme';
import { ObservabilitySyncStatus } from '../../services/sync';

interface SyncStatusChipProps {
  status: ObservabilitySyncStatus;
  style?: StyleProp<ViewStyle>;
}

export function SyncStatusChip({ status, style }: SyncStatusChipProps) {
  const { colors } = useAppTheme();

  const getStatusConfig = () => {
    switch (status) {
      case 'SAVED_TO_CLOUD':
        return { label: 'Saved to cloud', color: '#10B981' };
      case 'WAITING_TO_SYNC':
        return { label: 'Waiting to sync', color: '#F59E0B' };
      case 'SYNCING':
        return { label: 'Syncing', color: '#3B82F6' };
      case 'SYNC_FAILED':
        return { label: 'Sync failed', color: '#EF4444' };
      case 'LOCAL_ONLY':
      default:
        return { label: 'Local only', color: colors.textSecondary || '#9CA3AF' };
    }
  };

  const config = getStatusConfig();

  return (
    <View
      accessibilityLabel={config.label}
      accessibilityRole="text"
      style={[styles.dot, { backgroundColor: config.color }, style]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    alignSelf: 'center',
  },
});
