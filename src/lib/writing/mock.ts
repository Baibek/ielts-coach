// Deterministic fake AI output for AI_MOCK=1 (local testing without API keys).
import type { Task1Kind, WritingScore } from "./schemas";
import { TASK1_BANK, TASK2_BANK } from "./bank";
import { countWords } from "./scoring";

export function mockScore(text: string): WritingScore {
  const words = countWords(text);
  const base = words > 200 ? 6 : 5;
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().split(/\s+/).length >= 3);
  const corrections = sentences.slice(0, 3).map((s, i) => {
    const span = s.trim().split(/\s+/).slice(0, 3).join(" ");
    return {
      original: span,
      fix: i === 0 ? span.replace(/^(\w)/, (c) => c.toUpperCase()) + " (better phrasing)" : span + " [fixed]",
      rule: "Mock rule: this is example feedback generated without AI.",
      category: (["grammar", "vocabulary", "cohesion"] as const)[i],
      pattern: ["subject-verb agreement", "word choice", "linking words"][i],
    };
  });
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const c = (band: number, name: string) => ({
    band,
    comment: `Mock ${name} comment. Turn off AI_MOCK to get real examiner feedback.`,
    evidence: sentences.slice(0, 1).map((s) => s.trim().split(/\s+/).slice(0, 5).join(" ")),
    next_step: `Mock next step for ${name}.`,
  });
  return {
    on_topic: true,
    criteria: { task: c(base, "task"), coherence: c(base + 1, "coherence"), lexical: c(base, "lexical"), grammar: c(base, "grammar") },
    summary: "Mock summary: a clear attempt with some accuracy problems.",
    strengths: ["Clear position", "Good paragraphing"],
    priorities: ["Fix subject-verb agreement", "Use more precise vocabulary", "Develop the main ideas more fully"],
    corrections,
    rewrites: paragraphs.slice(0, 2).map((p) => ({
      original: p,
      improved: "[Band 8 version] " + p,
      why: "Mock: more precise vocabulary and varied sentence structures.",
    })),
  };
}

export function mockTask2() {
  const p = TASK2_BANK[Math.floor(Math.random() * TASK2_BANK.length)];
  return { essay_type: p.essay_type, topic: p.topic, statement: "(AI) " + p.statement, question: p.question };
}

export function mockTask1(kind: Task1Kind) {
  const p = TASK1_BANK.find((b) => b.visual.kind === kind) ?? TASK1_BANK[0];
  return { prompt: "(AI) " + p.prompt, visual: p.visual };
}
