/**
 * BeBig 2.0 — Authentication Boundary Types
 *
 * Types for identity providers, sessions, and reactive auth states.
 * Supports Authenticated (cloud-backed via Supabase), Guest (local-only),
 * and Unauthenticated states.
 */

export type AuthProvider = 'apple' | 'google' | 'email';

export interface AuthUser {
  id: string;
  email: string | null;
  provider?: AuthProvider;
  createdAt?: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
}

export interface GuestSession {
  id: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface AuthResult {
  success: boolean;
  message: string;
  session?: AuthSession | null;
  user?: AuthUser | null;
  requiresEmailConfirmation?: boolean;
}

export type AuthStatus = 'initializing' | 'authenticated' | 'guest' | 'unauthenticated';

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  session: AuthSession | null;
  guestSession: GuestSession | null;
  isGuest: boolean;
  isConfigured: boolean;
  error: string | null;
}

export type OwnerType = 'authenticated' | 'guest';

export interface UserScope {
  ownerId: string;
  ownerType: OwnerType;
}
