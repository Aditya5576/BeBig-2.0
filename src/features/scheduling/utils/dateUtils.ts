/**
 * BeBig 2.0 — Scheduling Date Utilities
 *
 * Provides timezone-safe YYYY-MM-DD formatting, week strip generation,
 * future date navigation, and date display helpers for the Calendar UI.
 */

export function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getTodayIsoDate(): string {
  return formatIsoDate(new Date());
}

export function getTomorrowIsoDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatIsoDate(tomorrow);
}

export function getNextMondayIsoDate(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilNextMon = (dayOfWeek === 0 ? 1 : 8 - dayOfWeek);
  const nextMon = new Date(now);
  nextMon.setDate(now.getDate() + daysUntilNextMon);
  return formatIsoDate(nextMon);
}

export function addDaysToIsoDate(dateStr: string, daysCount: number): string {
  const date = parseIsoDate(dateStr);
  date.setDate(date.getDate() + daysCount);
  return formatIsoDate(date);
}

export function formatReadableDate(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const date = parseIsoDate(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export interface DayItem {
  dateStr: string; // YYYY-MM-DD
  dayName: string; // "Mon", "Tue"...
  dayNumber: number; // 1..31
  isToday: boolean;
  isSameMonth: boolean;
}

/**
 * Generates 7 days surrounding the given anchor date (Monday-Sunday).
 */
export function getWeekDays(anchorDateStr: string): DayItem[] {
  const anchor = parseIsoDate(anchorDateStr);
  const todayStr = getTodayIsoDate();

  // Find Monday of the week
  const dayOfWeek = anchor.getDay();
  const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);

  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + diffToMon);

  const days: DayItem[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = formatIsoDate(d);

    days.push({
      dateStr,
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: d.getDate(),
      isToday: dateStr === todayStr,
      isSameMonth: d.getMonth() === anchor.getMonth(),
    });
  }

  return days;
}
