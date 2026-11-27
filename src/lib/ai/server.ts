import "server-only";
import { createAi, AiInvalidOutputError, AiUnavailableError, type JsonRequest, type ProviderConfig, type UsageEvent } from "./client";
import type { createClient } from "@/lib/supabase/server";

type DB = Awaited<ReturnType<typeof createClient>>;

export function isMockAi(): boolean {
  return process.env.AI_MOCK === "1";
}

/**
 * Providers in order: Groq (if a key is set), your Gemini model, then Google's
 * "latest" aliases, so the app keeps working when an older model id is retired.
 */
export function aiProviders(): ProviderConfig[] {
  const geminiKey = process.env.GEMINI_API_KEY ?? "";
  const models = [
    process.env.GEMINI_MODEL,
    "gemini-flash-latest",
    process.env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest",
  ].filter((m, i, all): m is string => Boolean(m?.trim()) && all.indexOf(m) === i);
  const list: ProviderConfig[] = [
    { provider: "groq", apiKey: process.env.GROQ_API_KEY ?? "", model: process.env.GROQ_MODEL || "openai/gpt-oss-120b" },
    ...models.map((model) => ({ provider: "gemini" as const, apiKey: geminiKey, model })),
  ];
  return list.filter((p) => p.apiKey.trim() && p.model.trim());
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
      error: e.error ?? null,
    });
  };
}

export function getAi(supabase: DB) {
  return createAi({ providers: aiProviders(), log: usageLogger(supabase) });
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

/** Technical detail for the error box (no secrets: provider messages only). */
export function aiErrorDetail(e: unknown): string | undefined {
  if (e instanceof AiUnavailableError) return e.details.join(" · ").slice(0, 500) || undefined;
  if (e instanceof AiInvalidOutputError) return e.message.slice(0, 300);
  return undefined;
}

export const LANGUAGE_NAME = { kk: "Kazakh", ru: "Russian", en: "English" } as const;
