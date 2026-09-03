/**
 * BeBig 2.0 — Authentication Service Boundary
 *
 * Defines the contract for external authentication providers.
 *
 * MILESTONE 2 BOUNDARY RULE:
 * Real authentication and Supabase connections are NOT implemented yet.
 * No fake accounts or synthetic login sessions are created.
 */

import { AuthResult } from '../types';

export interface IAuthService {
  signInWithApple: () => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signInWithEmail: (email: string) => Promise<AuthResult>;
}

export const authService: IAuthService = {
  signInWithApple: async (): Promise<AuthResult> => {
    // Real Supabase Apple OAuth will be connected in Milestone 3.
    return {
      success: false,
      message: 'Apple Sign-In is scheduled for Milestone 3 with Supabase integration.',
    };
  },

  signInWithGoogle: async (): Promise<AuthResult> => {
    // Real Supabase Google OAuth will be connected in Milestone 3.
    return {
      success: false,
      message: 'Google Sign-In is scheduled for Milestone 3 with Supabase integration.',
    };
  },

  signInWithEmail: async (email: string): Promise<AuthResult> => {
    // Real Supabase OTP/Email auth will be connected in Milestone 3.
    const sanitizedEmail = email.trim();
    return {
      success: false,
      message: `Email authentication (${sanitizedEmail}) is scheduled for Milestone 3 with Supabase integration.`,
    };
  },
};
