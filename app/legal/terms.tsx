import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../src/features/theme';
import { Text, Card } from '../../src/components/ui';
import { spacing, radii } from '../../src/constants/theme';

export default function TermsOfServiceScreen() {
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
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]} testID="terms-of-service-screen">
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          testID="terms-back-button"
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Text variant="bodyBold" color="accent" style={styles.backButtonText}>
            ‹ Back
          </Text>
        </Pressable>
        <Text variant="titleMedium" color="primary" style={styles.navTitle}>
          Terms of Service
        </Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.headerCard}>
          <Text variant="headingMedium" color="primary" style={styles.title}>
            Terms & Conditions
          </Text>
          <Text variant="caption" color="muted" style={styles.lastUpdated}>
            Last Updated: November 17, 2026 • Version 2.4.1
          </Text>
          <Text variant="body" color="secondary" style={styles.introText}>
            Welcome to BeBig 2.0. By using our application, websites, or services, you agree to comply with
            and be bound by the following terms and conditions.
          </Text>
        </Card>

        {/* 1. Health & Physical Activity Disclaimer */}
        <Card style={styles.sectionCard}>
          <Text variant="titleMedium" color="accent" style={styles.sectionHeading}>
            1. Athletic Training & Health Disclaimer
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • BeBig 2.0 is a workout logging and athletic tracking tool. It does not provide medical diagnoses, physical therapy, or healthcare advice.
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • Resistance training, weightlifting, and intense physical exercise involve inherent risks of physical injury. Consult a physician before starting any training routine.
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • You are entirely responsible for selecting appropriate weights, adhering to proper form, utilizing safety equipment (e.g., barbell collars, spotter arms), and listening to your body.
          </Text>
        </Card>

        {/* 2. User Accounts & Security */}
        <Card style={styles.sectionCard}>
          <Text variant="titleMedium" color="accent" style={styles.sectionHeading}>
            2. User Accounts & Responsibilities
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • You may use BeBig 2.0 as a guest (local storage only) or as a registered athlete with cloud synchronization.
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • If you register an account, you are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • You agree not to upload content that infringes upon third-party intellectual property or violates applicable laws.
          </Text>
        </Card>

        {/* 3. Ownership & Intellectual Property */}
        <Card style={styles.sectionCard}>
          <Text variant="titleMedium" color="accent" style={styles.sectionHeading}>
            3. Intellectual Property & Your Content
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • <Text variant="bodyBold" color="primary">Your Content:</Text> You retain full ownership of your workout logs, custom routine templates, and custom exercise media.
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • <Text variant="bodyBold" color="primary">App Software:</Text> The BeBig brand, logo, design system, algorithms, and application code are the proprietary property of BeBig.
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • <Text variant="bodyBold" color="primary">Open Content:</Text> Exercise illustrations from Wger are distributed under Creative Commons Attribution-ShareAlike licenses.
          </Text>
        </Card>

        {/* 4. Service Availability & Account Termination */}
        <Card style={styles.sectionCard}>
          <Text variant="titleMedium" color="accent" style={styles.sectionHeading}>
            4. Service Availability & Termination
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • We provide BeBig 2.0 on an &quot;as is&quot; and &quot;as available&quot; basis. Offline tracking capabilities continue to function without network connectivity.
          </Text>
          <Text variant="body" color="primary" style={styles.paragraph}>
            • You may terminate your account and erase all cloud data at any time through Settings → Delete Account.
          </Text>
        </Card>

        {/* 5. Contact */}
        <Card style={styles.sectionCard}>
          <Text variant="titleMedium" color="accent" style={styles.sectionHeading}>
            5. Inquiries & Contact
          </Text>
          <Text variant="body" color="secondary" style={styles.paragraph}>
            For legal notices, terms inquiries, or support requests, please reach out to:
          </Text>
          <Text variant="bodyBold" color="accent" style={styles.contactEmail}>
            legal@bebig.app • support@bebig.app
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
