// Pure Speaking logic: test script, speech metrics and exam rules (unit-tested).
import { z } from "zod";
import { CORRECTION_CATEGORIES } from "@/lib/writing/schemas";
import type { CueCard, Part1Set, Part2Set } from "./bank";

export type SpeakingPart = 0 | 1 | 2 | 3; // 0 = full test
export type ScriptItem = {
  part: 1 | 2 | 3;
  question: string;
  intro?: string;      // examiner sentence said before the question
  cue?: CueCard;       // Part 2 card
  prepSec?: number;    // Part 2: 60
  maxSec: number;      // recording limit
};

export const MAX_SEC = { 1: 45, 2: 120, 3: 75 } as const;

export function buildScript(part: SpeakingPart, p1: Part1Set | null, p2: Part2Set | null): ScriptItem[] {
  const items: ScriptItem[] = [];
  if ((part === 1 || part === 0) && p1) {
    const qs = part === 0 ? p1.questions.slice(0, 4) : p1.questions;
    qs.forEach((q, i) =>
      items.push({
        part: 1,
        question: q,
        maxSec: MAX_SEC[1],
        intro: i === 0 ? `Now, in this first part, I'd like to ask you some questions about ${p1.topic}.` : undefined,
      }),
    );
  }
  if ((part === 2 || part === 0) && p2) {
    items.push({
      part: 2,
      question: p2.cue.topic,
      cue: p2.cue,
      prepSec: 60,
      maxSec: MAX_SEC[2],
      intro:
        "Now I'm going to give you a topic, and I'd like you to talk about it for one to two minutes. Before you talk, you'll have one minute to think about what you're going to say. You can make some notes if you wish.",
    });
  }
  if ((part === 3 || part === 0) && p2) {
    p2.p3.forEach((q, i) =>
      items.push({
        part: 3,
        question: q,
        maxSec: MAX_SEC[3],
        intro: i === 0 ? `We've been talking about ${p2.p3Theme}. I'd like to discuss with you some more general questions related to this.` : undefined,
      }),
    );
  }
  return items;
}

export type Segment = { start: number; end: number; avg_logprob?: number };

export type Metrics = {
  words: number;
  durationSec: number;
  wpm: number;
  fillers: number;
  longPauses: number | null;   // gaps over 1.5 s inside the answer (null = unknown)
  maxPauseSec: number | null;
  startDelaySec: number | null; // silence before the first word
  clarity: number | null;       // 0–1 speech-recognition confidence (rough proxy only)
};

const FILLER_RE = /\b(u+m+|u+h+|e+r+m*|hm+|a+h+)\b|\byou know\b/gi;

export function countFillers(text: string): number {
  return (text.match(FILLER_RE) ?? []).length;
}

export function computeMetrics(transcript: string, durationSec: number, segments: Segment[] | null): Metrics {
  const words = transcript.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const minutes = Math.max(durationSec, 1) / 60;
  let longPauses: number | null = null;
  let maxPauseSec: number | null = null;
  let startDelaySec: number | null = null;
  let clarity: number | null = null;
  if (segments && segments.length) {
    const sorted = [...segments].sort((a, b) => a.start - b.start);
    longPauses = 0;
    maxPauseSec = 0;
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].start - sorted[i - 1].end;
      if (gap > 1.5) longPauses++;
      maxPauseSec = Math.max(maxPauseSec, gap);
    }
    maxPauseSec = Math.round(maxPauseSec * 10) / 10;
    startDelaySec = Math.round(sorted[0].start * 10) / 10;
    const probs = sorted.filter((s) => typeof s.avg_logprob === "number").map((s) => Math.exp(s.avg_logprob as number));
    clarity = probs.length ? Math.round((probs.reduce((a, b) => a + b, 0) / probs.length) * 100) / 100 : null;
  }
  return {
    words,
    durationSec: Math.round(durationSec),
    wpm: Math.round(words / minutes),
    fillers: countFillers(transcript),
    longPauses,
    maxPauseSec,
    startDelaySec,
    clarity,
  };
}

