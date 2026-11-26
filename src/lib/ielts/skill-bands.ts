import { roundHalf, SKILLS, type Skill } from "./bands";

export type BandPoint = { skill: Skill; band: number | null; created_at: string };
export type SkillBands = Record<Skill, number | null>;

/**
 * Current estimate per skill: mean of the three most recent scored attempts,
 * rounded to the nearest half band.
 */
export function currentBands(attempts: BandPoint[], window = 3): SkillBands {
  const sorted = [...attempts]
    .filter((a) => a.band != null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const out = {} as SkillBands;
  for (const skill of SKILLS) {
    const recent = sorted.filter((a) => a.skill === skill).slice(0, window);
    out[skill] = recent.length
      ? roundHalf(recent.reduce((s, a) => s + (a.band as number), 0) / recent.length)
      : null;
  }
  return out;
}
