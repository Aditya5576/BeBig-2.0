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
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    const envUrl = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL;
    if (envUrl && envUrl !== 'undefined' && envUrl.startsWith('http')) {
      return envUrl;
    }
    return `${window.location.origin}/auth/callback`;
  }

  if (
    process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL &&
    process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL !== 'undefined'
  ) {
    return process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL;
  }
  return Linking.createURL('auth/callback');
};

