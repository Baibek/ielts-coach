"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { afterDiagnostic, getSession, markPlanTaskDone } from "@/lib/data/queries";
import { aiErrorCode, aiErrorDetail, type AiErrorCode } from "@/lib/ai/server";
import type { TaskKind } from "@/lib/plan/engine";
import { generateTest, loadTest, markTests, type LoadedTest } from "@/lib/tests/service";

const Input = z.object({
  skill: z.enum(["reading", "listening"]),
  testIds: z.array(z.string().max(60)).min(1).max(4),
  answers: z.record(z.string(), z.string().max(200)),
  durationSec: z.number().int().min(0).max(4 * 3600),
  mode: z.enum(["practice", "timed", "diagnostic"]),
  variant: z.enum(["single", "full"]),
  mockId: z.uuid().optional(),
});

const PLAN: Record<string, TaskKind[]> = {
  "reading:single:practice": ["reading_passage", "reading_passage_timed"],
  "reading:single:timed": ["reading_passage_timed", "reading_passage"],
  "reading:full": ["reading_full"],
  "listening:single:practice": ["listening_part", "listening_part_timed"],
  "listening:single:timed": ["listening_part_timed", "listening_part"],
  "listening:full": ["listening_full"],
  "reading:diagnostic": ["diag_reading"],
  "listening:diagnostic": ["diag_listening"],
};

export async function submitObjective(input: z.infer<typeof Input>): Promise<{ error?: string }> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { error: "generic" };
  const { skill, testIds, answers, durationSec, mode, variant, mockId } = parsed.data;
  const { supabase, profile } = await getSession();
  const tests = (await Promise.all(testIds.map((id) => loadTest(supabase, id)))).filter(Boolean) as LoadedTest[];
  if (tests.length !== testIds.length || tests.some((t) => t.skill !== skill)) return { error: "generic" };

  const numeric = Object.fromEntries(Object.entries(answers).map(([k, v]) => [Number(k), v]));
  const r = markTests(tests, numeric);
  const { data, error } = await supabase
    .from("attempts")
    .insert({
      skill,
      type: mockId ? "mock" : mode,
      mock_id: mockId ?? null,
      raw_score: r.raw,
      max_score: r.total,
      band: r.band,
      duration_sec: durationSec,
      test_id: testIds[0].startsWith("gen:") ? testIds[0].slice(4) : null,
      meta: { test_ids: testIds, answers, errors: r.errors, by_type: r.byType, variant, estimate: r.total < 40 },
    })
    .select("id")
    .single();
  if (error || !data) return { error: "generic" };

  const key = mockId ? "" : mode === "diagnostic" ? `${skill}:diagnostic` : variant === "full" ? `${skill}:full` : `${skill}:single:${mode}`;
  await markPlanTaskDone(supabase, profile, PLAN[key] ?? []);
  if (mode === "diagnostic") await afterDiagnostic(supabase, profile);
  revalidatePath(`/${skill}`);
  revalidatePath("/");
  if (mockId) {
    revalidatePath("/mock");
    redirect("/mock");
  }
  redirect(`/${skill}/attempt/${data.id}`);
}

export type GenResult = { id?: string; error?: AiErrorCode | "generic"; detail?: string };

export async function generateObjective(skill: "reading" | "listening", partNo: number): Promise<GenResult> {
  const { supabase } = await getSession();
  try {
    return { id: await generateTest(supabase, skill, Math.min(4, Math.max(1, partNo))) };
  } catch (e) {
    console.error("generate test failed", e);
    return { error: aiErrorCode(e) ?? "generic", detail: aiErrorDetail(e) ?? String((e as Error).message).slice(0, 200) };
  }
}
