import { addDays } from "@/lib/dates";

/**
 * Consecutive days with any study activity, ending today.
 * If today has no activity yet, the streak still counts up to yesterday.
 */
export function computeStreak(activityDates: string[], today: string): number {
  const days = new Set(activityDates);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
