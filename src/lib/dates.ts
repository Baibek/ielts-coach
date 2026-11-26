// Date helpers that work on plain "YYYY-MM-DD" strings, so a user's day
// never shifts because of server time zones.

const DAY_MS = 86_400_000;

function toUtcMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  return fromUtcMs(toUtcMs(date) + n * DAY_MS);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}

/** The calendar date of a timestamp in a given IANA time zone. */
export function dateInTz(ts: string | Date, timeZone: string): string {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function todayIn(timeZone: string): string {
  return dateInTz(new Date(), timeZone);
}

/** 0 = Monday … 6 = Sunday */
export function weekday(date: string): number {
  return (new Date(toUtcMs(date)).getUTCDay() + 6) % 7;
}
