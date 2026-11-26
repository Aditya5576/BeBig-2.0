/**
 * BeBig 2.0 — Canonical Domain Input & Storage Limits (AUD-024)
 *
 * Single source of truth for client text/collection caps to prevent storage bloat,
 * UI layout overflow, oversized sync payloads, and abuse across mobile & web.
 */

export const DOMAIN_LIMITS = {
  DISPLAY_NAME_MAX_LENGTH: 60,
  WORKOUT_NAME_MAX_LENGTH: 80,
  TEMPLATE_NAME_MAX_LENGTH: 80,
  EXERCISE_NAME_MAX_LENGTH: 80,
  EXERCISE_INSTRUCTIONS_MAX_LENGTH: 2000,
  MUSCLE_LIST_INPUT_MAX_LENGTH: 200,
  SET_NOTES_MAX_LENGTH: 500,
  AVATAR_URL_MAX_LENGTH: 1000,
  MAX_EXERCISES_PER_WORKOUT: 50,
  MAX_SETS_PER_EXERCISE: 30,
  MAX_AI_MESSAGE_CHARS: 4000,
  RIR_MIN: 0,
  RIR_MAX: 4,
  TREADMILL_INCLINE_MIN: 0,
  TREADMILL_INCLINE_MAX: 50,
  TREADMILL_SPEED_MIN: 0.1,
  TREADMILL_SPEED_MAX: 40,
  TREADMILL_DURATION_SECONDS_MIN: 1,
  TREADMILL_DURATION_SECONDS_MAX: 86400,
} as const;

/**
 * Safely clamps text to maxLength and strips null bytes (0x00).
 * Never mutates valid strings already within limits.
 */
export function clampText(value: string | null | undefined, maxLength: number): string {
  if (!value) return '';
  const cleaned = value.replace(/\0/g, '');
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return cleaned.slice(0, maxLength);
}
