import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { AuthResult, AuthSession, AuthUser } from '../types';
import { getAuthRedirectUrl } from '../utils/redirect';

export interface IAuthService {
  signUpWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithApple: () => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  getCurrentSession: () => Promise<AuthSession | null>;
  getAuthRedirectUrl: () => string;
  handleIncomingAuthUrl: (url: string) => Promise<AuthResult>;
  onAuthStateChange: (callback: (event: string, session: AuthSession | null) => void) => {
    unsubscribe: () => void;
  };
}

const mapSupabaseUser = (user: any): AuthUser => ({
  id: user.id,
  email: user.email ?? null,
  provider: user.app_metadata?.provider,
  createdAt: user.created_at,
});

const mapSupabaseSession = (session: any): AuthSession => ({
  user: mapSupabaseUser(session.user),
  accessToken: session.access_token,
  refreshToken: session.refresh_token,
});

const getErrorMessage = (error: any, fallback: string): string => {
  if (!error) return fallback;
  const msg = typeof error === 'string' ? error : error.message || '';
  if (msg.includes('Invalid login credentials')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (msg.includes('User already registered') || msg.includes('already exists')) {
    return 'An account with this email already exists. Please sign in.';
  }
  if (msg.includes('Email not confirmed')) {
    return 'Please confirm your email address before signing in.';
  }
  if (msg.includes('Password should be at least')) {
    return 'Password must be at least 6 characters long.';
  }
  if (msg.includes('Network') || msg.includes('fetch')) {
    return 'Unable to reach authentication service. Please check your connection.';
  }
  return msg || fallback;
};

export const authService: IAuthService = {
  getAuthRedirectUrl: (): string => {
    return getAuthRedirectUrl();
  },

  signUpWithEmail: async (email: string, password: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        message: 'Supabase credentials are not configured. Please add them to your .env file.',
      };
    }

    const sanitizedEmail = email.trim().toLowerCase();
    if (!sanitizedEmail || !sanitizedEmail.includes('@')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }
    if (password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters.' };
    }

    try {
      const redirectUrl = getAuthRedirectUrl();

      const { data, error } = await supabase.auth.signUp({
        email: sanitizedEmail,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        const msg = error.message || '';
        const isAlreadyRegistered =
          /already registered|already exists|user already exists/i.test(msg) ||
          error.code === 'user_already_exists';
        return {
          success: false,
          message: isAlreadyRegistered
            ? 'An account with this email already exists. Please sign in.'
            : getErrorMessage(error, 'Sign up failed.'),
          isUserAlreadyRegistered: isAlreadyRegistered,
        };
      }

      if (!data.user) {
        return { success: false, message: 'Sign up failed. Please try again.' };
      }

      // Check if user already exists (Supabase returns fake user with empty identities when email enumeration protection is on)
      if (data.user.identities && data.user.identities.length === 0) {
        return {
          success: false,
          message: 'An account with this email already exists. Please sign in.',
          isUserAlreadyRegistered: true,
        };
      }

      // If email confirmation is required, session will be null
      if (data.user && !data.session) {
        return {
          success: true,
          message: 'Check your inbox for a confirmation link to finish creating your account.',
          user: mapSupabaseUser(data.user),
          requiresEmailConfirmation: true,
        };
      }

      const session = data.session ? mapSupabaseSession(data.session) : null;
      return {
        success: true,
        message: 'Account created successfully.',
        session,
        user: session?.user ?? mapSupabaseUser(data.user),
      };
    } catch (err: any) {
      const msg = err?.message || '';
      const isAlreadyRegistered =
        /already registered|already exists|user already exists/i.test(msg) ||
        err?.code === 'user_already_exists';
      return {
        success: false,
        message: isAlreadyRegistered
          ? 'An account with this email already exists. Please sign in.'
          : getErrorMessage(err, 'Sign up encountered an unexpected error.'),
        isUserAlreadyRegistered: isAlreadyRegistered,
      };
    }
  },

  signInWithEmail: async (email: string, password: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        message: 'Supabase credentials are not configured. Please add them to your .env file.',
      };
    }

    const sanitizedEmail = email.trim().toLowerCase();
    if (!sanitizedEmail || !sanitizedEmail.includes('@')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password,
      });

      if (error) {
        const msg = error.message || '';
        const isNonExistent =
          error.code === 'user_not_found' ||
          error.status === 404 ||
          /user not found|no user found|account not found|email not found/i.test(msg);
        const isInvalidCredentials =
          error.code === 'invalid_credentials' ||
          /invalid login credentials|invalid credentials/i.test(msg);

        return {
          success: false,
          message: isNonExistent
            ? "We couldn't find an account with this email. Create an account to get started."
            : isInvalidCredentials
              ? "Incorrect email or password. Please try again or create an account."
              : getErrorMessage(error, 'Sign in failed.'),
          isNonExistentUser: isNonExistent,
          isInvalidCredentials,
        };
      }

      if (!data.session) {
        return { success: false, message: 'No session established. Please verify credentials.' };
      }

      const session = mapSupabaseSession(data.session);
      return {
        success: true,
        message: 'Signed in successfully.',
        session,
        user: session.user,
      };
    } catch (err: any) {
      const msg = err?.message || '';
      const isNonExistent =
        err?.code === 'user_not_found' ||
        err?.status === 404 ||
        /user not found|no user found|account not found|email not found/i.test(msg);
      const isInvalidCredentials =
        err?.code === 'invalid_credentials' ||
        /invalid login credentials|invalid credentials/i.test(msg);

      return {
        success: false,
        message: isNonExistent
          ? "We couldn't find an account with this email. Create an account to get started."
          : isInvalidCredentials
            ? "Invalid email or password. Please try again or create an account."
            : getErrorMessage(err, 'Sign in encountered an unexpected error.'),
        isNonExistentUser: isNonExistent,
        isInvalidCredentials,
      };
    }
  },

  signInWithApple: async (): Promise<AuthResult> => {
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        message: 'Supabase credentials are not configured. Please add them to your .env file.',
      };
    }

    if (Platform.OS === 'web') {
      try {
        const redirectUrl = getAuthRedirectUrl();
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: {
            redirectTo: redirectUrl,
          },
        });

        if (error) {
          return {
            success: false,
            message: getErrorMessage(error, 'Apple OAuth initialization failed.'),
          };
        }

        if (data?.url && typeof window !== 'undefined') {
          window.location.assign(data.url);
          return {
            success: true,
            message: 'Redirecting to Apple...',
          };
        }

        return {
          success: false,
          message: 'Failed to retrieve Apple authentication URL from Supabase.',
        };
      } catch (err) {
        return {
          success: false,
          message: getErrorMessage(err, 'Apple Sign In encountered an unexpected error.'),
        };
      }
    }

    if (Platform.OS !== 'ios') {
      return {
        success: false,
        message: 'Sign in with Apple is supported on Apple iOS devices.',
      };
    }

    try {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        return {
          success: false,
          message: 'Apple authentication is not available on this device.',
        };
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return {
          success: false,
          message: 'Apple Sign In did not provide a valid identity token.',
        };
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) {
        return {
          success: false,
          message: getErrorMessage(error, 'Failed to authenticate with Apple.'),
        };
      }

      if (!data.session) {
        return {
          success: false,
          message: 'Apple authentication completed without an active session.',
        };
      }

      const session = mapSupabaseSession(data.session);
      return {
        success: true,
        message: 'Signed in with Apple successfully.',
        session,
        user: session.user,
      };
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED') {
        return { success: false, message: 'Apple Sign In was cancelled.' };
      }
      return {
        success: false,
        message: getErrorMessage(
          err,
          'Apple Sign In failed. Ensure Apple Developer configuration is complete.',
        ),
      };
    }
  },

  signInWithGoogle: async (): Promise<AuthResult> => {
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        message: 'Supabase credentials are not configured. Please add them to your .env file.',
      };
    }

    try {
      const redirectUrl = getAuthRedirectUrl();

      if (Platform.OS === 'web') {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
          },
        });

        if (error) {
          return {
            success: false,
            message: getErrorMessage(error, 'Google OAuth initialization failed.'),
          };
        }

        if (data?.url && typeof window !== 'undefined') {
          window.location.assign(data.url);
          return {
            success: true,
            message: 'Redirecting to Google...',
          };
        }

        return {
          success: false,
          message: 'Failed to retrieve Google authentication URL from Supabase.',
        };
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        return {
          success: false,
          message: getErrorMessage(error, 'Google OAuth initialization failed.'),
        };
      }

      if (!data?.url) {
        return {
          success: false,
          message: 'Failed to retrieve Google authentication URL from Supabase.',
        };
      }

      const authResult = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (authResult.type === 'cancel' || authResult.type === 'dismiss') {
        return { success: false, message: 'Google Sign In was cancelled.' };
      }

      if (authResult.type === 'success' && authResult.url) {
        return authService.handleIncomingAuthUrl(authResult.url);
      }

      return {
        success: false,
        message: 'Google authentication did not return a valid session.',
      };
    } catch (err) {
      return {
        success: false,
        message: getErrorMessage(err, 'Google Sign In encountered an unexpected error.'),
      };
    }
  },

  handleIncomingAuthUrl: async (urlStr: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        message: 'Supabase credentials are not configured.',
      };
    }

    try {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(urlStr);
      } catch {
        const fakeBase = 'https://bebig.app';
        const normalized = urlStr.includes('://')
          ? urlStr.replace(/^[a-zA-Z0-9+.-]+:\/\//, 'https://bebig.app/')
          : `${fakeBase}/${urlStr}`;
        parsedUrl = new URL(normalized);
      }

      // 1. Check for errors in query params
      const searchParams = parsedUrl.searchParams;
      const errorDesc = searchParams.get('error_description') || searchParams.get('error');
      if (errorDesc) {
        return {
          success: false,
          message: decodeURIComponent(errorDesc.replace(/\+/g, ' ')),
        };
      }

      // 2. Check for PKCE authorization code
      const code = searchParams.get('code');
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          return {
            success: false,
            message: getErrorMessage(error, 'Failed to verify confirmation code.'),
          };
        }
        if (data.session) {
          const session = mapSupabaseSession(data.session);
          return {
            success: true,
            message: 'Email confirmed successfully.',
            session,
            user: session.user,
          };
        }
      }

      // 3. Check for token_hash & type (email verification OTP link)
      const tokenHash = searchParams.get('token_hash');
      const otpType = searchParams.get('type');
      if (tokenHash && otpType) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType as any,
        });
        if (error) {
          return {
            success: false,
            message: getErrorMessage(error, 'Failed to verify confirmation token.'),
          };
        }
        if (data.session) {
          const session = mapSupabaseSession(data.session);
          return {
            success: true,
            message: 'Email confirmed successfully.',
            session,
            user: session.user,
          };
        }
      }

      // 4. Check for hash parameters (implicit grant tokens)
      const hash = parsedUrl.hash.startsWith('#') ? parsedUrl.hash.substring(1) : '';
      if (hash) {
        const hashParams = new URLSearchParams(hash);
        const hashError = hashParams.get('error_description') || hashParams.get('error');
        if (hashError) {
          return {
            success: false,
            message: decodeURIComponent(hashError.replace(/\+/g, ' ')),
          };
        }

        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            return {
              success: false,
              message: getErrorMessage(error, 'Failed to establish session from tokens.'),
            };
          }
          if (data.session) {
            const session = mapSupabaseSession(data.session);
            return {
              success: true,
              message: 'Email confirmed successfully.',
              session,
              user: session.user,
            };
          }
        }
      }

      // 5. Fallback: check if session is already established
      const currentSession = await authService.getCurrentSession();
      if (currentSession) {
        return {
          success: true,
          message: 'Authenticated successfully.',
          session: currentSession,
          user: currentSession.user,
        };
      }

      return {
        success: false,
        message: 'No active session or confirmation tokens found in link.',
      };
    } catch (err) {
      return {
        success: false,
        message: getErrorMessage(err, 'Failed to process confirmation link.'),
      };
    }
  },

  signOut: async (): Promise<AuthResult> => {
    if (!isSupabaseConfigured()) {
      return { success: true, message: 'Signed out locally.' };
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return { success: false, message: getErrorMessage(error, 'Sign out failed.') };
      }
      return { success: true, message: 'Signed out successfully.' };
    } catch (err) {
      return {
        success: false,
        message: getErrorMessage(err, 'Sign out encountered an error.'),
      };
    }
  },

  getCurrentSession: async (): Promise<AuthSession | null> => {
    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) return null;
      return mapSupabaseSession(data.session);
    } catch {
      return null;
    }
  },

  onAuthStateChange: (callback) => {
    if (!isSupabaseConfigured()) {
      return { unsubscribe: () => {} };
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const mappedSession = session ? mapSupabaseSession(session) : null;
      callback(event, mappedSession);
    });

    return {
      unsubscribe: () => {
        listener.subscription.unsubscribe();
      },
    };
  },
};