// ---------- AI examiner output ----------
const Criterion = z.object({
  band: z.coerce.number().min(0).max(9),
  comment: z.string().min(1),
  next_step: z.string().default(""),
});

export const SpeakingScore = z.object({
  criteria: z.object({ fluency: Criterion, lexical: Criterion, grammar: Criterion, pronunciation: Criterion }),
  summary: z.string().min(1),
  strengths: z.array(z.string()).max(4).default([]),
  priorities: z.array(z.string()).max(3).default([]),
  corrections: z
    .array(
      z.object({
        answer: z.coerce.number().int().min(1),
        original: z.string().min(1),
        fix: z.string(),
        rule: z.string().default(""),
        category: z.enum(CORRECTION_CATEGORIES).catch("grammar"),
        pattern: z.string().default(""),
      }),
    )
    .max(25)
    .default([]),
  better_phrases: z
    .array(z.object({ answer: z.coerce.number().int().min(1), original: z.string().min(1), better: z.string().min(1), why: z.string().default("") }))
    .max(10)
    .default([]),
  model_answers: z.array(z.object({ answer: z.coerce.number().int().min(1), text: z.string().min(1) })).max(12).default([]),
});
export type SpeakingScore = z.infer<typeof SpeakingScore>;
export type SpeakingCriterion = keyof SpeakingScore["criteria"];
export const SPEAKING_CRITERIA: SpeakingCriterion[] = ["fluency", "lexical", "grammar", "pronunciation"];

export type SpeakingFinal = {
  criteria: Record<SpeakingCriterion, number>;
  raw: Record<SpeakingCriterion, number>;
  overall: number;
  penalties: Array<"short_long_turn" | "very_short_long_turn" | "short_answers" | "too_little_speech">;
};

/** Deterministic exam rules on top of the AI bands (bands can only go down). */
export function applySpeakingRules(
  score: SpeakingScore,
  answers: Array<{ part: 1 | 2 | 3; metrics: Metrics | null }>,
): SpeakingFinal {
  const raw = {
    fluency: Math.floor(score.criteria.fluency.band),
    lexical: Math.floor(score.criteria.lexical.band),
    grammar: Math.floor(score.criteria.grammar.band),
    pronunciation: Math.floor(score.criteria.pronunciation.band),
  };
  const caps = { fluency: 9, lexical: 9, grammar: 9, pronunciation: 9 };
  const penalties: SpeakingFinal["penalties"] = [];

  const longTurn = answers.find((a) => a.part === 2)?.metrics;
  if (longTurn) {
    if (longTurn.durationSec < 30) {
      caps.fluency = 4;
      penalties.push("very_short_long_turn");
    } else if (longTurn.durationSec < 60) {
      caps.fluency = 5;
      penalties.push("short_long_turn");
    }
  }
  const qa = answers.filter((a) => a.part !== 2 && a.metrics);
  if (qa.length >= 2 && qa.filter((a) => (a.metrics as Metrics).words < 8).length * 2 >= qa.length) {
    caps.fluency = Math.min(caps.fluency, 5);
    penalties.push("short_answers");
  }
  const totalWords = answers.reduce((s, a) => s + (a.metrics?.words ?? 0), 0);
  if (totalWords < 40) {
    for (const k of Object.keys(caps) as SpeakingCriterion[]) caps[k] = Math.min(caps[k], 4);
    penalties.push("too_little_speech");
  }

  const criteria = {
    fluency: Math.min(raw.fluency, caps.fluency),
    lexical: Math.min(raw.lexical, caps.lexical),
    grammar: Math.min(raw.grammar, caps.grammar),
    pronunciation: Math.min(raw.pronunciation, caps.pronunciation),
  };
  const mean = (criteria.fluency + criteria.lexical + criteria.grammar + criteria.pronunciation) / 4;
  return { criteria, raw, overall: Math.floor(mean * 2 + 1e-9) / 2, penalties };
}
