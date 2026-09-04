/**
 * BeBig 2.0 — Workout & Analytics Formatters
 *
 * Centralized formatting helpers for durations, volumes, streaks, dates,
 * and chronological grouping across workout history and progress screens.
 */

export function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0 min';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0 && secs > 0) return `${mins}m ${secs}s`;
  if (mins > 0) return `${mins} min`;
  return `${secs}s`;
}

export function formatVolume(volumeKg?: number): string {
  if (!volumeKg || isNaN(volumeKg) || volumeKg <= 0) return '0 kg';
  return `${Math.round(volumeKg).toLocaleString('en-US')} kg`;
}

export function formatStreak(days: number): string {
  if (!days || isNaN(days) || days <= 0) return '0 Days';
  return `${days} ${days === 1 ? 'Day' : 'Days'}`;
}

export function formatWorkoutDate(dateStr?: string): string {
  if (!dateStr) return 'Recent';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Recent';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getMonthGroupKey(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'unknown';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getMonthGroupLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
