/**
 * BeBig 2.0 — Environment Configuration
 *
 * Safely accesses client-side environment variables prefixed with EXPO_PUBLIC_.
 * Validates and provides fallback defaults for local development.
 *
 * SECURITY ARCHITECTURE NOTICE:
 * 1. Variables prefixed with EXPO_PUBLIC_ are bundled into the public client.
 * 2. NEVER add server-only secrets (e.g. SUPABASE_SERVICE_ROLE_KEY, database passwords,
 *    private provider keys) to this file or any mobile client file.
 */

export type AppEnvironment = 'development' | 'staging' | 'production';

export interface AppConfig {
  /** Target execution environment */
  readonly appEnv: AppEnvironment;
  /** Application display name */
  readonly appName: string;
  /** Semver application version */
  readonly version: string;
  /** Base API endpoint for the future BeBig backend */
  readonly apiUrl?: string;
  /** Future Supabase public URL */
  readonly supabaseUrl?: string;
  /** Future Supabase public anonymous client key (RLS restricted) */
  readonly supabaseAnonKey?: string;
  /** Convenience boolean for development mode checks */
  readonly isDev: boolean;
}

const rawAppEnv = process.env.EXPO_PUBLIC_APP_ENV;
const validEnvs: Record<string, AppEnvironment> = {
  development: 'development',
  staging: 'staging',
  production: 'production',
};

const appEnv: AppEnvironment = validEnvs[rawAppEnv ?? ''] ?? 'development';

export const env: AppConfig = Object.freeze({
  appEnv,
  appName: 'BeBig',
  version: '1.0.0',
  apiUrl: process.env.EXPO_PUBLIC_API_URL || undefined,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || undefined,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || undefined,
  isDev: appEnv === 'development',
});
