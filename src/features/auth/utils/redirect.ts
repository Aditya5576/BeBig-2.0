import * as Linking from 'expo-linking';

/**
 * Constructs the appropriate deep-link redirect URL for authentication
 * across both Expo Go development and standalone production builds.
 *
 * Examples:
 * - Standalone / Dev Client: bebig://auth/callback
 * - Expo Go: exp://<host>:<port>/--/auth/callback
 * - Manual override (if set): process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL
 */
export const getAuthRedirectUrl = (): string => {
  if (
    process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL &&
    process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL !== 'undefined'
  ) {
    return process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL;
  }
  return Linking.createURL('auth/callback');
};
