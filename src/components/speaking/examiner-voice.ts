"use client";

// The examiner's voice uses the browser's built-in speech synthesis (free).
let cachedVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice;
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  cachedVoice =
    en.find((v) => v.lang === "en-GB" && /female|natural|google|serena|kate|libby|sonia/i.test(v.name)) ??
    en.find((v) => v.lang === "en-GB") ??
    en.find((v) => v.lang === "en-AU") ??
    en.find((v) => v.lang === "en-US") ??
    en[0] ??
    null;
  if (!voices.length) cachedVoice = undefined; // voices may load later
  return cachedVoice ?? null;
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Speak text; resolves when finished (or after a safe timeout if the browser never reports the end). */
export function speak(text: string): Promise<void> {
  if (!canSpeak() || !text.trim()) return Promise.resolve();
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "en-GB";
    u.rate = 0.95;
    const words = text.split(/\s+/).length;
    const fallback = setTimeout(done, 1500 + words * 450);
    let finished = false;
    function done() {
      if (finished) return;
      finished = true;
      clearTimeout(fallback);
      resolve();
    }
    u.onend = done;
    u.onerror = done;
    synth.speak(u);
  });
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}
