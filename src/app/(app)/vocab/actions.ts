"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, markPlanTaskDone } from "@/lib/data/queries";
import { aiErrorCode, aiErrorDetail, aiJson } from "@/lib/ai/server";
import { todayIn } from "@/lib/dates";
import { sm2, type Grade } from "@/lib/ielts/sm2";
import { STARTER_DECK } from "@/lib/vocab/starter";

const Card = z.object({
  word: z.string().min(1).max(80),
  meaning: z.string().max(300).default(""),
  example: z.string().max(400).default(""),
  kk: z.string().max(200).default(""),
  ru: z.string().max(200).default(""),
});
const Pack = z.object({ cards: z.array(Card).min(3).max(15) });

const ENRICH_SYSTEM = `You are an IELTS vocabulary coach. For the given English word or collocation return JSON only:
{"word":"the item in its dictionary form","meaning":"short simple English definition","example":"one natural IELTS-style example sentence","kk":"Kazakh translation","ru":"Russian translation"}`;

const PACK_SYSTEM = `You are an IELTS vocabulary coach. Create 10 useful Band 7+ collocations or phrases (not single easy words) for the given IELTS topic.
Return JSON only: {"cards":[{"word":"collocation","meaning":"short simple English definition","example":"natural IELTS-style sentence","kk":"Kazakh translation","ru":"Russian translation"}]}`;

async function existingWords(supabase: Awaited<ReturnType<typeof getSession>>["supabase"]): Promise<Set<string>> {
  const { data } = await supabase.from("vocab_cards").select("word").limit(5000);
  return new Set((data ?? []).map((r) => (r.word as string).toLowerCase().trim()));
}

type Result = { added?: number; error?: string; detail?: string };

export async function addStarterDeck(): Promise<Result> {
  const { supabase } = await getSession();
  const have = await existingWords(supabase);
  const rows = STARTER_DECK.filter((c) => !have.has(c.word.toLowerCase())).map((c) => ({
    word: c.word, meaning: c.meaning, example: c.example, translation_kk: c.kk, translation_ru: c.ru, topic: c.topic, source: "starter",
  }));
  if (rows.length) await supabase.from("vocab_cards").insert(rows);
  revalidatePath("/vocab");
  return { added: rows.length };
}

export async function addCard(input: { word: string; meaning?: string }): Promise<Result> {
  const word = input.word.trim().slice(0, 80);
  if (!word) return { error: "generic" };
  const { supabase } = await getSession();
  if ((await existingWords(supabase)).has(word.toLowerCase())) return { error: "exists" };
  let card = { word, meaning: input.meaning?.trim() ?? "", example: "", kk: "", ru: "" };
  if (!card.meaning) {
    try {
      card = await aiJson(supabase, {
        feature: "vocab_enrich", system: ENRICH_SYSTEM, user: word, schema: Card, maxTokens: 600, temperature: 0.3, effort: "low",
        mock: () => ({ word, meaning: `(mock) meaning of ${word}`, example: `(mock) An example with ${word}.`, kk: "(mock) аударма", ru: "(mock) перевод" }),
      });
    } catch (e) {
      // Still save the word; the meaning can be added later.
      console.error("vocab enrich failed", aiErrorDetail(e));
    }
  }
  await supabase.from("vocab_cards").insert({
    word: card.word || word, meaning: card.meaning, example: card.example, translation_kk: card.kk, translation_ru: card.ru, source: "manual",
  });
  revalidatePath("/vocab");
  return { added: 1 };
}

export async function generatePack(topic: string): Promise<Result> {
  const { supabase } = await getSession();
  try {
    const pack = await aiJson(supabase, {
      feature: "vocab_pack", system: PACK_SYSTEM, user: `Topic: ${topic.slice(0, 40)}`, schema: Pack, maxTokens: 2500, temperature: 0.7, effort: "low",
      mock: () => ({ cards: STARTER_DECK.slice(0, 10).map((c) => ({ word: `${c.word} (${topic})`, meaning: c.meaning, example: c.example, kk: c.kk, ru: c.ru })) }),
    });
    const have = await existingWords(supabase);
    const rows = pack.cards
      .filter((c) => !have.has(c.word.toLowerCase().trim()))
      .map((c) => ({ word: c.word.trim(), meaning: c.meaning, example: c.example, translation_kk: c.kk, translation_ru: c.ru, topic, source: "ai_pack" }));
    if (rows.length) await supabase.from("vocab_cards").insert(rows);
    revalidatePath("/vocab");
    return { added: rows.length };
  } catch (e) {
    return { error: aiErrorCode(e) ?? "generic", detail: aiErrorDetail(e) };
  }
}

export async function reviewCard(id: string, grade: Grade): Promise<{ ok: boolean }> {
  const { supabase, profile } = await getSession();
  const { data: card } = await supabase.from("vocab_cards").select("ease, interval, reps").eq("id", id).maybeSingle();
  if (!card) return { ok: false };
  const next = sm2({ ease: Number(card.ease), interval: card.interval, reps: card.reps }, grade, todayIn(profile.timezone));
  const { error } = await supabase.from("vocab_cards").update(next).eq("id", id);
  return { ok: !error };
}

export async function finishReview(): Promise<void> {
  const { supabase, profile } = await getSession();
  await markPlanTaskDone(supabase, profile, ["vocab_review"]);
  revalidatePath("/vocab");
  revalidatePath("/");
}

export async function deleteCard(id: string): Promise<void> {
  const { supabase } = await getSession();
  await supabase.from("vocab_cards").delete().eq("id", id);
  revalidatePath("/vocab");
}
