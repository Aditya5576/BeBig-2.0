import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from './Text';
import { useAppTheme } from '../../features/theme';
import { radii } from '../../constants/theme';
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
        return { label: 'SAVED TO CLOUD', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', icon: '🟢' };
      case 'WAITING_TO_SYNC':
        return { label: 'WAITING TO SYNC', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', icon: '🟡' };
      case 'SYNCING':
        return { label: 'SYNCING', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)', icon: '🔵' };
      case 'SYNC_FAILED':
        return { label: 'SYNC FAILED', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', icon: '🔴' };
      case 'LOCAL_ONLY':
      default:
        return { label: 'LOCAL ONLY', color: colors.textSecondary, bg: 'rgba(156, 163, 175, 0.15)', icon: '⚪' };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={[styles.container, { backgroundColor: config.bg, borderColor: config.color }, style]}>
      <Text style={[styles.text, { color: config.color }]}>
        {config.icon} {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
