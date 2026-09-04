import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../src/constants/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.dark.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="home" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="exercises/index" />
        <Stack.Screen name="exercises/[id]" />
        <Stack.Screen name="exercises/new" />
        <Stack.Screen name="templates/index" />
        <Stack.Screen name="templates/new" />
        <Stack.Screen name="templates/[id]" />
        <Stack.Screen name="workout/start" />
        <Stack.Screen name="workout/active" />
        <Stack.Screen name="workout/summary" />
        <Stack.Screen name="workout/history" />
        <Stack.Screen name="workout/history/[id]" />
        <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
