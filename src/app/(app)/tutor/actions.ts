"use server";

import { revalidatePath } from "next/cache";
import { getAttempts, getLatestPlan, getSession } from "@/lib/data/queries";
import { aiErrorCode, aiErrorDetail, aiText, LANGUAGE_NAME } from "@/lib/ai/server";
import { daysBetween, todayIn } from "@/lib/dates";
import { formatBand, overallBand, SKILLS } from "@/lib/ielts/bands";
import { currentBands } from "@/lib/ielts/skill-bands";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; created_at: string };

async function contextSummary() {
  const { supabase, profile } = await getSession();
  const [attempts, plan, errors, lastWriting] = await Promise.all([
    getAttempts(supabase, 200),
    getLatestPlan(supabase),
    supabase.from("error_log").select("pattern, category, count, example, correction").eq("resolved", false).order("count", { ascending: false }).limit(8),
    supabase.from("writing_submissions").select("feedback").eq("status", "scored").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const today = todayIn(profile.timezone);
  const bands = currentBands(attempts);
  const day = plan?.days.find((d) => d.date === today);
  const priorities = (lastWriting.data?.feedback as { priorities?: string[] } | null)?.priorities ?? [];
  return {
    supabase,
    profile,
    text: [
      `Target band: ${profile.target_band}. Exam date: ${profile.exam_date ?? "not set"}${profile.exam_date ? ` (${daysBetween(today, profile.exam_date)} days left)` : ""}.`,
      `Current bands: ${SKILLS.map((s) => `${s} ${formatBand(bands[s])}`).join(", ")}; overall ${formatBand(overallBand(SKILLS.map((s) => bands[s])))}. Self-reported starting level: ${profile.start_level ?? "unknown"}.`,
      day ? `Plan today (${day.phase} phase, week ${day.week}): ${day.tasks.map((t) => t.kind).join(", ")}.` : "",
      (errors.data ?? []).length
        ? `Most repeated mistakes: ${(errors.data ?? []).map((e) => `${e.pattern || e.category} ×${e.count} (e.g. "${e.example}" → "${e.correction}")`).join("; ")}.`
        : "No mistakes logged yet.",
      priorities.length ? `Latest essay feedback priorities: ${priorities.join("; ")}.` : "",
    ].filter(Boolean).join("\n"),
  };
}

function systemPrompt(ctx: string, uiLanguage: string) {
  return `You are a friendly, demanding IELTS Academic tutor for a Kazakh student (also speaks Russian) aiming for band 7.
Student profile:
${ctx}
How you teach:
- Socratic first: when the student asks how to do something, first ask them to try (give a small task or question), then give feedback and explain. Do not dump full answers immediately unless they ask "just tell me".
- Be concrete: use the student's own mistakes and plan. Give short examples. Keep answers under 180 words unless asked for more.
- Reply in the language the student writes in. If they ask in Kazakh, explain in Kazakh; if in Russian, in Russian. Default explanation language: ${uiLanguage}. Keep English examples in English.
- Never write a full essay for them to memorise; never promise official scores.`;
}

export async function sendTutorMessage(text: string): Promise<{ messages?: ChatMessage[]; error?: string; detail?: string }> {
  const content = text.trim().slice(0, 2000);
  if (!content) return { error: "generic" };
  const { supabase, profile, text: ctx } = await contextSummary();
  await supabase.from("tutor_messages").insert({ role: "user", content });
  const { data: history } = await supabase.from("tutor_messages").select("role, content").order("created_at", { ascending: false }).limit(16);
  const msgs = (history ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string }));
  try {
    const reply = await aiText(supabase, {
      feature: "tutor",
      messages: [{ role: "system", content: systemPrompt(ctx, LANGUAGE_NAME[profile.feedback_lang ?? profile.locale]) }, ...msgs],
      mock: () => `(mock tutor) Let's try it together first. ${content.length > 60 ? "Good question." : ""} Write one sentence using the structure, and I'll check it.`,
    });
    await supabase.from("tutor_messages").insert({ role: "assistant", content: reply });
  } catch (e) {
    return { error: aiErrorCode(e) ?? "generic", detail: aiErrorDetail(e) };
  }
  const { data } = await supabase.from("tutor_messages").select("id, role, content, created_at").order("created_at").limit(200);
  return { messages: (data ?? []) as ChatMessage[] };
}

export async function clearTutor(): Promise<void> {
  const { supabase, user } = await getSession();
  await supabase.from("tutor_messages").delete().eq("user_id", user.id);
  revalidatePath("/tutor");
}
