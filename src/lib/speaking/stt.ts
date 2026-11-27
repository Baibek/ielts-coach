import "server-only";
import { errorSummary, GEMINI_BASE, GROQ_BASE, HttpError, AiUnavailableError } from "@/lib/ai/client";
import { aiProviders, isMockAi } from "@/lib/ai/server";
import type { createClient } from "@/lib/supabase/server";
import type { Segment } from "./core";

type DB = Awaited<ReturnType<typeof createClient>>;
export type SttResult = { text: string; segments: Segment[] | null; provider: "groq" | "gemini" | "mock"; model: string };

// Whisper drops hesitations unless the prompt contains some; keeping them matters for Fluency.
const FILLER_PROMPT = "Umm, let me think, like, hmm... Okay, uh, here's what I'm thinking.";

async function groqStt(blob: Blob, key: string, model: string): Promise<SttResult> {
  const form = new FormData();
  form.append("file", blob, "answer.wav");
  form.append("model", model);
  form.append("response_format", "verbose_json");
  form.append("language", "en");
  form.append("temperature", "0");
  form.append("prompt", FILLER_PROMPT);
  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new HttpError("groq", res.status, errorSummary(await res.text()));
  const data = await res.json();
  return {
    text: String(data.text ?? "").trim(),
    segments: Array.isArray(data.segments)
      ? data.segments.map((s: Segment) => ({ start: s.start, end: s.end, avg_logprob: s.avg_logprob }))
      : null,
    provider: "groq",
    model,
  };
}

async function geminiStt(blob: Blob, key: string, model: string): Promise<SttResult> {
  const b64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
  const res = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { inline_data: { mime_type: "audio/wav", data: b64 } },
          { text: "Transcribe this IELTS candidate's spoken English exactly as spoken: keep hesitations (um, uh, er), repetitions, self-corrections and grammar mistakes. Do not correct or summarise. If there is no speech, return an empty string. Output only the transcript." },
        ],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 4096 },
    }),
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) throw new HttpError("gemini", res.status, errorSummary(await res.text()));
  const data = await res.json();
  const parts: Array<{ text?: string; thought?: boolean }> = data.candidates?.[0]?.content?.parts ?? [];
  return { text: parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("").trim(), segments: null, provider: "gemini", model };
}

function mockTranscript(question: string, durationSec: number): string {
  const base = `Well, um, that's an interesting question. I think ${question.replace(/\?$/, "").toLowerCase()} is quite important for me, because, uh, it is part of my daily life.`;
  const extra = " For example, when I was a child I usually spend a lot of time on it and, you know, I enjoyed it very much.";
  return base + extra.repeat(Math.max(0, Math.floor(durationSec / 20)));
}

/** Speech-to-text: Groq Whisper when a Groq key is set, otherwise Gemini audio understanding. */
export async function transcribe(supabase: DB, blob: Blob, question: string, durationSec: number): Promise<SttResult> {
  if (isMockAi()) return { text: mockTranscript(question, durationSec), segments: null, provider: "mock", model: "mock" };

  const groqKey = process.env.GROQ_API_KEY?.trim();
  const attempts: Array<() => Promise<SttResult>> = [];
  if (groqKey) attempts.push(() => groqStt(blob, groqKey, process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo"));
  for (const p of aiProviders().filter((x) => x.provider === "gemini")) attempts.push(() => geminiStt(blob, p.apiKey, p.model));
  if (!attempts.length) throw new AiUnavailableError("config", ["no AI key configured (GEMINI_API_KEY or GROQ_API_KEY)"]);

  const details: string[] = [];
  let sawLimit = false;
  for (const run of attempts) {
    try {
      const r = await run();
      await supabase.from("ai_usage").insert({ provider: r.provider, model: r.model, feature: "speaking_stt", ok: true });
      return r;
    } catch (e) {
      const msg = e instanceof HttpError ? `${e.provider}: ${e.status} ${e.body}` : `stt: ${String((e as Error).message).slice(0, 120)}`;
      details.push(msg);
      if (e instanceof HttpError && (e.status === 429 || e.status === 413)) sawLimit = true;
      await supabase.from("ai_usage").insert({
        provider: e instanceof HttpError ? e.provider : "gemini", model: "stt", feature: "speaking_stt", ok: false, error: msg.slice(0, 300),
      });
    }
  }
  throw new AiUnavailableError(sawLimit ? "limit" : "down", details);
}
