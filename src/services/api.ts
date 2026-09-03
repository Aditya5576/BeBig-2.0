/**
 * BeBig 2.0 — External Service Boundary
 *
 * All external networking, database access, and API calls must route through
 * defined service interfaces in this directory.
 *
 * ARCHITECTURAL RULE:
 * The mobile app does NOT talk directly to external providers like Wger.
 * Future flow: Wger -> BeBig Integration/Backend -> Mobile Client.
 */

import { env } from '../config/env';

export interface ServiceResponse<T> {
  data: T | null;
  status: number;
  error?: string;
}

/**
 * Base service configuration.
 * Ready for future HTTP / Supabase client wiring.
 */
export const serviceConfig = {
  baseUrl: env.apiUrl ?? 'https://api.bebig.app/v1',
  timeoutMs: 15000,
};
