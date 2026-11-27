import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AiInvalidOutputError, AiUnavailableError, createAi, extractJson, type UsageEvent } from "@/lib/ai/client";

const schema = z.object({ band: z.number() });
const groq = { provider: "groq" as const, apiKey: "g", model: "openai/gpt-oss-120b" };
const gemini = { provider: "gemini" as const, apiKey: "m", model: "gemini-2.5-flash" };

function groqReply(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200 });
}
function geminiReply(text: string) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3 } }), { status: 200 });
}
const status = (s: number) => new Response("err", { status: s });

function setup(responses: Response[]) {
  const calls: string[] = [];
  const log: UsageEvent[] = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    void init;
    calls.push(String(url).includes("groq") ? "groq" : "gemini");
    const r = responses.shift();
    if (!r) throw new Error("no more responses");
    return r;
  });
  const ai = createAi({
    providers: [groq, gemini],
    fetch: fetchMock as unknown as typeof fetch,
    log: (e) => void log.push(e),
    sleep: async () => {},
  });
  return { ai, calls, log, fetchMock };
}

const req = { feature: "test", system: "s", user: "u", schema };

describe("aiClient", () => {
  it("returns validated JSON from Groq and logs usage", async () => {
    const { ai, calls, log } = setup([groqReply('{"band": 6.5}')]);
    await expect(ai.json(req)).resolves.toEqual({ band: 6.5 });
    expect(calls).toEqual(["groq"]);
    expect(log).toEqual([{ provider: "groq", model: groq.model, feature: "test", tokensIn: 10, tokensOut: 5, ok: true }]);
  });

  it("sends reasoning_effort and JSON mode to gpt-oss models", async () => {
    const { ai, fetchMock } = setup([groqReply('{"band": 7}')]);
    await ai.json({ ...req, effort: "medium" });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.reasoning_effort).toBe("medium");
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("switches to Gemini immediately when Groq is rate-limited (429)", async () => {
    const { ai, calls, log } = setup([status(429), geminiReply('{"band": 6}')]);
    await expect(ai.json(req)).resolves.toEqual({ band: 6 });
    expect(calls).toEqual(["groq", "gemini"]);
    expect(log.map((l) => [l.provider, l.ok])).toEqual([["groq", false], ["gemini", true]]);
    expect(log[0].error).toContain("429");
  });

  it("retries Groq once on 5xx, then falls back to Gemini", async () => {
    const { ai, calls } = setup([status(503), status(500), geminiReply('{"band": 5.5}')]);
    await expect(ai.json(req)).resolves.toEqual({ band: 5.5 });
    expect(calls).toEqual(["groq", "groq", "gemini"]);
  });

  it("recovers from a 5xx with a successful retry on the same provider", async () => {
    const { ai, calls } = setup([status(502), groqReply('{"band": 8}')]);
    await expect(ai.json(req)).resolves.toEqual({ band: 8 });
    expect(calls).toEqual(["groq", "groq"]);
  });

  it("asks the model to repair invalid JSON once", async () => {
    const { ai, calls, fetchMock } = setup([groqReply('{"band": "six"}'), groqReply('{"band": 6}')]);
    await expect(ai.json(req)).resolves.toEqual({ band: 6 });
    expect(calls).toEqual(["groq", "groq"]);
    const repairBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(repairBody.messages.at(-1).content).toMatch(/invalid.*band/i);
  });

  it("throws AiInvalidOutputError when the repair is still invalid", async () => {
    const { ai } = setup([groqReply("not json"), groqReply('{"x":1}')]);
    await expect(ai.json(req)).rejects.toBeInstanceOf(AiInvalidOutputError);
  });

  it("throws AiUnavailableError('limit') when every provider is rate-limited", async () => {
    const { ai } = setup([status(429), status(429)]);
    const err = await ai.json(req).catch((e) => e);
    expect(err).toBeInstanceOf(AiUnavailableError);
    expect(err.reason).toBe("limit");
  });

  it("throws AiUnavailableError('config') with no keys", async () => {
    const ai = createAi({ providers: [{ ...groq, apiKey: "" }] });
    const err = await ai.json(req).catch((e) => e);
    expect(err.reason).toBe("config");
  });

  it("ignores Gemini thought parts and returns text", async () => {
    const r = new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "thinking", thought: true }, { text: "Hello" }] } }] }), { status: 200 });
    const { ai } = setup([status(429), r]);
    await expect(ai.text({ feature: "chat", messages: [{ role: "user", content: "hi" }] })).resolves.toBe("Hello");
  });
});

describe("aiClient error handling", () => {
  it("treats an unknown model or bad key as a config problem and moves on", async () => {
    const notFound = new Response(JSON.stringify({ error: { message: "The model `x` does not exist" } }), { status: 404 });
    const { ai, calls } = setup([notFound, geminiReply('{"band": 7}')]);
    await expect(ai.json(req)).resolves.toEqual({ band: 7 });
    expect(calls).toEqual(["groq", "gemini"]);
  });

  it("reports config with readable details when every provider rejects the request", async () => {
    const bad = () => new Response(JSON.stringify({ error: { message: "API key not valid" } }), { status: 400 });
    const { ai } = setup([bad(), bad()]);
    const err = await ai.json(req).catch((e) => e);
    expect(err).toBeInstanceOf(AiUnavailableError);
    expect(err.reason).toBe("config");
    expect(err.details.join(" ")).toContain("API key not valid");
  });

  it("works with Gemini only (no Groq key) and leaves room for thinking tokens", async () => {
    const calls: RequestInit[] = [];
    const ai = createAi({
      providers: [{ ...groq, apiKey: "" }, gemini],
      fetch: (async (_u: string, init: RequestInit) => {
        calls.push(init);
        return geminiReply('{"band": 6}');
      }) as unknown as typeof fetch,
    });
    await expect(ai.json({ ...req, maxTokens: 3000 })).resolves.toEqual({ band: 6 });
    const body = JSON.parse(calls[0].body as string);
    expect(body.generationConfig.maxOutputTokens).toBe(8192);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });

  it("asks for a shorter answer when the first reply was cut off", async () => {
    const cut = new Response(JSON.stringify({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: '{"band": ' }] } }] }), { status: 200 });
    const bodies: string[] = [];
    const replies = [cut, geminiReply('{"band": 5}')];
    const ai = createAi({
      providers: [gemini],
      fetch: (async (_u: string, init: RequestInit) => {
        bodies.push(init.body as string);
        return replies.shift()!;
      }) as unknown as typeof fetch,
    });
    await expect(ai.json(req)).resolves.toEqual({ band: 5 });
    expect(JSON.parse(bodies[1]).contents.at(-1).parts[0].text).toMatch(/cut off.*shorter/);
  });

  it("stops trying when the time budget is used up", async () => {
    let t = 0;
    const ai = createAi({
      providers: [groq, gemini],
      now: () => t,
      sleep: async () => {},
      budgetMs: 10_000,
      fetch: (async () => {
        t += 7_000;
        return new Response("down", { status: 503 });
      }) as unknown as typeof fetch,
    });
    const err = await ai.json(req).catch((e) => e);
    expect(err.reason).toBe("down");
    expect(err.details.join(" ")).toContain("time limit");
  });
});

describe("extractJson", () => {
  it("handles code fences and surrounding prose", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here you go: {"a":2} thanks')).toEqual({ a: 2 });
  });
});
