import type { CriterionKey, WritingScore } from "./schemas";

export const MIN_WORDS = { task1: 150, task2: 250 } as const;
export const MINUTES = { task1: 20, task2: 40 } as const;
export type WritingTask = keyof typeof MIN_WORDS;

/** Words = whitespace-separated tokens that contain a letter or digit. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Writing task band: mean of the four criteria, rounded DOWN to the nearest half band. */
export function taskBand(bands: number[]): number {
  const mean = bands.reduce((a, b) => a + b, 0) / bands.length;
  return Math.floor(mean * 2 + 1e-9) / 2;
}

export type FinalScores = {
  criteria: Record<CriterionKey, number>;
  raw: Record<CriterionKey, number>;
  overall: number;
  penalties: Array<"under_length" | "off_topic">;
  wordCount: number;
};

/**
 * Deterministic exam rules applied on top of the AI examiner's bands, so length
 * and relevance are always penalised the same way (bands can only go down).
 */
export function applyRules(score: WritingScore, task: WritingTask, wordCount: number): FinalScores {
  const raw = {
    task: Math.floor(score.criteria.task.band),
    coherence: Math.floor(score.criteria.coherence.band),
    lexical: Math.floor(score.criteria.lexical.band),
    grammar: Math.floor(score.criteria.grammar.band),
  };
  const min = MIN_WORDS[task];
  let taskCap = 9;
  let otherCap = 9;
  const penalties: FinalScores["penalties"] = [];

  if (wordCount < min) {
    penalties.push("under_length");
    if (wordCount >= 0.9 * min) taskCap = Math.max(0, raw.task - 1);
    else if (wordCount >= (2 / 3) * min) taskCap = 5;
    else if (wordCount >= min / 3) {
      taskCap = 4;
      otherCap = 5;
    } else {
      taskCap = 2;
      otherCap = 4;
    }
  }
  if (!score.on_topic) {
    penalties.push("off_topic");
    taskCap = Math.min(taskCap, 4);
  }

  const criteria = {
    task: Math.min(raw.task, taskCap),
    coherence: Math.min(raw.coherence, otherCap),
    lexical: Math.min(raw.lexical, otherCap),
    grammar: Math.min(raw.grammar, otherCap),
  };
  return {
    criteria,
    raw,
    overall: taskBand(Object.values(criteria)),
    penalties,
    wordCount,
  };
}

export type Correction = WritingScore["corrections"][number];
export type LocatedCorrection = Correction & { start: number; end: number };

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Find where a quoted phrase occurs in the text (whitespace/case tolerant). */
export function findQuote(text: string, quote: string): { start: number; end: number } | null {
  const q = quote.trim();
  if (!q) return null;
  const exact = text.indexOf(q);
  if (exact >= 0) return { start: exact, end: exact + q.length };
  const pattern = q.split(/\s+/).map(escapeRe).join("\\s+");
  const m = new RegExp(pattern, "i").exec(text);
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}

/**
 * Keep only corrections that quote the essay, change something, and don't
 * overlap an earlier one. Returned in text order with character positions.
 */
export function locateCorrections(text: string, corrections: Correction[]): LocatedCorrection[] {
  const found: LocatedCorrection[] = [];
  for (const c of corrections) {
    if (c.original.trim() === c.fix.trim()) continue;
    const pos = findQuote(text, c.original);
    if (!pos) continue;
    if (found.some((f) => pos.start < f.end && f.start < pos.end)) continue;
    found.push({ ...c, ...pos });
  }
  return found.sort((a, b) => a.start - b.start);
}
