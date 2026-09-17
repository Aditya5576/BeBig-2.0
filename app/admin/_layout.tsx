import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Slot, useRouter, usePathname, Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminAuth } from '../../src/hooks/useAdminAuth';
import { useAuthStore } from '../../src/features/auth';
import { colors } from '../../src/constants/theme';

export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuthStore();
  const { isLoading, hasAdminAccess, role } = useAdminAuth();

  // 1. Unauthenticated or not initialized
  if (status === 'initializing' || isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.dark.primary} />
      </View>
    );
  }

  // 2. Unauthenticated -> redirect to normal app entry
  if (status === 'unauthenticated') {
    return <Redirect href="/onboarding/welcome" />;
  }

  // 3. Authenticated but unauthorized
  if (!hasAdminAccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Unauthorized Access</Text>
          <Text style={styles.errorSubtext}>You do not have permission to view the Admin panel.</Text>
          <Pressable style={styles.button} onPress={() => router.replace('/home')}>
            <Text style={styles.buttonText}>Return Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // 4. Authorized Admin Layout
  const links = [
    { name: 'Dashboard', path: '/admin' },
    { name: 'Users', path: '/admin/users' },
    { name: 'Coaches', path: '/admin/coaches' },
    { name: 'Exercises', path: '/admin/exercises' },
    { name: 'Templates', path: '/admin/templates' },
    { name: 'Analytics', path: '/admin/analytics' },
    { name: 'Monitoring', path: '/admin/monitoring' },
    { name: 'Cloud Health', path: '/admin/cloud-health' },
    { name: 'Feature Flags', path: '/admin/feature-flags' },
    { name: 'Admins & Roles', path: '/admin/roles' },
    { name: 'Audit Logs', path: '/admin/audit' },
    { name: 'Developer Tools', path: '/admin/dev-tools' },
    { name: 'Settings', path: '/admin/settings' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BeBig Admin</Text>
        <Text style={styles.headerRole}>Role: {role}</Text>
        <Pressable onPress={() => router.replace('/home')}>
          <Text style={styles.exitText}>Exit to App</Text>
        </Pressable>
      </View>
      
      <View style={styles.layout}>
        {/* Sidebar for Desktop/Tablet - Simple Scrollable View */}
        <View style={styles.sidebar}>
          <ScrollView>
            {links.map((link) => {
              const isActive = pathname === link.path;
              return (
                <Pressable
                  key={link.name}
                  style={[styles.navItem, isActive && styles.navItemActive]}
                  onPress={() => router.push(link.path as any)}
                >
                  <Text style={[styles.navText, isActive && styles.navTextActive]}>
                    {link.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          <Slot />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a', // Distinct from normal app
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#0a0a0a',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorSubtext: {
    color: '#888',
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.dark.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerRole: {
    color: colors.dark.primary,
    fontSize: 14,
    textTransform: 'uppercase',
  },
  exitText: {
    color: '#888',
    fontSize: 14,
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 200,
    backgroundColor: '#111',
    borderRightWidth: 1,
    borderRightColor: '#222',
  },
  navItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  navItemActive: {
    backgroundColor: '#222',
    borderLeftWidth: 3,
    borderLeftColor: colors.dark.primary,
  },
  navText: {
    color: '#888',
    fontSize: 14,
  },
  navTextActive: {
    color: colors.dark.primary,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 24,
    backgroundColor: '#0a0a0a',
  },
});
