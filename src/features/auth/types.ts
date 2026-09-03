/**
 * BeBig 2.0 — Authentication Boundary Types
 *
 * Types for identity providers and session management.
 * In Milestone 2, these define the service contract ahead of Supabase Auth integration.
 */

export type AuthProvider = 'apple' | 'google' | 'email';

export interface AuthUser {
  id: string;
  email: string | null;
  provider: AuthProvider;
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
}

export interface AuthResult {
  success: boolean;
  message: string;
  session?: AuthSession;
}
