// Provider-agnostic AI client: providers are tried in order (Groq, then Gemini).
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
  error?: string;
};

export type AiDeps = {
  providers: ProviderConfig[];           // in order of preference
  fetch?: typeof fetch;
  log?: (e: UsageEvent) => Promise<void> | void;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;                    // per HTTP call
  budgetMs?: number;                     // whole request incl. retries/fallbacks (fits a 60 s serverless limit)
  now?: () => number;
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

export type AiReason = "limit" | "down" | "config";

/** No provider could answer. `details` lists what each provider said (shown to the user, no secrets). */
export class AiUnavailableError extends Error {
  constructor(public reason: AiReason, public details: string[] = []) {
    super(`AI unavailable (${reason}): ${details.join(" | ")}`);
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

export class HttpError extends Error {
  constructor(public provider: string, public status: number, public body: string) {
    super(`${provider} ${status}: ${body}`);
  }
}

export type Msg = { role: "system" | "user" | "assistant"; content: string };
type RawResult = { text: string; tokensIn: number; tokensOut: number; truncated: boolean };
type CallOpts = { maxTokens: number; temperature: number; json: boolean; effort?: string };

export const GROQ_BASE = "https://api.groq.com/openai/v1";
export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Short, secret-free description of an API error body. */
export function errorSummary(body: string): string {
  try {
    const j = JSON.parse(body);
    const msg = j?.error?.message ?? j?.message ?? body;
    return String(msg).replace(/\s+/g, " ").slice(0, 200);
  } catch {
    return body.replace(/\s+/g, " ").slice(0, 200);
  }
}

async function callGroq(f: typeof fetch, cfg: ProviderConfig, messages: Msg[], opts: CallOpts, timeoutMs: number): Promise<RawResult> {
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: opts.temperature,
    max_completion_tokens: opts.maxTokens,
  };
  if (opts.json) body.response_format = { type: "json_object" };
  if (opts.effort && cfg.model.includes("gpt-oss")) body.reasoning_effort = opts.effort;
  const res = await f(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new HttpError("groq", res.status, errorSummary(await res.text()));
  const data = await res.json();
  const choice = data.choices?.[0];
  return {
    text: choice?.message?.content ?? "",
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
    truncated: choice?.finish_reason === "length",
  };
}

async function callGemini(f: typeof fetch, cfg: ProviderConfig, messages: Msg[], opts: CallOpts, timeoutMs: number): Promise<RawResult> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const res = await f(`${GEMINI_BASE}/models/${encodeURIComponent(cfg.model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
      generationConfig: {
        temperature: opts.temperature,
        // Thinking models spend part of this budget on hidden reasoning, so leave room.
        maxOutputTokens: Math.max(opts.maxTokens * 2, 8192),
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new HttpError("gemini", res.status, errorSummary(await res.text()));
  const data = await res.json();
  const cand = data.candidates?.[0];
  const parts: Array<{ text?: string; thought?: boolean }> = cand?.content?.parts ?? [];
  if (!parts.length && data.promptFeedback?.blockReason) {
    throw new HttpError("gemini", 400, `blocked: ${data.promptFeedback.blockReason}`);
  }
  return {
    text: parts.filter((p) => !p.thought).map((p) => p.text ?? "").join(""),
    tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: (data.usageMetadata?.candidatesTokenCount ?? 0) + (data.usageMetadata?.thoughtsTokenCount ?? 0),
    truncated: cand?.finishReason === "MAX_TOKENS",
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

type Kind = "limit" | "config" | "retry" | "skip";

function classify(e: unknown): Kind {
  if (e instanceof HttpError) {
    if (e.status === 429 || e.status === 413) return "limit";
    if (e.status === 400 || e.status === 401 || e.status === 403 || e.status === 404) return "config";
    if (e.status >= 500) return "retry";
    return "skip";
  }
  return "retry"; // network error or timeout
}

function describe(cfg: ProviderConfig, e: unknown): string {
  if (e instanceof HttpError) return `${cfg.provider} (${cfg.model}): ${e.status} ${e.body}`;
  const name = (e as Error)?.name;
  if (name === "TimeoutError" || name === "AbortError") return `${cfg.provider} (${cfg.model}): timeout`;
  return `${cfg.provider} (${cfg.model}): ${String((e as Error)?.message ?? e).slice(0, 150)}`;
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
  const now = deps.now ?? (() => Date.now());
  const timeoutMs = deps.timeoutMs ?? 45_000;
  const budgetMs = deps.budgetMs ?? 52_000;
  const providers = deps.providers.filter((p) => p.apiKey && p.model);

  async function raw(cfg: ProviderConfig, feature: string, messages: Msg[], opts: CallOpts, timeout: number) {
    try {
      const r = cfg.provider === "groq"
        ? await callGroq(f, cfg, messages, opts, timeout)
        : await callGemini(f, cfg, messages, opts, timeout);
      await deps.log?.({ provider: cfg.provider, model: cfg.model, feature, tokensIn: r.tokensIn, tokensOut: r.tokensOut, ok: true });
      return r;
    } catch (e) {
      await deps.log?.({ provider: cfg.provider, model: cfg.model, feature, tokensIn: 0, tokensOut: 0, ok: false, error: describe(cfg, e) });
      throw e;
    }
  }

  /**
   * Call providers in order: retry once on 5xx/network, move on after a rate
   * limit or a config error (bad key / unknown model), stop when time runs out.
   */
  async function withFallback<R>(fn: (cfg: ProviderConfig, timeout: number) => Promise<R>): Promise<R> {
    if (providers.length === 0) throw new AiUnavailableError("config", ["no AI key configured (GEMINI_API_KEY or GROQ_API_KEY)"]);
    const start = now();
    const details: string[] = [];
    let sawLimit = false;
    let sawConfig = false;
    outer: for (const cfg of providers) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const left = budgetMs - (now() - start);
        if (left < 4_000) {
          details.push("time limit reached");
          break outer;
        }
        try {
          return await fn(cfg, Math.min(timeoutMs, left - 1_000));
        } catch (e) {
          if (e instanceof AiInvalidOutputError) throw e;
          details.push(describe(cfg, e));
          const kind = classify(e);
          if (kind === "limit") sawLimit = true;
          if (kind === "config") sawConfig = true;
          if (kind !== "retry") break;
          if (attempt === 0) await sleep(800);
        }
      }
    }
    throw new AiUnavailableError(sawLimit ? "limit" : sawConfig ? "config" : "down", details);
  }

  async function json<T>(req: JsonRequest<T>): Promise<T> {
    const opts: CallOpts = { maxTokens: req.maxTokens ?? 4096, temperature: req.temperature ?? 0.2, json: true, effort: req.effort };
    const messages: Msg[] = [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ];
    return withFallback(async (cfg, timeout) => {
      const t0 = now();
      const first = await raw(cfg, req.feature, messages, opts, timeout);
      let problem: string;
      try {
        const parsed = req.schema.safeParse(extractJson(first.text));
        if (parsed.success) return parsed.data as T;
        problem = formatZodError(parsed.error);
      } catch (e) {
        problem = first.truncated ? "the reply was cut off (too long)" : (e as Error).message;
      }
      // One repair attempt on the same provider, if time allows.
      const left = timeout - (now() - t0);
      if (left < 4_000) throw new AiInvalidOutputError(problem);
      const repair = await raw(cfg, req.feature + ":repair", [
        ...messages,
        { role: "assistant", content: first.text.slice(0, 12_000) },
        {
          role: "user",
          content: `Your JSON was invalid: ${problem}. Reply again with ONLY the corrected, complete JSON object${first.truncated ? ", shorter (fewer corrections, shorter comments)" : ""}.`,
        },
      ], opts, left);
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
    return withFallback(async (cfg, timeout) => {
      const r = await raw(cfg, req.feature, req.messages, { maxTokens: req.maxTokens ?? 1024, temperature: req.temperature ?? 0.5, json: false }, timeout);
      return r.text.trim();
    });
  }

  return { json, text, providers };
}

export type Ai = ReturnType<typeof createAi>;
