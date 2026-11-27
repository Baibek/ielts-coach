import "server-only";
import { z } from "zod";
import { aiJson, LANGUAGE_NAME } from "@/lib/ai/server";
import { markPlanTaskDone } from "@/lib/data/queries";
import type { Profile } from "@/lib/data/types";
import { overallBand, writingBand, type Skill } from "@/lib/ielts/bands";
import type { createClient } from "@/lib/supabase/server";

type DB = Awaited<ReturnType<typeof createClient>>;

export type MockStep = "listening" | "reading" | "writing1" | "writing2" | "speaking";
export const MOCK_STEPS: MockStep[] = ["listening", "reading", "writing1", "writing2", "speaking"];

export const STEP_HREF: Record<MockStep, (id: string) => string> = {
  listening: (id) => `/listening?mode=full&mock=${id}`,
  reading: (id) => `/reading?mode=full&mock=${id}`,
  writing1: (id) => `/writing?task=task1&mode=exam&mock=${id}`,
  writing2: (id) => `/writing?task=task2&mode=exam&mock=${id}`,
  speaking: (id) => `/speaking?part=full&mode=exam&mock=${id}`,
};

export type MockRow = { id: string; status: "in_progress" | "finished" | "abandoned"; report: MockReport | null; started_at: string; finished_at: string | null };
export type MockReport = {
  bands: Record<Skill, number | null>;
  overall: number | null;
  raw: { listening?: string; reading?: string };
  previous: { overall: number | null; bands: Record<Skill, number | null> } | null;
  top3: Array<{ title: string; why: string; action: string }>;
  pendingWriting: boolean;
};

type Attempt = { skill: Skill; band: number | null; raw_score: number | null; max_score: number | null; meta: { task?: string } };

export async function mockProgress(supabase: DB, mockId: string) {
  const [{ data: attempts }, { data: subs }, { data: speak }] = await Promise.all([
    supabase.from("attempts").select("skill, band, raw_score, max_score, meta").eq("mock_id", mockId),
    supabase.from("writing_submissions").select("id, task, status").eq("mock_id", mockId),
    supabase.from("speaking_sessions").select("id, status").eq("mock_id", mockId),
  ]);
  const a = (attempts ?? []) as Attempt[];
  const done: Record<MockStep, boolean> = {
    listening: a.some((x) => x.skill === "listening"),
    reading: a.some((x) => x.skill === "reading"),
    writing1: (subs ?? []).some((s) => s.task === "task1"),
    writing2: (subs ?? []).some((s) => s.task === "task2"),
    speaking: (speak ?? []).length > 0,
  };
  return { attempts: a, subs: subs ?? [], speaking: speak ?? [], done };
}

const Top3 = z.object({ top3: z.array(z.object({ title: z.string(), why: z.string(), action: z.string() })).min(1).max(3) });

/** Compute bands, compare with the previous mock and ask the AI for this week's top 3 priorities. */
export async function finalizeMock(supabase: DB, profile: Profile, mockId: string): Promise<MockReport> {
  const { attempts } = await mockProgress(supabase, mockId);
  const band = (s: Skill) => attempts.find((x) => x.skill === s)?.band ?? null;
  const w1 = attempts.find((x) => x.skill === "writing" && x.meta?.task === "task1")?.band ?? null;
  const w2 = attempts.find((x) => x.skill === "writing" && x.meta?.task === "task2")?.band ?? null;
  const bands: Record<Skill, number | null> = { listening: band("listening"), reading: band("reading"), writing: writingBand(w1, w2), speaking: band("speaking") };
  const raw = (s: Skill) => {
    const x = attempts.find((y) => y.skill === s);
    return x?.raw_score != null ? `${x.raw_score}/${x.max_score}` : undefined;
  };

  const { data: prev } = await supabase
    .from("mock_exams")
    .select("report")
    .eq("status", "finished")
    .neq("id", mockId)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const prevReport = prev?.report as MockReport | null;

  // Evidence for the priorities: feedback from this mock + the error log.
  const [{ data: subs }, { data: sp }, { data: errs }] = await Promise.all([
    supabase.from("writing_submissions").select("task, feedback").eq("mock_id", mockId),
    supabase.from("speaking_sessions").select("feedback").eq("mock_id", mockId),
    supabase.from("error_log").select("pattern, category, count").eq("resolved", false).order("count", { ascending: false }).limit(6),
  ]);
  const evidence = [
    `Bands: ${Object.entries(bands).map(([k, v]) => `${k} ${v ?? "?"}`).join(", ")}. Target ${profile.target_band}.`,
    `Listening ${raw("listening") ?? "?"}, Reading ${raw("reading") ?? "?"}.`,
    ...(subs ?? []).map((s) => `Writing ${s.task} priorities: ${((s.feedback as { priorities?: string[] } | null)?.priorities ?? []).join("; ")}`),
    ...(sp ?? []).map((s) => `Speaking priorities: ${((s.feedback as { priorities?: string[] } | null)?.priorities ?? []).join("; ")}`),
    `Most repeated mistakes: ${(errs ?? []).map((e) => `${e.pattern || e.category} ×${e.count}`).join(", ") || "none"}.`,
  ].join("\n");

  const weakest = (Object.entries(bands).filter(([, v]) => v != null) as Array<[Skill, number]>).sort((a, b) => a[1] - b[1]);
  const fallback = () => ({
    top3: [
      ...weakest.slice(0, 2).map(([s, v]) => ({ title: `${s[0].toUpperCase()}${s.slice(1)}: ${v.toFixed(1)}`, why: `Lowest band in this mock (target ${profile.target_band}).`, action: `Do the ${s} tasks in your plan first each day this week.` })),
      ...(errs ?? []).slice(0, 1).map((e) => ({ title: e.pattern || e.category, why: `Repeated ${e.count} times.`, action: "Review it in the Error Log and make a flashcard." })),
    ].slice(0, 3),
  });

  let top3: MockReport["top3"];
  try {
    top3 = (
      await aiJson(supabase, {
        feature: "mock_report",
        system: `You are an IELTS coach. From the mock exam results give the 3 most important things to fix THIS WEEK to move towards the target band. Each item: short title, why (cite the evidence), one concrete daily action. Write in ${LANGUAGE_NAME[profile.feedback_lang ?? profile.locale]}. JSON only: {"top3":[{"title":"","why":"","action":""}]}`,
        user: evidence,
        schema: Top3,
        maxTokens: 1200,
        temperature: 0.3,
        effort: "low",
        mock: fallback,
      })
    ).top3;
  } catch {
    top3 = fallback().top3;
  }

  const report: MockReport = {
    bands,
    overall: overallBand([bands.listening, bands.reading, bands.writing, bands.speaking]),
    raw: { listening: raw("listening"), reading: raw("reading") },
    previous: prevReport ? { overall: prevReport.overall, bands: prevReport.bands } : null,
    top3,
    pendingWriting: w1 == null || w2 == null,
  };
  await supabase.from("mock_exams").update({ status: "finished", report, finished_at: new Date().toISOString() }).eq("id", mockId);
  await markPlanTaskDone(supabase, profile, ["mock_full"]);
  return report;
}
