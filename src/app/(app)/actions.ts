"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, getAttempts, getLatestPlan, rebuildPlan } from "@/lib/data/queries";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n";
import { todayIn } from "@/lib/dates";

const ONE_YEAR = 60 * 60 * 24 * 365;

async function setLocaleCookie(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
}

/** Tick or untick a task in the current plan. */
export async function toggleTask(key: string, done: boolean): Promise<{ ok: boolean }> {
  const { supabase } = await getSession();
  const plan = await getLatestPlan(supabase);
  if (!plan) return { ok: false };
  const exists = plan.days.some((d) => d.tasks.some((t) => t.key === key));
  if (!exists) return { ok: false };
  const set = new Set(plan.done_keys);
  if (done) set.add(key);
  else set.delete(key);
  const { error } = await supabase.from("study_plan").update({ done_keys: [...set] }).eq("id", plan.id);
  revalidatePath("/");
  revalidatePath("/plan");
  return { ok: !error };
}

export async function rebuildPlanAction(): Promise<void> {
  const { supabase, profile } = await getSession();
  if (!profile.exam_date) redirect("/onboarding");
  const [attempts, plan] = await Promise.all([getAttempts(supabase), getLatestPlan(supabase)]);
  await rebuildPlan(supabase, { ...profile, exam_date: profile.exam_date }, attempts, plan);
  revalidatePath("/");
  revalidatePath("/plan");
}

const band = (min: number) =>
  z.coerce.number().min(min).max(9).refine((v) => Number.isInteger(v * 2), "half bands only");

const ExamSchema = z.object({
  exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  target_band: band(4),
  start_level: z.union([z.literal(""), band(1)]).optional(),
});

export type ExamFormState = { ok?: boolean; error?: "date" | "generic" };

async function saveExam(form: FormData, extra: Record<string, unknown> = {}): Promise<ExamFormState> {
  const { supabase, profile } = await getSession();
  const parsed = ExamSchema.safeParse({
    exam_date: form.get("exam_date"),
    target_band: form.get("target_band"),
    start_level: form.get("start_level") ?? "",
  });
  if (!parsed.success) return { error: "generic" };
  const { exam_date, target_band, start_level } = parsed.data;
  if (exam_date <= todayIn(profile.timezone)) return { error: "date" };

  const update = {
    exam_date,
    target_band,
    start_level: start_level === "" || start_level === undefined ? null : start_level,
    ...extra,
  };
  const { error } = await supabase.from("profiles").update(update).eq("id", profile.id);
  if (error) return { error: "generic" };

  const [attempts, plan] = await Promise.all([getAttempts(supabase), getLatestPlan(supabase)]);
  await rebuildPlan(supabase, { ...profile, ...update }, attempts, plan);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function completeOnboarding(_prev: ExamFormState, form: FormData): Promise<ExamFormState> {
  const locale = form.get("locale");
  const extra: Record<string, unknown> = { onboarded_at: new Date().toISOString() };
  if (isLocale(locale)) {
    extra.locale = locale;
    await setLocaleCookie(locale);
  }
  const res = await saveExam(form, extra);
  if (res.ok) redirect("/");
  return res;
}

export async function updateExamSettings(_prev: ExamFormState, form: FormData): Promise<ExamFormState> {
  return saveExam(form);
}

export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  await setLocaleCookie(locale);
  const { supabase, profile } = await getSession();
  await supabase.from("profiles").update({ locale }).eq("id", profile.id);
  revalidatePath("/", "layout");
}

/** Used on the login page (no session yet). */
export async function setLocalePublic(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  await setLocaleCookie(locale);
  revalidatePath("/login");
}
