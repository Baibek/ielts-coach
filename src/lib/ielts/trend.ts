import { dateInTz } from "@/lib/dates";
import { roundHalf, SKILLS, type Skill } from "./bands";
import type { BandPoint } from "./skill-bands";

export type TrendRow = { date: string } & Partial<Record<Skill, number>>;

/** One row per day with that day's average band per skill (oldest first). */
export function buildTrend(points: BandPoint[], timeZone: string): TrendRow[] {
  const byDay = new Map<string, Record<Skill, number[]>>();
  for (const p of points) {
    if (p.band == null) continue;
    const day = dateInTz(p.created_at, timeZone);
    if (!byDay.has(day)) byDay.set(day, { listening: [], reading: [], writing: [], speaking: [] });
    byDay.get(day)![p.skill].push(p.band);
  }
  return [...byDay.keys()].sort().map((date) => {
    const row: TrendRow = { date };
    const vals = byDay.get(date)!;
    for (const s of SKILLS) if (vals[s].length) row[s] = roundHalf(vals[s].reduce((a, b) => a + b, 0) / vals[s].length);
    return row;
  });
}
