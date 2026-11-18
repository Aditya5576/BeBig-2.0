import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../src/features/theme';
import { Text, Card } from '../../src/components/ui';
import { spacing, radii } from '../../src/constants/theme';

export default function PrivacyPolicyScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]} testID="privacy-policy-screen">
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          testID="privacy-back-button"
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Text variant="bodyBold" color="accent" style={styles.backButtonText}>
            ‹ Back
          </Text>
        </Pressable>
        <Text variant="titleMedium" color="primary" style={styles.navTitle}>
          Privacy Policy
        </Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.headerCard}>
          <Text variant="headingMedium" color="primary" style={styles.title}>
            Data Transparency & Privacy
          </Text>
          <Text variant="caption" color="muted" style={styles.lastUpdated}>
            Last Updated: November 17, 2026 • Version 2.4.1
          </Text>
          <Text variant="body" color="secondary" style={styles.introText}>
            BeBig 2.0 is designed with an offline-first architecture. We believe your athletic training,
            performance records, and personal notes belong to you. This policy outlines how your data is
            handled, stored, and deleted across our mobile and web applications.
          </Text>
        </Card>

        {/* 1. What Data We Collect */}
        <Card style={styles.sectionCard}>
          <Text variant="titleMedium" color="accent" style={styles.sectionHeading}>
            1. Data We Collect & Store
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • <Text variant="bodyBold" color="primary">Account Information:</Text> Email address and authentication credentials for registered users. Guest athletes store zero personal account identifiers.
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • <Text variant="bodyBold" color="primary">Workout & Training Logs:</Text> Exercise names, weights, repetitions, set classifications (normal, warmup, drop, failure), RIR notes, timestamps, total volume, and superset pairings.
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • <Text variant="bodyBold" color="primary">Templates & Custom Exercises:</Text> Custom routine templates, user-created exercise names, target muscles, equipment tags, and exercise instructions.
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • <Text variant="bodyBold" color="primary">Media & Photos:</Text> Profile avatars and custom exercise form photos uploaded by the user.
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • <Text variant="bodyBold" color="primary">Fitness Preferences:</Text> Training goals, experience level, workout duration, and preferred weekly training frequency.
          </Text>
        </Card>

        {/* 2. Third-Party Service Providers */}
        <Card style={styles.sectionCard}>
          <Text variant="titleMedium" color="accent" style={styles.sectionHeading}>
            2. Third-Party Data Processors
          </Text>
          <Text variant="body" color="secondary" style={styles.paragraph}>
            We do not sell, rent, or monetize your training data. Third-party infrastructure is used exclusively to operate the application:
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • <Text variant="bodyBold" color="primary">Supabase:</Text> Cloud PostgreSQL database, user authentication (JWT), and secure storage buckets. Database access is strictly governed by PostgreSQL Row-Level Security (RLS).
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • <Text variant="bodyBold" color="primary">Vercel:</Text> Progressive Web App (PWA) static hosting and global CDN distribution.
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • <Text variant="bodyBold" color="primary">Sentry:</Text> Anonymous runtime crash monitoring and error diagnostics. PII and workout payloads are masked and excluded from diagnostic events.
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • <Text variant="bodyBold" color="primary">Wger:</Text> Open-source exercise catalog API used for demonstration illustrations and muscle reference data. No user data is sent to Wger.
          </Text>
        </Card>

        {/* 3. Local Device Storage & Browser Security */}
        <Card style={styles.sectionCard}>
          <Text variant="titleMedium" color="accent" style={styles.sectionHeading}>
            3. Local Device Storage & Threat Model (AUD-011)
          </Text>
          <Text variant="body" color="secondary" style={styles.paragraph}>
            BeBig 2.0 utilizes an offline-first storage engine:
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • <Text variant="bodyBold" color="primary">Web (PWA):</Text> Data is cached locally in your browser&apos;s IndexedDB and localStorage. While origin-isolated by the browser sandbox, local browser storage is unencrypted at rest by standard web engines. Users on shared or public computers should use private browsing or execute &quot;Erase Local Device Data&quot; upon completing their workout session.
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • <Text variant="bodyBold" color="primary">Native Mobile (iOS & Android):</Text> Authentication tokens and sensitive keys are stored within hardware-backed security modules (Apple Keychain and Android KeyStore via SecureStore).
          </Text>
        </Card>

        {/* 4. Data Erasure & Account Deletion */}
        <Card style={styles.sectionCard}>
          <Text variant="titleMedium" color="accent" style={styles.sectionHeading}>
            4. Self-Service Deletion & Data Rights (AUD-006)
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • <Text variant="bodyBold" color="primary">Erase Local Device Data:</Text> Available in Settings for both guest and registered athletes. Instantly wipes all locally cached workouts, active drafts, custom exercises, sync watermarks, and preferences from this physical device.
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • <Text variant="bodyBold" color="primary">Delete Account & Cloud Data:</Text> Available in Settings for registered athletes. Authenticates your identity, purges all database records across workout logs, templates, and profiles, deletes all uploaded avatar and exercise photos from cloud storage, records an audit deletion event, removes the authentication identity from Supabase, and wipes local device storage. Deletion is irreversible.
          </Text>
        </Card>

        {/* 5. Contact & Support */}
        <Card style={styles.sectionCard}>
          <Text variant="titleMedium" color="accent" style={styles.sectionHeading}>
            5. Contact Us
          </Text>
          <Text variant="body" color="secondary" style={styles.paragraph}>
            If you have questions regarding this privacy policy or wish to exercise data rights under GDPR/CCPA, please contact our engineering and support team:
          </Text>
          <Text variant="bodyBold" color="accent" style={styles.contactEmail}>
            privacy@bebig.app • support@bebig.app
          </Text>
        </Card>

        <View style={styles.footerSpacing} />
      </ScrollView>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      paddingVertical: spacing.xs,
      paddingRight: spacing.sm,
      minWidth: 64,
    },
    backButtonText: {
      fontSize: 16,
    },
    navTitle: {
      fontSize: 16,
      fontWeight: '700',
    },
    navSpacer: {
      minWidth: 64,
    },
    scrollContent: {
      padding: spacing.md,
      gap: spacing.md,
    },
    headerCard: {
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      gap: spacing.xs,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    lastUpdated: {
      fontSize: 12,
      marginBottom: spacing.xs,
    },
    introText: {
      lineHeight: 22,
    },
    sectionCard: {
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      gap: spacing.xs,
    },
    sectionHeading: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    paragraph: {
      lineHeight: 20,
      fontSize: 14,
    },
    contactEmail: {
      marginTop: spacing.xs,
      fontSize: 14,
    },
    footerSpacing: {
      height: 24,
    },
  });
}
