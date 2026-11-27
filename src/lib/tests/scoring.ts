// Marking rules for objective IELTS questions.
import type { Answers, Group, ListeningPart, Question, ReadingPassage } from "./schema";

export type ErrorType = "blank" | "spelling" | "plural" | "number" | "word_limit" | "distractor" | "wrong";
export type QuestionResult = { n: number; correct: boolean; given: string; expected: string[]; error: ErrorType | null };

const CHOICE_ALIASES: Record<string, string> = { T: "TRUE", F: "FALSE", NG: "NOT GIVEN", Y: "YES", N: "NO" };

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.,;:!?"]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normChoice(s: string): string {
  const up = s.trim().toUpperCase().replace(/\s+/g, " ");
  return CHOICE_ALIASES[up] ?? up;
}

export function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

function classifyCompletion(given: string, expected: string[]): ErrorType {
  const g = normalize(given);
  for (const e of expected.map(normalize)) {
    if (g.replace(/s$/, "") === e.replace(/s$/, "")) return "plural";
    const gd = g.replace(/\D/g, ""), ed = e.replace(/\D/g, "");
    if (ed && gd && gd !== ed) return "number";
    if (levenshtein(g, e) <= Math.max(1, Math.floor(e.length / 5))) return "spelling";
  }
  return "wrong";
}

export function markQuestion(group: Group, q: Question, rawGiven: string | undefined): QuestionResult {
  const given = (rawGiven ?? "").trim();
  const base = { n: q.n, given, expected: q.answer };
  if (!given) return { ...base, correct: false, error: "blank" };

  if (group.type === "completion") {
    if (group.wordLimit && wordCount(given) > group.wordLimit) return { ...base, correct: false, error: "word_limit" };
    const ok = q.answer.some((a) => normalize(a) === normalize(given));
    return { ...base, correct: ok, error: ok ? null : classifyCompletion(given, q.answer) };
  }
  const g = normChoice(given);
  const ok = q.answer.some((a) => normChoice(a) === g);
  if (ok) return { ...base, correct: true, error: null };
  const distractor = q.distractors.some((d) => normChoice(d) === g);
  return { ...base, correct: false, error: distractor ? "distractor" : "wrong" };
}

export type TestResult = { raw: number; total: number; results: QuestionResult[]; errors: Partial<Record<ErrorType, number>> };

export function markGroups(groups: Group[], answers: Answers): TestResult {
  const results = groups.flatMap((g) => g.questions.map((q) => markQuestion(g, q, answers[q.n])));
  const errors: TestResult["errors"] = {};
  for (const r of results) if (r.error) errors[r.error] = (errors[r.error] ?? 0) + 1;
  return { raw: results.filter((r) => r.correct).length, total: results.length, results, errors };
}

// ---------- validation of AI-generated tests ----------

const CHOICES: Partial<Record<Group["type"], string[]>> = {
  tfng: ["TRUE", "FALSE", "NOT GIVEN"],
  ynng: ["YES", "NO", "NOT GIVEN"],
};

function contains(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle));
}

/**
 * Drop questions whose key cannot be right (answer not in the text, not among the
 * options, too many words), clear evidence that is not a real quote, and number
 * the remaining questions 1..N in order.
 */
export function cleanGroups(groups: Group[], sourceText: string, startAt = 1): Group[] {
  let n = startAt;
  const out: Group[] = [];
  for (const g of groups) {
    const keys = g.options.map((o) => o.key.toUpperCase());
    const questions: Question[] = [];
    let ctx = g.context;
    for (let q of g.questions) {
      if (g.type === "completion" && g.wordLimit) q = { ...q, answer: q.answer.filter((a) => wordCount(a) <= g.wordLimit!) };
      if (!q.answer.length) continue;
      let ok = true;
      if (CHOICES[g.type]) ok = q.answer.every((a) => CHOICES[g.type]!.includes(normChoice(a)));
      else if (g.type === "mcq") ok = !!q.options?.length && q.answer.every((a) => q.options!.some((o) => o.key.toUpperCase() === a.toUpperCase()));
      else if (g.type === "headings" || g.type === "match" || g.type === "map") ok = keys.length > 0 && q.answer.every((a) => keys.includes(a.toUpperCase()));
      else if (g.type === "completion")
        ok = q.answer.some((a) => contains(sourceText, a));
      if (!ok) continue;
      const evidence = q.explain.evidence && contains(sourceText, q.explain.evidence) ? q.explain.evidence : "";
      const oldN = q.n;
      const newN = n++;
      questions.push({ ...q, n: newN, explain: { ...q.explain, evidence } });
      if (ctx) ctx = ctx.replace(new RegExp(`\\[\\[${oldN}\\]\\]`), `[[#${newN}]]`);
    }
    // Gaps whose question was dropped are removed from the text too.
    if (questions.length) out.push({ ...g, context: ctx?.replace(/\[\[\d+\]\]/g, "…").replace(/\[\[#(\d+)\]\]/g, "[[$1]]"), questions });
  }
  return out;
}

export function passageText(p: ReadingPassage): string {
  return p.paragraphs.map((x) => x.text).join("\n");
}

export function scriptText(p: ListeningPart): string {
  return p.lines.map((l) => l.text).join("\n");
}

export function countQuestions(groups: Group[]): number {
  return groups.reduce((s, g) => s + g.questions.length, 0);
}

/** Shift question numbers so several passages/parts form one test (1–40). */
export function renumber(groups: Group[], offset: number): Group[] {
  if (!offset) return groups;
  return groups.map((g) => ({
    ...g,
    context: g.context?.replace(/\[\[(\d+)\]\]/g, (_, d) => `[[${Number(d) + offset}]]`),
    questions: g.questions.map((q) => ({ ...q, n: q.n + offset })),
  }));
}
