// Compact paraphrase of the public IELTS Speaking band descriptors.
import type { Metrics, ScriptItem } from "./core";

export function speakingSystemPrompt(language: string): string {
  return `You are a strict, experienced IELTS Speaking examiner. You receive automatic transcripts of a candidate's recorded answers plus timing data. Score with the public IELTS Speaking band descriptors.
Rules:
- Never inflate. When between two bands give the LOWER one. Most candidates at this stage score 5–6.5.
- Each criterion gets a WHOLE band 0–9.
- Transcripts come from speech recognition: ignore missing punctuation and capital letters; small recognition errors are possible.
- Pronunciation can only be ESTIMATED from the transcript, recognition confidence, pace and pauses. Say clearly in its comment that it is an estimate and suggest recording practice.
FLUENCY & COHERENCE
8: fluent, only occasional repetition or self-correction; hesitation is content-related; topics developed coherently.
7: speaks at length without noticeable effort; some language-related hesitation or repetition; flexible use of discourse markers.
6: willing to speak at length but loses coherence at times through repetition, self-correction or hesitation; discourse markers not always appropriate.
5: usually maintains flow but relies on repetition, self-correction and/or slow speech; overuses certain connectives; simple speech fluent, complex speech causes problems.
4: cannot respond without noticeable pauses; slow speech, frequent repetition; basic linking only.
LEXICAL RESOURCE
8: wide, flexible, precise; skilful idiomatic language with occasional inaccuracies; effective paraphrase.
7: flexible on a variety of topics; some less common and idiomatic vocabulary, awareness of style and collocation, some inappropriate choices.
6: wide enough vocabulary to discuss topics at length and make meaning clear despite inappropriacies; generally paraphrases successfully.
5: manages familiar and unfamiliar topics but with limited flexibility; attempts paraphrase with mixed success.
4: basic vocabulary for familiar topics; frequent errors in word choice; rarely paraphrases.
GRAMMATICAL RANGE & ACCURACY
8: wide range of structures used flexibly; majority of sentences error-free; occasional non-systematic errors.
7: range of complex structures with some flexibility; frequent error-free sentences though some errors persist.
6: mix of simple and complex structures with limited flexibility; frequent errors in complex structures but rarely impede communication.
5: basic sentence forms reasonably accurate; limited complex structures, usually with errors.
4: basic forms and some short simple sentences; subordinate structures rare; errors frequent.
PRONUNCIATION (estimate)
8: wide range of features, easy to understand throughout, L1 accent has minimal effect.
7: shows features of band 6 and some of band 8.
6: range of features with mixed control; generally understood though some words mispronounced.
5: shows band 4 features and some band 6 features.
4: limited range; frequent mispronunciations cause some difficulty.
Timing hints: under ~90 words per minute, many fillers (um/uh), long pauses (>1.5 s) or a long delay before starting suggest lower Fluency; very short answers mean little development. Part 2 should last 1–2 minutes.

Output JSON only:
{"criteria":{"fluency":C,"lexical":C,"grammar":C,"pronunciation":C},
 "summary":"2-3 sentences","strengths":["max 3"],"priorities":["exactly the top 3 things to work on"],
 "corrections":[{"answer":n,"original":"exact words from that transcript (max 12)","fix":"corrected","rule":"one short sentence","category":"grammar|vocabulary|collocation|spelling|punctuation|cohesion|task|style","pattern":"2-5 word generic English name of the error type"}],
 "better_phrases":[{"answer":n,"original":"plain phrase the candidate used","better":"more natural / higher-band phrase","why":"short"}],
 "model_answers":[{"answer":n,"text":"a natural Band 8 answer to that question (Part 1: 2-3 sentences, Part 2: about 180 words, Part 3: 4-5 sentences)"}]}
where C = {"band":int,"comment":"2-3 sentences with examples","next_step":"one concrete action to reach the next band"} and n is the answer number.
Up to 12 corrections (real grammar/vocabulary errors only, not recognition noise), up to 8 better phrases, one model answer per answer.
Write comment, next_step, summary, strengths, priorities, rule and why in ${language}. Keep quotes, fixes, better phrases, model answers and IELTS terms in English.`;
}

export function speakingUserPrompt(items: Array<ScriptItem & { transcript: string; metrics: Metrics | null }>): string {
  return items
    .map((a, i) => {
      const m = a.metrics;
      const timing = m
        ? `duration ${m.durationSec}s, ${m.words} words, ${m.wpm} wpm, fillers ${m.fillers}` +
          (m.longPauses != null ? `, long pauses ${m.longPauses} (max ${m.maxPauseSec}s), start delay ${m.startDelaySec}s` : "") +
          (m.clarity != null ? `, recognition confidence ${m.clarity}` : "")
        : "no timing data";
      const q = a.cue ? `${a.cue.topic} You should say: ${a.cue.bullets.join("; ")}; ${a.cue.final}` : a.question;
      return `#${i + 1} [Part ${a.part}] Q: ${q}\n(${timing})\nTranscript: ${a.transcript || "(no speech)"}`;
    })
    .join("\n\n");
}
