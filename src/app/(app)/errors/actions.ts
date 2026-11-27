"use server";

import { revalidatePath } from "next/cache";
import { getSession, markPlanTaskDone } from "@/lib/data/queries";

export async function setResolved(id: string, resolved: boolean): Promise<void> {
  const { supabase } = await getSession();
  await supabase.from("error_log").update({ resolved }).eq("id", id);
  revalidatePath("/errors");
}

/** Turn a logged mistake into a flashcard: the correct form on the front, the rule as the meaning. */
export async function errorToCard(id: string): Promise<{ ok: boolean }> {
  const { supabase } = await getSession();
  const { data: e } = await supabase.from("error_log").select("example, correction, rule, pattern").eq("id", id).maybeSingle();
  if (!e) return { ok: false };
  const word = String(e.correction).slice(0, 80);
  const { data: dup } = await supabase.from("vocab_cards").select("id").ilike("word", word).maybeSingle();
  if (!dup) {
    await supabase.from("vocab_cards").insert({
      word, meaning: e.rule ?? e.pattern ?? "", example: `✗ ${e.example}  →  ✓ ${e.correction}`, topic: "my mistakes", source: "error_log",
    });
  }
  revalidatePath("/vocab");
  return { ok: true };
}

export async function markErrorsReviewed(): Promise<void> {
  const { supabase, profile } = await getSession();
  await markPlanTaskDone(supabase, profile, ["error_review"]);
  revalidatePath("/");
}
