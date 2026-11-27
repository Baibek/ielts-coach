import "server-only";
import { z } from "zod";
import { aiJson, LANGUAGE_NAME } from "@/lib/ai/server";
import { afterDiagnostic, markPlanTaskDone } from "@/lib/data/queries";
import type { Profile } from "@/lib/data/types";
import type { TaskKind } from "@/lib/plan/engine";
import type { createClient } from "@/lib/supabase/server";
import { findBankPrompt, TASK1_BANK, TASK2_BANK } from "./bank";
import { mockScore, mockTask1, mockTask2 } from "./mock";
import { GEN_TASK1_SYSTEM, GEN_TASK2_SYSTEM, scoringSystemPrompt, scoringUserPrompt } from "./prompts";
import {
  ESSAY_TYPES, Task1Prompt, Task1Visual, Task2Prompt, WritingScore,
  type EssayType, type Task1Kind, type WritingPrompt,
} from "./schemas";
import { applyRules, countWords, findQuote, locateCorrections, type FinalScores, type LocatedCorrection, type WritingTask } from "./scoring";

type DB = Awaited<ReturnType<typeof createClient>>;

export type WritingFeedback = Omit<WritingScore, "corrections"> & { corrections: LocatedCorrection[] };

export type SubmissionRow = {
  id: string;
  task: WritingTask;
  mode: "practice" | "exam" | "diagnostic";
  prompt: WritingPrompt;
  text: string;
  word_count: number;
  duration_sec: number | null;
  status: "pending" | "scored";
  scores: FinalScores | null;
  feedback: WritingFeedback | null;
  attempt_id: string | null;
  test_id: string | null;
  created_at: string;
};

export const SUBMISSION_COLUMNS =
  "id, task, mode, prompt, text, word_count, duration_sec, status, scores, feedback, attempt_id, test_id, created_at";

const GEN_KIND = { task1: "task1_prompt", task2: "task2_prompt" } as const;

async function usedPromptIds(supabase: DB, task: WritingTask): Promise<Set<string>> {
  const { data } = await supabase.from("writing_submissions").select("prompt").eq("task", task).limit(1000);
  return new Set((data ?? []).map((r) => (r.prompt as { id?: string } | null)?.id).filter(Boolean) as string[]);
}

function parseGenerated(task: WritingTask, id: string, content: unknown): WritingPrompt | null {
  const parsed = (task === "task1" ? Task1Prompt : Task2Prompt).safeParse({ ...(content as object), task, id });
  return parsed.success ? parsed.data : null;
}

/** Load a prompt by id: "b1-03" (bank) or "gen:<uuid>" (AI-generated, cached). */
export async function getPromptById(supabase: DB, id: string): Promise<WritingPrompt | null> {
  if (id.startsWith("gen:")) {
    const { data } = await supabase.from("generated_tests").select("id, kind, content").eq("id", id.slice(4)).maybeSingle();
    if (!data) return null;
    const task = data.kind === GEN_KIND.task1 ? "task1" : data.kind === GEN_KIND.task2 ? "task2" : null;
    return task ? parseGenerated(task, id, data.content) : null;
  }
  return findBankPrompt(id);
}

/**
 * Next prompt the user has not written yet: built-in bank first, then cached AI
 * prompts. `after` rotates to the following unused prompt ("Another task").
 */
export async function nextPrompt(supabase: DB, task: WritingTask, after?: string): Promise<WritingPrompt | null> {
  const used = await usedPromptIds(supabase, task);
  const bank: WritingPrompt[] = task === "task1" ? TASK1_BANK : TASK2_BANK;
  const candidates: WritingPrompt[] = bank.filter((p) => !used.has(p.id));
  const { data } = await supabase
    .from("generated_tests")
    .select("id, content")
    .eq("kind", GEN_KIND[task])
    .order("created_at", { ascending: false })
    .limit(50);
  for (const row of data ?? []) {
    const id = `gen:${row.id}`;
    if (used.has(id)) continue;
    const p = parseGenerated(task, id, row.content);
    if (p) candidates.push(p);
  }
  if (candidates.length === 0) return null;
  const idx = after ? candidates.findIndex((p) => p.id === after) : -1;
  return candidates[(idx + 1) % candidates.length];
}

