export type Skill = "listening" | "reading" | "writing" | "speaking";
export const SKILLS: Skill[] = ["listening", "reading", "writing", "speaking"];

const EPS = 1e-9;

/**
 * Official IELTS rounding to the nearest half band:
 * fractions below .25 round down, .25–.74 become .5, .75 and above round up.
 */
export function roundHalf(value: number): number {
  const v = Math.min(9, Math.max(0, value));
  const base = Math.floor(v + EPS);
  const frac = v - base;
  let out: number;
  if (frac < 0.25 - EPS) out = base;
  else if (frac < 0.75 - EPS) out = base + 0.5;
  else out = base + 1;
  return Math.min(9, out);
}

/** Overall band = mean of the four skills, rounded the official way. */
export function overallBand(bands: Array<number | null | undefined>): number | null {
  if (bands.length !== 4) return null;
  if (bands.some((b) => b === null || b === undefined || Number.isNaN(b))) return null;
  const mean = (bands as number[]).reduce((a, b) => a + b, 0) / 4;
  return roundHalf(mean);
}

// Raw score (out of 40) -> band. Approximate public conversion tables.
// Each entry: [minimum raw score, band].
const READING_ACADEMIC: Array<[number, number]> = [
  [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6],
  [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [0, 1],
];
const LISTENING: Array<[number, number]> = [
  [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6],
  [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [0, 1],
];

/** Convert a raw score to a band. Shorter tests are scaled to /40 first. */
export function rawToBand(skill: "reading" | "listening", raw: number, max = 40): number {
  const scaled = max === 40 ? raw : Math.round((raw / max) * 40);
  const r = Math.min(40, Math.max(0, scaled));
  const table = skill === "reading" ? READING_ACADEMIC : LISTENING;
  for (const [min, band] of table) if (r >= min) return band;
  return 1;
}

/** Writing band: Task 2 counts twice as much as Task 1. */
export function writingBand(task1: number | null, task2: number | null): number | null {
  if (task1 == null && task2 == null) return null;
  if (task1 == null) return roundHalf(task2!);
  if (task2 == null) return roundHalf(task1);
  return roundHalf((task1 + 2 * task2) / 3);
}

/** Format a band for display: 7 -> "7.0", 6.5 -> "6.5", null -> "–". */
export function formatBand(band: number | null | undefined): string {
  return band == null ? "–" : band.toFixed(1);
}
