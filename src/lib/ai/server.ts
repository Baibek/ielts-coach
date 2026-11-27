import "server-only";
import { createAi, AiInvalidOutputError, AiUnavailableError, type JsonRequest, type UsageEvent } from "./client";
import type { createClient } from "@/lib/supabase/server";

type DB = Awaited<ReturnType<typeof createClient>>;

export function isMockAi(): boolean {
  return process.env.AI_MOCK === "1";
}

function usageLogger(supabase: DB) {
  return async (e: UsageEvent) => {
    await supabase.from("ai_usage").insert({
      provider: e.provider,
      model: e.model,
      feature: e.feature,
      tokens_in: e.tokensIn,
      tokens_out: e.tokensOut,
      ok: e.ok,
    });
  };
}

export function getAi(supabase: DB) {
  return createAi({
    providers: [
      { provider: "groq", apiKey: process.env.GROQ_API_KEY ?? "", model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b" },
      { provider: "gemini", apiKey: process.env.GEMINI_API_KEY ?? "", model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash" },
    ],
    log: usageLogger(supabase),
  });
}

/** JSON call with a mock fallback for keyless local testing (AI_MOCK=1). */
export async function aiJson<T>(supabase: DB, req: JsonRequest<T> & { mock: () => T }): Promise<T> {
  if (isMockAi()) {
    await new Promise((r) => setTimeout(r, 400));
    const value = req.schema.parse(req.mock());
    await usageLogger(supabase)({ provider: "mock", model: "mock", feature: req.feature, tokensIn: 0, tokensOut: 0, ok: true });
    return value;
  }
  return getAi(supabase).json(req);
}

export type AiErrorCode = "limit" | "down" | "config" | "invalid";

export function aiErrorCode(e: unknown): AiErrorCode | null {
  if (e instanceof AiUnavailableError) return e.reason;
  if (e instanceof AiInvalidOutputError) return "invalid";
  return null;
}

export const LANGUAGE_NAME = { kk: "Kazakh", ru: "Russian", en: "English" } as const;
