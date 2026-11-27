import "server-only";
import { z } from "zod";
import { createAi, errorSummary, GEMINI_BASE, GROQ_BASE, type ProviderConfig } from "./client";
import { aiProviders, isMockAi } from "./server";

export type ProviderCheck = {
  provider: "groq" | "gemini";
  model: string;
  ok: boolean;
  ms?: number;
  error?: string;
  modelListed: boolean | null;   // null = could not list models
  available: string[];           // text models this key can use
};

export type AiCheckResult = {
  mock: boolean;
  groqKey: boolean;
  geminiKey: boolean;
  checks: ProviderCheck[];
  stt: { provider: "groq" | "gemini" | null; model: string | null; listed: boolean | null };
};

async function listModels(cfg: ProviderConfig): Promise<{ ids: string[] | null; error?: string }> {
  try {
    const res =
      cfg.provider === "groq"
        ? await fetch(`${GROQ_BASE}/models`, { headers: { Authorization: `Bearer ${cfg.apiKey}` }, signal: AbortSignal.timeout(10_000) })
        : await fetch(`${GEMINI_BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": cfg.apiKey }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { ids: null, error: `${res.status} ${errorSummary(await res.text())}` };
    const data = await res.json();
    if (cfg.provider === "groq") return { ids: (data.data ?? []).map((m: { id: string }) => m.id) };
    return {
      ids: (data.models ?? [])
        .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m: { name: string }) => m.name.replace(/^models\//, "")),
    };
  } catch (e) {
    return { ids: null, error: String((e as Error).message).slice(0, 150) };
  }
}

const isTextModel = (id: string) => !/whisper|tts|guard|embed|image|vision|audio|live|veo|imagen|aqa|learnlm|robotics/i.test(id);

export async function checkAi(): Promise<AiCheckResult> {
  const providers = aiProviders();
  const checks: ProviderCheck[] = [];
  const lists = new Map<string, string[] | null>();

  for (const cfg of providers.slice(0, 3)) {
    const key = cfg.provider;
    if (!lists.has(key)) {
      const l = await listModels(cfg);
      lists.set(key, l.ids);
    }
    const ids = lists.get(key) ?? null;
    const t0 = Date.now();
    const check: ProviderCheck = {
      provider: cfg.provider,
      model: cfg.model,
      ok: false,
      modelListed: ids ? ids.includes(cfg.model) : null,
      available: (ids ?? []).filter(isTextModel).sort(),
    };
    try {
      const ai = createAi({ providers: [cfg], budgetMs: 25_000, timeoutMs: 20_000 });
      const r = await ai.json({
        feature: "check",
        system: 'Reply with the JSON object {"ok": true} and nothing else.',
        user: "ping",
        schema: z.object({ ok: z.boolean() }),
        maxTokens: 400,
        effort: "low",
      });
      check.ok = r.ok === true;
    } catch (e) {
      const err = e as { details?: string[]; message?: string };
      check.error = (err.details?.join(" · ") || err.message || String(e)).slice(0, 300);
    }
    check.ms = Date.now() - t0;
    checks.push(check);
  }

  const groq = providers.find((p) => p.provider === "groq");
  const sttModel = process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";
  const groqIds = lists.get("groq");
  const stt: AiCheckResult["stt"] = groq
    ? { provider: "groq", model: sttModel, listed: groqIds ? groqIds.includes(sttModel) : null }
    : providers.some((p) => p.provider === "gemini")
      ? { provider: "gemini", model: providers.find((p) => p.provider === "gemini")!.model, listed: null }
      : { provider: null, model: null, listed: null };

  return {
    mock: isMockAi(),
    groqKey: Boolean(process.env.GROQ_API_KEY?.trim()),
    geminiKey: Boolean(process.env.GEMINI_API_KEY?.trim()),
    checks,
    stt,
  };
}
