import type { Skill } from "@/lib/ielts/bands";
import type { Locale } from "@/lib/i18n";
import type { PlanDay } from "@/lib/plan/engine";

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  locale: Locale;
  feedback_lang: Locale | null;
  timezone: string;
  exam_date: string | null;
  target_band: number;
  start_level: number | null;
  onboarded_at: string | null;
};

export type AttemptRow = {
  id: string;
  skill: Skill;
  type: "practice" | "timed" | "diagnostic" | "mock";
  band: number | null;
  raw_score: number | null;
  max_score: number | null;
  created_at: string;
};

export type StudyPlanRow = {
  id: string;
  start_date: string;
  exam_date: string;
  basis: { bands?: Record<Skill, number | null>; target?: number; fallback?: number };
  days: PlanDay[];
  done_keys: string[];
  created_at: string;
};

export type AiUsageRow = {
  provider: "groq" | "gemini" | "mock";
  tokens_in: number;
  tokens_out: number;
  ok: boolean;
  created_at: string;
};
