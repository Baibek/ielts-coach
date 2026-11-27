"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/data/queries";
import { aiErrorCode, aiErrorDetail, type AiErrorCode } from "@/lib/ai/server";
import { countWords } from "@/lib/writing/scoring";
import {
  generatePrompt, getPromptById, scoreSubmission, SUBMISSION_COLUMNS, type SubmissionRow,
} from "@/lib/writing/service";

const SubmitInput = z.object({
  promptId: z.string().min(1).max(80),
  mode: z.enum(["practice", "exam", "diagnostic"]),
  text: z.string().max(20_000),
  durationSec: z.number().int().min(0).max(4 * 3600),
  mockId: z.uuid().optional(),
});

export type SubmitResult = { id?: string; error?: AiErrorCode | "too_short" | "bad_prompt" | "generic"; detail?: string };

export async function submitWriting(input: z.infer<typeof SubmitInput>): Promise<SubmitResult> {
  const parsed = SubmitInput.safeParse(input);
  if (!parsed.success) return { error: "generic" };
  const { promptId, mode, text, durationSec, mockId } = parsed.data;
  if (countWords(text) < 20) return { error: "too_short" };

  const { supabase, profile } = await getSession();
  const prompt = await getPromptById(supabase, promptId);
  if (!prompt) return { error: "bad_prompt" };

  const { data: sub, error } = await supabase
    .from("writing_submissions")
    .insert({
      task: prompt.task,
      mode,
      prompt,
      text,
      word_count: countWords(text),
      duration_sec: durationSec,
      status: "pending",
      mock_id: mockId ?? null,
      test_id: promptId.startsWith("gen:") ? promptId.slice(4) : null,
    })
    .select(SUBMISSION_COLUMNS)
    .single<SubmissionRow>();
  if (error || !sub) return { error: "generic" };

  try {
    await scoreSubmission(supabase, profile, sub);
  } catch (e) {
    console.error("writing score failed", e);
    return { id: sub.id, error: aiErrorCode(e) ?? "generic", detail: aiErrorDetail(e) };
  } finally {
    revalidatePath("/writing");
    revalidatePath("/");
  }
  return { id: sub.id };
}

export async function rescoreWriting(id: string): Promise<SubmitResult> {
  const { supabase, profile } = await getSession();
  const { data: sub } = await supabase.from("writing_submissions").select(SUBMISSION_COLUMNS).eq("id", id).maybeSingle<SubmissionRow>();
  if (!sub) return { error: "generic" };
  try {
    await scoreSubmission(supabase, profile, sub);
  } catch (e) {
    console.error("writing rescore failed", e);
    return { id, error: aiErrorCode(e) ?? "generic", detail: aiErrorDetail(e) };
  }
  revalidatePath(`/writing/${id}`);
  revalidatePath("/writing");
  revalidatePath("/");
  return { id };
}

export type GenerateResult = { error?: AiErrorCode | "generic"; detail?: string };

export async function generateWritingPrompt(task: "task1" | "task2", mode: "practice" | "exam"): Promise<GenerateResult> {
  const { supabase } = await getSession();
  let id: string;
  try {
    id = await generatePrompt(supabase, task);
  } catch (e) {
    console.error("generate prompt failed", e);
    return { error: aiErrorCode(e) ?? "generic", detail: aiErrorDetail(e) };
  }
  redirect(`/writing?task=${task}&mode=${mode}&pid=${encodeURIComponent(id)}`);
}

export async function deleteSubmission(id: string): Promise<void> {
  const { supabase } = await getSession();
  const { data } = await supabase.from("writing_submissions").select("attempt_id").eq("id", id).maybeSingle();
  if (data?.attempt_id) await supabase.from("attempts").delete().eq("id", data.attempt_id);
  await supabase.from("writing_submissions").delete().eq("id", id);
  revalidatePath("/writing");
  revalidatePath("/");
  redirect("/writing");
}
