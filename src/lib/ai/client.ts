// Provider-agnostic AI client: Groq first, Gemini as fallback.
// Pure module (no env, no DB) so it can be unit-tested with a fake fetch.

import type { z } from "zod";

export type Provider = "groq" | "gemini";

export type ProviderConfig = {
  provider: Provider;
  apiKey: string;
  model: string;
};

export type UsageEvent = {
  provider: Provider | "mock";
  model: string;
  feature: string;
  tokensIn: number;
  tokensOut: number;
  ok: boolean;
};

export type AiDeps = {
  providers: ProviderConfig[];           // in order of preference
  fetch?: typeof fetch;
  log?: (e: UsageEvent) => Promise<void> | void;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
};

export type JsonRequest<T> = {
  feature: string;                       // e.g. "writing_score" (for usage stats)
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  temperature?: number;
  effort?: "low" | "medium" | "high";    // reasoning effort for models that support it
};

/** Every provider is rate-limited or down. Shown to the user as "limit reached, try later". */
export class AiUnavailableError extends Error {
  constructor(public reason: "limit" | "down" | "config", message?: string) {
    super(message ?? `AI unavailable (${reason})`);
    this.name = "AiUnavailableError";
  }
}

/** The model answered, but not with valid data even after a repair attempt. */
export class AiInvalidOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiInvalidOutputError";
  }
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Msg = { role: "system" | "user" | "assistant"; content: string };
type RawResult = { text: string; tokensIn: number; tokensOut: number };

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

async function callGroq(
  f: typeof fetch, cfg: ProviderConfig, messages: Msg[], opts: { maxTokens: number; temperature: number; json: boolean; effort?: string }, timeoutMs: number,
): Promise<RawResult> {
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: opts.temperature,
    max_completion_tokens: opts.maxTokens,
  };
  if (opts.json) body.response_format = { type: "json_object" };
  if (opts.effort && cfg.model.includes("gpt-oss")) body.reasoning_effort = opts.effort;
  const res = await f(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new HttpError(res.status, `groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
  };
}

async function callGemini(
  f: typeof fetch, cfg: ProviderConfig, messages: Msg[], opts: { maxTokens: number; temperature: number; json: boolean }, timeoutMs: number,
): Promise<RawResult> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const res = await f(GEMINI_URL(cfg.model), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
      generationConfig: {
        temperature: opts.temperature,
        maxOutputTokens: opts.maxTokens,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new HttpError(res.status, `gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const parts: Array<{ text?: string; thought?: boolean }> = data.candidates?.[0]?.content?.parts ?? [];
  return {
    text: parts.filter((p) => !p.thought).map((p) => p.text ?? "").join(""),
    tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: (data.usageMetadata?.candidatesTokenCount ?? 0) + (data.usageMetadata?.thoughtsTokenCount ?? 0),
  };
}

/** Pull a JSON object out of a reply that may be wrapped in ``` fences or prose. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("no JSON object in reply");
  }
}

function isRetryable(e: unknown): boolean {
  if (e instanceof HttpError) return e.status >= 500;
  return true; // network errors, timeouts
}

function isRateLimit(e: unknown): boolean {
  return e instanceof HttpError && (e.status === 429 || e.status === 413);
}

function formatZodError(err: z.ZodError): string {
  return err.issues
    .slice(0, 8)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

export function createAi(deps: AiDeps) {
  const f = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const timeoutMs = deps.timeoutMs ?? 55_000;
  const providers = deps.providers.filter((p) => p.apiKey && p.model);

  async function raw(cfg: ProviderConfig, feature: string, messages: Msg[], opts: { maxTokens: number; temperature: number; json: boolean; effort?: string }) {
    try {
      const r =
        cfg.provider === "groq"
          ? await callGroq(f, cfg, messages, opts, timeoutMs)
          : await callGemini(f, cfg, messages, opts, timeoutMs);
      await deps.log?.({ provider: cfg.provider, model: cfg.model, feature, tokensIn: r.tokensIn, tokensOut: r.tokensOut, ok: true });
      return r;
    } catch (e) {
      await deps.log?.({ provider: cfg.provider, model: cfg.model, feature, tokensIn: 0, tokensOut: 0, ok: false });
      throw e;
    }
  }

  /** Call providers in order: retry once on 5xx/network, skip to the next on 429. */
  async function withFallback<R>(fn: (cfg: ProviderConfig) => Promise<R>): Promise<R> {
    if (providers.length === 0) throw new AiUnavailableError("config", "No AI provider configured (set GROQ_API_KEY or GEMINI_API_KEY)");
    let sawLimit = false;
    let lastError: unknown;
    for (const cfg of providers) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await fn(cfg);
        } catch (e) {
          lastError = e;
          if (e instanceof AiInvalidOutputError) throw e;
          if (isRateLimit(e)) {
            sawLimit = true;
            break; // next provider
          }
          if (!isRetryable(e)) break;
          if (attempt === 0) await sleep(800);
        }
      }
    }
    if (sawLimit) throw new AiUnavailableError("limit", String(lastError));
    throw new AiUnavailableError("down", String(lastError));
  }

  async function json<T>(req: JsonRequest<T>): Promise<T> {
    const opts = {
      maxTokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.2,
      json: true,
      effort: req.effort,
    };
    const messages: Msg[] = [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ];
    return withFallback(async (cfg) => {
      const first = await raw(cfg, req.feature, messages, opts);
      let problem: string;
      try {
        const parsed = req.schema.safeParse(extractJson(first.text));
        if (parsed.success) return parsed.data as T;
        problem = formatZodError(parsed.error);
      } catch (e) {
        problem = (e as Error).message;
      }
      // One repair attempt on the same provider.
      const repair = await raw(cfg, req.feature + ":repair", [
        ...messages,
        { role: "assistant", content: first.text.slice(0, 12_000) },
        { role: "user", content: `Your JSON was invalid: ${problem}. Reply again with ONLY the corrected JSON object.` },
      ], opts);
      try {
        const parsed = req.schema.safeParse(extractJson(repair.text));
        if (parsed.success) return parsed.data as T;
        throw new AiInvalidOutputError(formatZodError(parsed.error));
      } catch (e) {
        if (e instanceof AiInvalidOutputError) throw e;
        throw new AiInvalidOutputError((e as Error).message);
      }
    });
  }

  async function text(req: { feature: string; messages: Msg[]; maxTokens?: number; temperature?: number }): Promise<string> {
    return withFallback(async (cfg) => {
      const r = await raw(cfg, req.feature, req.messages, {
        maxTokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.5,
        json: false,
      });
      return r.text.trim();
    });
  }

  return { json, text };
}

export type Ai = ReturnType<typeof createAi>;
