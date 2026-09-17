import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Icon } from '../ui';
import { useAuthStore } from '../../features/auth';
import { colors, radii } from '../../constants/theme';

export function BottomNavBar() {
  const router = typeof useRouter === 'function' ? useRouter() : null;
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
  
  let insets = { top: 0, bottom: 0, left: 0, right: 0 };
  try {
    const hookInsets = useSafeAreaInsets();
    if (hookInsets) {
      insets = hookInsets;
    }
  } catch {
    // In environments/tests without SafeAreaProvider
  }

  const status = useAuthStore((state) => state.status);
  const isGuest = useAuthStore((state) => state.isGuest);

  const firstSegment = segments[0];
  const secondSegment = segments[1];

  // Hidden conditions:
  // 1. Not logged in and not guest
  // 2. Onboarding questionnaire or onboarding auth
  // 3. Auth callback / redirect screens
  // 4. Active workout in progress
  // 5. Root splash / loading screen
  const isHidden =
    (status !== 'authenticated' && !isGuest) ||
    firstSegment === 'onboarding' ||
    firstSegment === 'auth' ||
    firstSegment === 'index' ||
    firstSegment === 'admin' ||
    !firstSegment ||
    (firstSegment === 'workout' && secondSegment === 'active');

  if (isHidden) {
    return null;
  }

  const isHomeActive = firstSegment === 'home';
  const isHistoryActive = firstSegment === 'workout' && secondSegment === 'history';
  const isWorkoutActive = firstSegment === 'workout' && (secondSegment === 'start' || secondSegment === 'new');
  const isExercisesActive = firstSegment === 'exercises';
  const isProfileActive = firstSegment === 'settings';

  const navigateTo = (path: string) => {
    if (router) {
      router.push(path as any);
    }
  };

  return (
    <View
      testID="bottom-nav-bar"
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      {/* 1. Home Tab */}
      <Pressable
        testID="tab-home"
        onPress={() => navigateTo('/home')}
        accessibilityLabel="Home"
        accessibilityRole="tab"
        accessibilityState={{ selected: isHomeActive }}
        style={styles.tabItem}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name="home" size={20} focused={isHomeActive} />
        <Text
          variant="caption"
          style={[styles.tabLabel, isHomeActive ? styles.tabLabelActive : styles.tabLabelInactive]}
        >
          Home
        </Text>
      </Pressable>

      {/* 2. History Tab */}
      <Pressable
        testID="tab-history"
        onPress={() => navigateTo('/workout/history')}
        accessibilityLabel="History"
        accessibilityRole="tab"
        accessibilityState={{ selected: isHistoryActive }}
        style={styles.tabItem}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name="history" size={20} focused={isHistoryActive} />
        <Text
          variant="caption"
          style={[styles.tabLabel, isHistoryActive ? styles.tabLabelActive : styles.tabLabelInactive]}
        >
          History
        </Text>
      </Pressable>

      {/* 3. Center Workout Tab (Elevated Action) */}
      <Pressable
        testID="tab-workout"
        onPress={() => navigateTo('/workout/start')}
        accessibilityLabel="Start Workout"
        accessibilityRole="button"
        accessibilityState={{ selected: isWorkoutActive }}
        style={styles.centerTabWrapper}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={[styles.centerButton, isWorkoutActive && styles.centerButtonActive]}>
          <Icon name="workout" size={22} color="#090D16" />
        </View>
        <Text
          variant="caption"
          style={[styles.tabLabel, isWorkoutActive ? styles.tabLabelActive : styles.tabLabelInactive]}
        >
          Workout
        </Text>
      </Pressable>

      {/* 4. Exercises Tab */}
      <Pressable
        testID="tab-exercises"
        onPress={() => navigateTo('/exercises')}
        accessibilityLabel="Exercises"
        accessibilityRole="tab"
        accessibilityState={{ selected: isExercisesActive }}
        style={styles.tabItem}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name="exercises" size={20} focused={isExercisesActive} />
        <Text
          variant="caption"
          style={[styles.tabLabel, isExercisesActive ? styles.tabLabelActive : styles.tabLabelInactive]}
        >
          Exercises
        </Text>
      </Pressable>

      {/* 5. Profile / Settings Tab */}
      <Pressable
        testID="tab-profile"
        onPress={() => navigateTo('/settings')}
        accessibilityLabel="Profile"
        accessibilityRole="tab"
        accessibilityState={{ selected: isProfileActive }}
        style={styles.tabItem}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name="profile" size={20} focused={isProfileActive} />
        <Text
          variant="caption"
          style={[styles.tabLabel, isProfileActive ? styles.tabLabelActive : styles.tabLabelInactive]}
        >
          Profile
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#111218',
    borderTopWidth: 1,
    borderTopColor: colors.dark.border,
    paddingTop: 8,
    minHeight: 64,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
    gap: 3,
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.6,
  },
  tabIconActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: '#E5A93C',
  },
  tabLabelInactive: {
    color: colors.dark.textMuted,
  },
  centerTabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    minHeight: 56,
    gap: 3,
  },
  centerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5A93C',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E5A93C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#111218',
  },
  centerButtonActive: {
    backgroundColor: '#FFD700',
    transform: [{ scale: 1.05 }],
  },
  centerButtonIcon: {
    fontSize: 22,
  },
});
