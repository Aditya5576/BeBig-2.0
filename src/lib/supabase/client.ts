import { createClient } from '@supabase/supabase-js';
import { ExpoSecureStoreAdapter } from './storage';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const rawAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-anon-key';

/**
 * Checks whether valid Supabase credentials have been configured
 * via environment variables.
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    rawUrl &&
    rawAnonKey &&
    rawUrl !== 'https://your-project.supabase.co' &&
    rawAnonKey !== 'your-supabase-public-anon-key-here' &&
    rawUrl.startsWith('https://'),
  );
};

const supabaseUrl = isSupabaseConfigured() && rawUrl ? rawUrl : PLACEHOLDER_URL;
const supabaseAnonKey = isSupabaseConfigured() && rawAnonKey ? rawAnonKey : PLACEHOLDER_KEY;

/**
 * BeBig 2.0 Supabase Client Instance
 *
 * Configured with:
 * - Public anon key only (Never use service-role key in mobile app)
 * - Expo SecureStore for encrypted token persistence
 * - Automatic background token refresh
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
