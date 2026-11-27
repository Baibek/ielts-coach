"use client";

export type SpeakerInfo = { name: string; gender: "male" | "female"; accent: "GB" | "US" | "AU" };

const FEMALE = /female|woman|samantha|karen|serena|moira|tessa|fiona|victoria|zira|hazel|susan|libby|sonia|natasha|aria|jenny|kate|catherine|emma|amy|olivia|ava|allison|joanna|salli|kimberly|nicky|martha|stephanie/i;
const MALE = /\bmale\b|daniel|alex|fred|george|ryan|guy|david|mark|thomas|arthur|oliver|james|william|lee|aaron|tom|eric|brian|matthew|joey|justin|russell|rishi|gordon/i;

function guessGender(v: SpeechSynthesisVoice): "male" | "female" | null {
  if (FEMALE.test(v.name)) return "female";
  if (MALE.test(v.name)) return "male";
  return null;
}

export type VoicePlan = { voice: SpeechSynthesisVoice | null; pitch: number; lang: string };

/** Give each speaker a distinct voice (accent and gender if the device has them). */
export function assignVoices(speakers: SpeakerInfo[]): Record<string, VoicePlan> {
  const all = typeof window !== "undefined" && window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  const en = all.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const used = new Set<string>();
  const plan: Record<string, VoicePlan> = {};
  for (const s of speakers) {
    const lang = `en-${s.accent}`;
    const ranked = [...en].sort((a, b) => score(b) - score(a));
    function score(v: SpeechSynthesisVoice) {
      let x = 0;
      if (v.lang.replace("_", "-").toLowerCase() === lang.toLowerCase()) x += 4;
      if (guessGender(v) === s.gender) x += 3;
      if (guessGender(v) && guessGender(v) !== s.gender) x -= 3;
      if (used.has(v.name)) x -= 5;
      if (/natural|neural|premium|enhanced|google/i.test(v.name)) x += 1;
      return x;
    }
    const voice = ranked[0] ?? null;
    if (voice) used.add(voice.name);
    // If we could not find a voice of the right gender, shift the pitch so speakers still differ.
    const g = voice ? guessGender(voice) : null;
    const pitch = g === s.gender ? 1 : s.gender === "male" ? 0.8 : 1.2;
    plan[s.name] = { voice, pitch, lang: voice?.lang ?? lang };
  }
  return plan;
}

export function speakLine(text: string, plan: VoicePlan | undefined, rate: number): Promise<void> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    if (plan?.voice) u.voice = plan.voice;
    u.lang = plan?.lang ?? "en-GB";
    u.pitch = plan?.pitch ?? 1;
    u.rate = rate;
    const words = text.split(/\s+/).length;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, (1500 + (words * 420) / rate));
    u.onend = finish;
    u.onerror = finish;
    window.speechSynthesis.speak(u);
  });
}

/** Voices load asynchronously in Chrome; wait briefly for them. */
export function voicesReady(): Promise<void> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) return resolve();
    if (window.speechSynthesis.getVoices().length) return resolve();
    const t = setTimeout(resolve, 1500);
    window.speechSynthesis.onvoiceschanged = () => {
      clearTimeout(t);
      resolve();
    };
  });
}
