// Examiner instructions. Kept compact to save tokens; the descriptor notes are a
// short paraphrase of the public IELTS Writing band descriptors.

import type { WritingPrompt } from "./schemas";
import { MIN_WORDS, type WritingTask } from "./scoring";

const DESCRIPTORS: Record<WritingTask, string> = {
  task1: `TASK ACHIEVEMENT (Task 1)
9-8: all requirements fully met; clear overview of main trends/stages; key features well selected and accurately reported.
7: clear overview; key features highlighted and illustrated, could be more fully extended; data accurate.
6: overview attempted; relevant data selected but some details irrelevant, inaccurate or mechanically listed.
5: no clear overview OR lists details mechanically; key features not adequately covered; may be inaccurate.
4 and below: few key features, confused, inaccurate or irrelevant; no data support.`,
  task2: `TASK RESPONSE (Task 2)
9-8: all parts of the task fully addressed; well-developed, extended and supported ideas; clear position throughout.
7: all parts addressed; clear position throughout; main ideas extended and supported but may over-generalise.
6: all parts addressed though some more than others; position relevant but conclusions may be unclear; some ideas insufficiently developed.
5: only partly addresses the task; position unclear or inconsistent; limited development; some irrelevant detail.
4 and below: minimal or tangential response; position unclear; ideas few, repetitive or unsupported.`,
};

const COMMON = `COHERENCE & COHESION
8: logical sequencing; paragraphing sufficient and appropriate; wide range of cohesive devices used well.
7: logically organised with clear progression; a clear central topic in each paragraph; range of linkers, some over/under-use.
6: coherent overall; cohesion within/between sentences faulty or mechanical; referencing not always clear; paragraphing not always logical.
5: some organisation but lacks overall progression; inadequate, inaccurate or overused linkers; paragraphing inadequate or missing.
4: information not arranged coherently; basic linkers, inaccurate or repetitive.
LEXICAL RESOURCE
8: wide, flexible, precise; skilful less common items; rare errors in spelling/word formation.
7: sufficient range for flexibility and precision; some less common items, awareness of style and collocation; occasional errors.
6: adequate range; attempts less common words with some inaccuracy; spelling/word-formation errors that do not impede communication.
5: limited range, minimally adequate; noticeable errors that may cause some difficulty for the reader.
4: basic, repetitive vocabulary; errors cause strain.
GRAMMATICAL RANGE & ACCURACY
8: wide range of structures; majority error-free; only occasional non-systematic errors.
7: variety of complex structures; frequent error-free sentences; good control with a few errors.
6: mix of simple and complex forms; some errors that rarely reduce communication.
5: limited range; complex sentences attempted but less accurate than simple; frequent errors may cause difficulty.
4: very limited range; rare subordinate clauses; errors predominate.`;

export function scoringSystemPrompt(task: WritingTask, language: string): string {
  return `You are a strict, experienced IELTS Academic Writing examiner. Score the candidate's ${task === "task1" ? "Task 1" : "Task 2"} response with the public IELTS band descriptors.
Rules:
- Never inflate. When between two bands, give the LOWER one. Most candidates at this stage score 5–6.5.
- Each criterion gets a WHOLE band 0–9.
- Minimum length is ${MIN_WORDS[task]} words; under-length answers lose marks in ${task === "task1" ? "Task Achievement" : "Task Response"}.
- If the answer does not address this exact question (off-topic, memorised, or about a different task), set on_topic=false.
${task === "task1" ? "- Check the figures against the data given. Wrong numbers or missing overview lower Task Achievement. No personal opinions should appear.\n" : ""}
${DESCRIPTORS[task]}
${COMMON}

Output JSON only, with this shape:
{"on_topic":bool,
 "criteria":{"task":C,"coherence":C,"lexical":C,"grammar":C},
 "summary":"2-3 sentences",
 "strengths":["max 3"],
 "priorities":["exactly the top 3 things to fix, most important first"],
 "corrections":[{"original":"exact words copied from the essay (shortest span with the error, max 12 words)","fix":"corrected span","rule":"one short sentence","category":"grammar|vocabulary|collocation|spelling|punctuation|cohesion|task|style","pattern":"2-5 word generic English name of the error type, e.g. 'subject-verb agreement', 'missing article', 'wrong preposition'"}],
 "rewrites":[{"original":"one weak paragraph copied exactly","improved":"the same paragraph rewritten at Band 8, keeping the candidate's ideas","why":"what makes it Band 8"}]}
where C = {"band":int,"comment":"2-3 sentences justifying the band","evidence":["1-3 short exact quotes from the essay"],"next_step":"one concrete action to reach the next band"}.
Corrections: up to 15 real errors, most important first; quote exactly. Rewrites: exactly 2 (the two weakest paragraphs).
Write comment, next_step, summary, strengths, priorities, rule and why in ${language}. Keep quotes, fixes, rewrites, patterns and IELTS terms in English.`;
}

export function promptAsText(p: WritingPrompt): string {
  if (p.task === "task2") return `${p.statement}\n${p.question}`;
  return `${p.prompt}\nData: ${JSON.stringify(p.visual)}`;
}

export function scoringUserPrompt(p: WritingPrompt, text: string, wordCount: number): string {
  return `QUESTION:\n${promptAsText(p)}\n\nWORD COUNT: ${wordCount} (minimum ${MIN_WORDS[p.task]})\n\nCANDIDATE RESPONSE:\n<<<\n${text}\n>>>`;
}

export const GEN_TASK2_SYSTEM = `You write original IELTS Academic Writing Task 2 questions. Never copy published Cambridge, IDP or British Council material.
Output JSON only: {"essay_type":"opinion|discussion|advantages_disadvantages|problem_solution|two_part","topic":"one or two words","statement":"1-2 sentences describing the issue or views","question":"the instruction line, e.g. 'To what extent do you agree or disagree?'"}`;

export const GEN_TASK1_SYSTEM = `You write original IELTS Academic Writing Task 1 questions with realistic, plausible invented data (never copy published tests).
Output JSON only: {"prompt":"The ... below shows ...","visual":V}. Make the data contain clear trends, a few comparisons and at least one exception worth reporting.
V shapes:
bar/line: {"kind":"bar"|"line","title":"","xLabel":"","yLabel":"","unit":"","categories":["3-8 labels"],"series":[{"name":"","values":[one number per category]}]} (2-4 series)
pie: {"kind":"pie","title":"","charts":[{"label":"year","slices":[{"name":"","value":number}]}]} (2 charts, 4-6 slices, each chart sums to 100)
table: {"kind":"table","title":"","unit":"","columns":["3-5 column headings"],"rows":[{"label":"","values":[one value per column]}]} (4-6 rows)
process: {"kind":"process","title":"","cyclic":bool,"steps":[{"label":"short","detail":"optional short"}]} (7-10 steps)
map: {"kind":"map","title":"","maps":[{"label":"year","features":[{"name":"","type":"building|road|park|water|car_park|field|trees|other","x":0-100,"y":0-70,"w":number,"h":number}]}]} (2 maps, 5-9 non-overlapping features each, same area before/after with several changes)`;
