import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SKILLS } from "@/lib/ielts/bands";
import { currentBands } from "@/lib/ielts/skill-bands";
import { buildPlan, type TaskKind } from "@/lib/plan/engine";
import { daysBetween, todayIn } from "@/lib/dates";
import type { AttemptRow, Profile, StudyPlanRow } from "./types";

type DB = Awaited<ReturnType<typeof createClient>>;

/** Signed-in user + profile. Redirects to /login when signed out. Cached per request. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, locale, feedback_lang, timezone, exam_date, target_band, start_level, onboarded_at")
    .eq("id", data.user.id)
    .single<Profile>();
  if (error || !profile) throw new Error("Profile not found: " + (error?.message ?? "missing row"));
  return { supabase, user: data.user, profile };
});

/** Like getSession, but sends users who have not set up their exam to /onboarding. */
export async function getOnboardedSession() {
  const s = await getSession();
  if (!s.profile.onboarded_at || !s.profile.exam_date) redirect("/onboarding");
  return s as typeof s & { profile: Profile & { exam_date: string } };
}

export async function getAttempts(supabase: DB, limit = 500): Promise<AttemptRow[]> {
  const { data, error } = await supabase
    .from("attempts")
    .select("id, skill, type, band, raw_score, max_score, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AttemptRow[];
}

export async function getLatestPlan(supabase: DB): Promise<StudyPlanRow | null> {
  const { data, error } = await supabase
    .from("study_plan")
    .select("id, start_date, exam_date, basis, days, done_keys, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<StudyPlanRow>();
  if (error) throw new Error(error.message);
  return data;
}

export function diagnosticDone(attempts: AttemptRow[]): boolean {
  const skills = new Set(attempts.filter((a) => a.type === "diagnostic").map((a) => a.skill));
  return SKILLS.every((s) => skills.has(s));
}

/** Build and save a fresh plan from today, keeping ticks of tasks that still exist. */
export async function rebuildPlan(
  supabase: DB,
  profile: Profile & { exam_date: string },
  attempts: AttemptRow[],
  previous: StudyPlanRow | null,
): Promise<StudyPlanRow> {
  const today = todayIn(profile.timezone);
  const bands = currentBands(attempts);
  const fallback = profile.start_level ?? 5.5;
  const days = buildPlan({
    start: today,
    exam: profile.exam_date,
    bands,
    target: profile.target_band,
    fallbackBand: fallback,
    diagnosticDone: diagnosticDone(attempts),
  });
  const keys = new Set(days.flatMap((d) => d.tasks.map((t) => t.key)));
  const doneKeys = (previous?.done_keys ?? []).filter((k) => keys.has(k));

  const { data, error } = await supabase
    .from("study_plan")
    .insert({
      start_date: today,
      exam_date: profile.exam_date,
      basis: { bands, target: profile.target_band, fallback },
      days,
      done_keys: doneKeys,
    })
    .select("id, start_date, exam_date, basis, days, done_keys, created_at")
    .single<StudyPlanRow>();
  if (error || !data) throw new Error(error?.message ?? "Could not save plan");
  return data;
}

/**
 * Returns the current plan, rebuilding it when there is none, when the exam
 * date changed, or when it is a week old (weekly re-adjustment).
 */
export async function ensurePlan(
  supabase: DB,
  profile: Profile & { exam_date: string },
  attempts: AttemptRow[],
): Promise<StudyPlanRow> {
  const plan = await getLatestPlan(supabase);
  const today = todayIn(profile.timezone);
  const stale =
    !plan ||
    plan.exam_date !== profile.exam_date ||
    daysBetween(plan.start_date, today) >= 7 ||
    daysBetween(plan.start_date, today) < 0;
  return stale ? rebuildPlan(supabase, profile, attempts, plan) : plan;
}

/**
 * Tick the first not-yet-done task of one of these kinds in today's plan
 * (called automatically when a practice item is finished).
 */
export async function markPlanTaskDone(supabase: DB, profile: Profile, kinds: TaskKind[]): Promise<void> {
  const plan = await getLatestPlan(supabase);
  if (!plan) return;
  const today = todayIn(profile.timezone);
  const day = plan.days.find((d) => d.date === today);
  if (!day) return;
  for (const kind of kinds) {
    const task = day.tasks.find((t) => t.kind === kind && !plan.done_keys.includes(t.key));
    if (task) {
      await supabase.from("study_plan").update({ done_keys: [...plan.done_keys, task.key] }).eq("id", plan.id);
      return;
    }
  }
}
