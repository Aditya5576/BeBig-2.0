import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/**
 * Constructs the appropriate deep-link redirect URL for authentication
 * across web, mobile dev client, and standalone production builds.
 *
 * Examples:
 * - Web Browser: https://<domain>/auth/callback or http://localhost:8081/auth/callback
 * - Standalone / Dev Client: bebig://auth/callback
 * - Expo Go: exp://<host>:<port>/--/auth/callback
 * - Manual override (if set): process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL
 */
export const getAuthRedirectUrl = (): string => {
  // Always prioritize an explicit environment variable if set
  if (
    process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL &&
    process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL !== 'undefined'
  ) {
    return process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL;
  }

  // Handle Web
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/auth/callback`;
    }
    // Fallback for SSR/SSG on Vercel
    return 'https://bebig.vercel.app/auth/callback';
  }

  // Handle Mobile
  return Linking.createURL('auth/callback');
};

