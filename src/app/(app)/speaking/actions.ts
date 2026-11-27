"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/data/queries";
import { aiErrorCode, aiErrorDetail, type AiErrorCode } from "@/lib/ai/server";
import { findSpeakingSet } from "@/lib/speaking/bank";
import {
  scoreSession, scriptFor, SPEAKING_COLUMNS, transcribeAnswer, type SpeakingRow,
} from "@/lib/speaking/service";

const Part = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

export async function startSpeaking(input: { id: string; part: number; mode: string; setIds: string[] }): Promise<{ ok: boolean }> {
  const parsed = z
    .object({ id: z.uuid(), part: Part, mode: z.enum(["practice", "exam", "diagnostic"]), setIds: z.array(z.string().max(20)).min(1).max(2) })
    .safeParse(input);
  if (!parsed.success || parsed.data.setIds.some((s) => !findSpeakingSet(s))) return { ok: false };
  const { id, part, mode, setIds } = parsed.data;
  const { supabase } = await getSession();
  const answers = scriptFor(part, setIds);
  const { error } = await supabase.from("speaking_sessions").insert({ id, part, mode, set_ids: setIds, answers, questions: answers.map((a) => a.question), status: "pending" });
  return { ok: !error };
}

export type AnswerResult = { ok: boolean; transcript?: string; error?: AiErrorCode | "generic"; detail?: string };

/** Called after each recording is uploaded: stores it and transcribes it right away. */
export async function saveSpeakingAnswer(input: { id: string; index: number; path: string; durationSec: number }): Promise<AnswerResult> {
  const parsed = z
    .object({ id: z.uuid(), index: z.number().int().min(0).max(20), path: z.string().max(200), durationSec: z.number().min(0).max(400) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "generic" };
  const { id, index, path, durationSec } = parsed.data;
  const { supabase, user } = await getSession();
  if (!path.startsWith(`${user.id}/${id}/`)) return { ok: false, error: "generic" };

  await supabase.rpc("speaking_set_answer", {
    p_id: id, p_index: index, p_answer: { path, duration_sec: Math.round(durationSec * 10) / 10, transcript: null, metrics: null },
  });
  const { data: row } = await supabase.from("speaking_sessions").select(SPEAKING_COLUMNS).eq("id", id).maybeSingle<SpeakingRow>();
  if (!row) return { ok: false, error: "generic" };
  try {
    const a = await transcribeAnswer(supabase, row, index);
    return { ok: true, transcript: a.transcript ?? "" };
  } catch (e) {
    console.error("speaking transcribe failed", e);
    // The recording is saved; scoring will try to transcribe it again.
    return { ok: true, error: aiErrorCode(e) ?? "generic", detail: aiErrorDetail(e) };
  }
}

export type FinishResult = { ok: boolean; error?: AiErrorCode | "generic"; detail?: string };

export async function finishSpeaking(id: string): Promise<FinishResult> {
  const { supabase, profile } = await getSession();
  const { data: row } = await supabase.from("speaking_sessions").select(SPEAKING_COLUMNS).eq("id", id).maybeSingle<SpeakingRow>();
  if (!row) return { ok: false, error: "generic" };
  try {
    await scoreSession(supabase, profile, row);
  } catch (e) {
    console.error("speaking score failed", e);
    return { ok: false, error: aiErrorCode(e) ?? "generic", detail: aiErrorDetail(e) ?? String((e as Error).message).slice(0, 200) };
  } finally {
    revalidatePath("/speaking");
    revalidatePath("/");
  }
  revalidatePath(`/speaking/${id}`);
  return { ok: true };
}

export async function deleteSpeaking(id: string): Promise<void> {
  const { supabase } = await getSession();
  const { data } = await supabase.from("speaking_sessions").select("answers, attempt_id").eq("id", id).maybeSingle();
  const paths = ((data?.answers ?? []) as Array<{ path?: string }>).map((a) => a.path).filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from("recordings").remove(paths);
  if (data?.attempt_id) await supabase.from("attempts").delete().eq("id", data.attempt_id);
  await supabase.from("speaking_sessions").delete().eq("id", id);
  revalidatePath("/speaking");
  revalidatePath("/");
  redirect("/speaking");
}
