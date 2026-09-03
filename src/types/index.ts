/**
 * BeBig 2.0 — Shared TypeScript Definitions
 */

/** Generic UUID identifier */
export type UUID = string;

/** ISO 8601 UTC timestamp string */
export type IsoDateString = string;

/** Platform identifier */
export type SupportedPlatform = 'ios' | 'android' | 'web';

/** Standard Async Data State for feature loaders */
export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

/** Result type for robust error handling without unhandled exceptions */
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };
