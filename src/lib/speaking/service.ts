import "server-only";
import { aiJson, LANGUAGE_NAME } from "@/lib/ai/server";
import { markPlanTaskDone } from "@/lib/data/queries";
import type { Profile } from "@/lib/data/types";
import type { TaskKind } from "@/lib/plan/engine";
import type { createClient } from "@/lib/supabase/server";
import { locateCorrections, type LocatedCorrection } from "@/lib/writing/scoring";
import { findSpeakingSet, PART1_BANK, PART2_BANK, type Part1Set, type Part2Set } from "./bank";
import {
  applySpeakingRules, buildScript, computeMetrics, SpeakingScore,
  type Metrics, type ScriptItem, type SpeakingFinal, type SpeakingPart,
} from "./core";
import { speakingSystemPrompt, speakingUserPrompt } from "./prompts";
import { transcribe } from "./stt";

type DB = Awaited<ReturnType<typeof createClient>>;

export type AnswerRecord = ScriptItem & {
  path?: string | null;
  duration_sec?: number | null;
  transcript?: string | null;
  metrics?: Metrics | null;
  stt?: string | null;
};

export type SpeakingFeedback = Omit<SpeakingScore, "corrections"> & {
  corrections: Array<LocatedCorrection & { answer: number }>;
};

export type SpeakingRow = {
  id: string;
  part: SpeakingPart;
  mode: "practice" | "exam";
  status: "pending" | "scored";
  set_ids: string[];
  answers: AnswerRecord[];
  scores: SpeakingFinal | null;
  feedback: SpeakingFeedback | null;
  attempt_id: string | null;
  duration_sec: number | null;
  created_at: string;
};

export const SPEAKING_COLUMNS = "id, part, mode, status, set_ids, answers, scores, feedback, attempt_id, duration_sec, created_at";

async function usedSetIds(supabase: DB): Promise<Set<string>> {
  const { data } = await supabase.from("speaking_sessions").select("set_ids").eq("status", "scored").limit(1000);
  return new Set((data ?? []).flatMap((r) => r.set_ids as string[]));
}

/** Pick question sets the student has not answered yet (cycling once all are used). */
export async function pickSets(supabase: DB, part: SpeakingPart, after?: string[]): Promise<{ p1: Part1Set | null; p2: Part2Set | null }> {
  const used = await usedSetIds(supabase);
  const pick = <T extends { id: string }>(bank: T[], prev?: string): T => {
    const fresh = bank.filter((s) => !used.has(s.id));
    const list = fresh.length ? fresh : bank;
    const idx = prev ? list.findIndex((s) => s.id === prev) : -1;
    return list[(idx + 1) % list.length];
  };
  return {
    p1: part === 1 || part === 0 ? pick(PART1_BANK, after?.find((id) => id.startsWith("s1-"))) : null,
    p2: part === 2 || part === 3 || part === 0 ? pick(PART2_BANK, after?.find((id) => id.startsWith("s2-"))) : null,
  };
}

export function setsFromIds(ids: string[]): { p1: Part1Set | null; p2: Part2Set | null } {
  const sets = ids.map(findSpeakingSet).filter(Boolean);
  return {
    p1: (sets.find((s) => s!.part === 1) as Part1Set | undefined) ?? null,
    p2: (sets.find((s) => s!.part === 2) as Part2Set | undefined) ?? null,
  };
}

export function scriptFor(part: SpeakingPart, setIds: string[]): ScriptItem[] {
  const { p1, p2 } = setsFromIds(setIds);
  return buildScript(part, p1, p2);
}

/** Download a recording, transcribe it and store the transcript + metrics in the session. */
export async function transcribeAnswer(supabase: DB, row: SpeakingRow, index: number): Promise<AnswerRecord> {
  const a = row.answers[index];
  if (!a?.path) throw new Error("answer has no recording");
  const { data: blob, error } = await supabase.storage.from("recordings").download(a.path);
  if (error || !blob) throw new Error("could not read recording: " + (error?.message ?? "missing"));
  const stt = await transcribe(supabase, blob, a.question, a.duration_sec ?? 0);
  const metrics = computeMetrics(stt.text, a.duration_sec ?? 0, stt.segments);
  const patch = { transcript: stt.text, metrics, stt: stt.provider };
  await supabase.rpc("speaking_set_answer", { p_id: row.id, p_index: index, p_answer: patch });
  return { ...a, ...patch };
}

const PLAN_KINDS: Record<SpeakingPart, TaskKind[]> = {
  0: ["speaking_full", "speaking_p2", "speaking_p3", "speaking_p1"],
  1: ["speaking_p1"],
  2: ["speaking_p2"],
  3: ["speaking_p3"],
};