/** Ask the AI for a fresh, original prompt and cache it. Rotates chart/essay types. */
export async function generatePrompt(supabase: DB, task: WritingTask): Promise<string> {
  const { data: recent } = await supabase
    .from("generated_tests")
    .select("content")
    .eq("kind", GEN_KIND[task])
    .order("created_at", { ascending: false })
    .limit(10);
  let content: unknown;
  if (task === "task1") {
    const kinds: Task1Kind[] = ["bar", "line", "table", "pie", "process", "map"];
    const recentKinds = (recent ?? []).map((r) => (r.content as { visual?: { kind?: string } }).visual?.kind);
    const kind = kinds.find((k) => !recentKinds.includes(k)) ?? kinds[(recent?.length ?? 0) % kinds.length];
    content = await aiJson(supabase, {
      feature: "writing_generate_task1",
      system: GEN_TASK1_SYSTEM,
      user: `Create one Task 1 question with a "${kind}" visual. Topic: something different from these recent titles: ${(recent ?? [])
        .map((r) => (r.content as { visual?: { title?: string } }).visual?.title)
        .filter(Boolean)
        .join("; ") || "none"}.`,
      schema: z.object({ prompt: z.string().min(10), visual: Task1Visual }),
      maxTokens: 3000,
      temperature: 0.9,
      effort: "low",
      mock: () => mockTask1(kind),
    });
  } else {
    const recentTypes = (recent ?? []).map((r) => (r.content as { essay_type?: string }).essay_type);
    const type: EssayType = ESSAY_TYPES.find((t) => !recentTypes.includes(t)) ?? ESSAY_TYPES[(recent?.length ?? 0) % ESSAY_TYPES.length];
    const recentTopics = (recent ?? []).map((r) => (r.content as { topic?: string }).topic).filter(Boolean);
    content = await aiJson(supabase, {
      feature: "writing_generate_task2",
      system: GEN_TASK2_SYSTEM,
      user: `Essay type: ${type}. Avoid these recent topics: ${recentTopics.join(", ") || "none"}.`,
      schema: z.object({ essay_type: z.enum(ESSAY_TYPES), topic: z.string(), statement: z.string().min(20), question: z.string().min(10) }),
      maxTokens: 1200,
      temperature: 0.9,
      effort: "low",
      mock: mockTask2,
    });
  }
  const { data, error } = await supabase
    .from("generated_tests")
    .insert({ skill: "writing", kind: GEN_KIND[task], content, model: process.env.AI_MOCK === "1" ? "mock" : null })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "could not save generated prompt");
  return `gen:${data.id}`;
}

const PLAN_KINDS: Record<WritingTask, Record<"practice" | "exam" | "diagnostic", TaskKind[]>> = {
  task1: { practice: ["writing_task1", "writing_task1_timed"], exam: ["writing_task1_timed", "writing_task1"], diagnostic: [] },
  task2: { practice: ["writing_task2", "writing_task2_timed"], exam: ["writing_task2_timed", "writing_task2"], diagnostic: ["diag_writing"] },
};

/** Run the AI examiner on a saved submission, store the result, attempt and error log. */
export async function scoreSubmission(supabase: DB, profile: Profile, sub: SubmissionRow): Promise<void> {
  const language = LANGUAGE_NAME[profile.feedback_lang ?? profile.locale];
  const wordCount = countWords(sub.text);
  const ai = await aiJson(supabase, {
    feature: `writing_score_${sub.task}`,
    system: scoringSystemPrompt(sub.task, language),
    user: scoringUserPrompt(sub.prompt, sub.text, wordCount),
    schema: WritingScore,
    maxTokens: 4000,
    temperature: 0.1,
    effort: "medium",
    mock: () => mockScore(sub.text),
  });

  const scores = applyRules(ai, sub.task, wordCount);
  const corrections = locateCorrections(sub.text, ai.corrections).slice(0, 15);
  const keepQuotes = (q: string[]) => q.filter((x) => findQuote(sub.text, x));
  const feedback: WritingFeedback = {
    ...ai,
    criteria: {
      task: { ...ai.criteria.task, evidence: keepQuotes(ai.criteria.task.evidence) },
      coherence: { ...ai.criteria.coherence, evidence: keepQuotes(ai.criteria.coherence.evidence) },
      lexical: { ...ai.criteria.lexical, evidence: keepQuotes(ai.criteria.lexical.evidence) },
      grammar: { ...ai.criteria.grammar, evidence: keepQuotes(ai.criteria.grammar.evidence) },
    },
    corrections,
  };

  let attemptId = sub.attempt_id;
  if (!attemptId) {
    const { data: attempt, error } = await supabase
      .from("attempts")
      .insert({
        skill: "writing",
        type: sub.mode === "diagnostic" ? "diagnostic" : sub.mode === "exam" ? "timed" : "practice",
        band: scores.overall,
        duration_sec: sub.duration_sec,
        test_id: sub.test_id,
        meta: { task: sub.task, words: wordCount, submission_id: sub.id },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    attemptId = attempt.id;
  } else {
    await supabase.from("attempts").update({ band: scores.overall }).eq("id", attemptId);
  }

  const { error: upErr } = await supabase
    .from("writing_submissions")
    .update({ scores, feedback, status: "scored", attempt_id: attemptId, word_count: wordCount })
    .eq("id", sub.id);
  if (upErr) throw new Error(upErr.message);

  await Promise.all(
    corrections.map((c) =>
      supabase.rpc("log_error", {
        p_category: c.category,
        p_pattern: c.pattern,
        p_example: c.original,
        p_correction: c.fix,
        p_rule: c.rule || null,
        p_source: "writing",
      }),
    ),
  );
  await markPlanTaskDone(supabase, profile, PLAN_KINDS[sub.task][sub.mode]);
  if (sub.mode === "diagnostic") await afterDiagnostic(supabase, profile);
}