function mockScore(answers: AnswerRecord[]): SpeakingScore {
  const c = (band: number, name: string) => ({ band, comment: `Mock ${name} comment (AI_MOCK=1).`, next_step: `Mock next step for ${name}.` });
  return {
    criteria: { fluency: c(6, "fluency"), lexical: c(6, "lexical"), grammar: c(5, "grammar"), pronunciation: c(6, "pronunciation (estimate)") },
    summary: "Mock summary: fluent enough on familiar topics, with frequent simple grammar errors.",
    strengths: ["Answers are relevant"],
    priorities: ["Past tense after 'when I was a child'", "Fewer 'um' and 'uh'", "Extend Part 3 answers with reasons"],
    corrections: answers
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => a.transcript?.includes("I usually spend"))
      .slice(0, 3)
      .map(({ i }) => ({ answer: i + 1, original: "I usually spend", fix: "I usually spent", rule: "Past simple for past habits.", category: "grammar" as const, pattern: "past tense" })),
    better_phrases: answers.slice(0, 2).map((_, i) => ({ answer: i + 1, original: "quite important for me", better: "plays a big part in my life", why: "More natural collocation." })),
    model_answers: answers.map((a, i) => ({ answer: i + 1, text: `Mock Band 8 answer to: ${a.question}` })),
  };
}

/** Transcribe anything missing, run the AI examiner, save scores, attempt and error log. */
export async function scoreSession(supabase: DB, profile: Profile, row: SpeakingRow): Promise<void> {
  const answers = [...row.answers];
  for (let i = 0; i < answers.length; i++) {
    if (answers[i].path && answers[i].transcript == null) answers[i] = await transcribeAnswer(supabase, row, i);
  }
  const answered = answers
    .map((a, i) => ({ ...a, idx: i }))
    .filter((a) => a.path && a.transcript != null);
  if (!answered.length) throw new Error("no answers recorded");

  const ai = await aiJson(supabase, {
    feature: `speaking_score_p${row.part}`,
    system: speakingSystemPrompt(LANGUAGE_NAME[profile.feedback_lang ?? profile.locale]),
    user: speakingUserPrompt(answered.map((a) => ({ ...a, transcript: a.transcript ?? "", metrics: a.metrics ?? null }))),
    schema: SpeakingScore,
    maxTokens: 4500,
    temperature: 0.1,
    effort: "medium",
    mock: () => mockScore(answered),
  });

  // Map the AI's answer numbers (1..n over answered items) back to session indexes.
  const toIdx = (n: number) => answered[n - 1]?.idx ?? -1;
  const corrections: SpeakingFeedback["corrections"] = [];
  answered.forEach((a, k) => {
    const mine = ai.corrections.filter((c) => c.answer === k + 1);
    for (const c of locateCorrections(a.transcript ?? "", mine)) corrections.push({ ...c, answer: a.idx });
  });
  const feedback: SpeakingFeedback = {
    ...ai,
    corrections,
    better_phrases: ai.better_phrases.map((b) => ({ ...b, answer: toIdx(b.answer) })).filter((b) => b.answer >= 0),
    model_answers: ai.model_answers.map((m) => ({ ...m, answer: toIdx(m.answer) })).filter((m) => m.answer >= 0),
  };
  const scores = applySpeakingRules(ai, answered.map((a) => ({ part: a.part, metrics: a.metrics ?? null })));
  const duration = Math.round(answered.reduce((s, a) => s + (a.duration_sec ?? 0), 0));

  let attemptId = row.attempt_id;
  if (!attemptId) {
    const { data, error } = await supabase
      .from("attempts")
      .insert({ skill: "speaking", type: row.mode === "exam" ? "timed" : "practice", band: scores.overall, duration_sec: duration, meta: { part: row.part, session_id: row.id } })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    attemptId = data.id;
  } else {
    await supabase.from("attempts").update({ band: scores.overall }).eq("id", attemptId);
  }

  const { error } = await supabase
    .from("speaking_sessions")
    .update({ scores, feedback, status: "scored", attempt_id: attemptId, duration_sec: duration, transcript: answered.map((a) => a.transcript).join("\n\n") })
    .eq("id", row.id);
  if (error) throw new Error(error.message);

  await Promise.all(
    corrections.slice(0, 12).map((c) =>
      supabase.rpc("log_error", { p_category: c.category, p_pattern: c.pattern, p_example: c.original, p_correction: c.fix, p_rule: c.rule || null, p_source: "speaking" }),
    ),
  );
  await markPlanTaskDone(supabase, profile, PLAN_KINDS[row.part]);
}

/** Id for a new practice session (the row is created when the student presses Start). */
export function newSessionId(): string {
  return crypto.randomUUID();
}
