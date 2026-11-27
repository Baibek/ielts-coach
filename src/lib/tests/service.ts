import "server-only";
import { AiInvalidOutputError } from "@/lib/ai/client";
import { aiJson } from "@/lib/ai/server";
import { rawToBand } from "@/lib/ielts/bands";
import type { createClient } from "@/lib/supabase/server";
import { LISTENING_BANK, READING_BANK } from "./bank";
import { LISTENING_SYSTEM, LISTENING_TOPICS, listeningUser, READING_SYSTEM, READING_TOPICS, READING_TYPE_SETS, readingUser } from "./prompts";
import { ListeningPart, ReadingPassage, type Answers, type Group } from "./schema";
import { cleanGroups, countQuestions, markGroups, passageText, renumber, scriptText, type TestResult } from "./scoring";

type DB = Awaited<ReturnType<typeof createClient>>;
export type ObjSkill = "reading" | "listening";
export type LoadedTest =
  | { id: string; skill: "reading"; passage: ReadingPassage }
  | { id: string; skill: "listening"; part: ListeningPart };

const KIND = { reading: "reading_passage", listening: "listening_part" } as const;

function cleanReading(p: ReadingPassage): ReadingPassage {
  return { ...p, groups: cleanGroups(p.groups, passageText(p)) };
}
function cleanListening(p: ListeningPart): ListeningPart {
  return { ...p, groups: cleanGroups(p.groups, scriptText(p)) };
}

export async function loadTest(supabase: DB, id: string): Promise<LoadedTest | null> {
  if (id.startsWith("gen:")) {
    const { data } = await supabase.from("generated_tests").select("skill, content").eq("id", id.slice(4)).maybeSingle();
    if (!data) return null;
    if (data.skill === "reading") {
      const p = ReadingPassage.safeParse(data.content);
      return p.success ? { id, skill: "reading", passage: p.data } : null;
    }
    const p = ListeningPart.safeParse(data.content);
    return p.success ? { id, skill: "listening", part: p.data } : null;
  }
  const r = READING_BANK.find((b) => b.id === id);
  if (r) return { id, skill: "reading", passage: cleanReading(ReadingPassage.parse(r.passage)) };
  const l = LISTENING_BANK.find((b) => b.id === id);
  if (l) return { id, skill: "listening", part: cleanListening(ListeningPart.parse(l.part)) };
  return null;
}

async function usedIds(supabase: DB, skill: ObjSkill): Promise<Set<string>> {
  const { data } = await supabase.from("attempts").select("meta").eq("skill", skill).limit(1000);
  return new Set((data ?? []).flatMap((r) => ((r.meta as { test_ids?: string[] })?.test_ids ?? [])));
}

/** Unused tests: built-in first, then cached AI tests. For Listening, `parts` limits which part numbers. */
export async function pickTests(supabase: DB, skill: ObjSkill, opts: { count: number; parts?: number[] }): Promise<LoadedTest[]> {
  const used = await usedIds(supabase, skill);
  const ids: string[] = (skill === "reading" ? READING_BANK : LISTENING_BANK).map((b) => b.id).filter((id) => !used.has(id));
  const { data } = await supabase.from("generated_tests").select("id").eq("kind", KIND[skill]).order("created_at").limit(200);
  for (const row of data ?? []) if (!used.has(`gen:${row.id}`)) ids.push(`gen:${row.id}`);

  const out: LoadedTest[] = [];
  const needParts = opts.parts ? [...opts.parts] : null;
  for (const id of ids) {
    if (out.length >= opts.count) break;
    const t = await loadTest(supabase, id);
    if (!t) continue;
    if (needParts && t.skill === "listening") {
      const i = needParts.indexOf(t.part.part);
      if (i < 0) continue;
      needParts.splice(i, 1);
    }
    out.push(t);
  }
  if (skill === "listening") out.sort((a, b) => (a.skill === "listening" && b.skill === "listening" ? a.part.part - b.part.part : 0));
  return out;
}

function mockReading(): unknown {
  const p = READING_BANK[0].passage;
  return { ...p, title: `${p.title} (AI ${Math.floor(Math.random() * 1000)})` };
}
function mockListening(part: number): unknown {
  const p = LISTENING_BANK[0].part;
  return { ...p, part, title: `${p.title} (AI part ${part})` };
}

/** Generate one new passage / listening part with AI, validate the keys and cache it. */
export async function generateTest(supabase: DB, skill: ObjSkill, partNo = 1): Promise<string> {
  const { count } = await supabase.from("generated_tests").select("id", { count: "exact", head: true }).eq("kind", KIND[skill]);
  const k = count ?? 0;
  let content: ReadingPassage | ListeningPart;
  if (skill === "reading") {
    const raw = await aiJson(supabase, {
      feature: "reading_generate",
      system: READING_SYSTEM,
      user: readingUser(READING_TOPICS[k % READING_TOPICS.length], READING_TYPE_SETS[k % READING_TYPE_SETS.length]),
      schema: ReadingPassage,
      maxTokens: 7000,
      temperature: 0.8,
      effort: "medium",
      mock: () => ReadingPassage.parse(mockReading()),
    });
    content = cleanReading(raw);
    if (countQuestions(content.groups) < 9) throw new AiInvalidOutputError("too few valid questions in the generated passage");
  } else {
    const topics = LISTENING_TOPICS[partNo];
    const raw = await aiJson(supabase, {
      feature: `listening_generate_p${partNo}`,
      system: LISTENING_SYSTEM,
      user: listeningUser(partNo, topics[k % topics.length]),
      schema: ListeningPart,
      maxTokens: 7000,
      temperature: 0.8,
      effort: "medium",
      mock: () => ListeningPart.parse(mockListening(partNo)),
    });
    content = cleanListening({ ...raw, part: partNo });
    if (countQuestions(content.groups) < 7) throw new AiInvalidOutputError("too few valid questions in the generated part");
  }
  const { data, error } = await supabase
    .from("generated_tests")
    .insert({ skill, kind: KIND[skill], content, model: process.env.AI_MOCK === "1" ? "mock" : null })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "could not save test");
  return `gen:${data.id}`;
}

/** Groups of several passages/parts renumbered into one test (1..N). */
export function combinedGroups(tests: LoadedTest[]): Group[][] {
  let offset = 0;
  return tests.map((t) => {
    const groups = t.skill === "reading" ? t.passage.groups : t.part.groups;
    const out = renumber(groups, offset);
    offset += countQuestions(groups);
    return out;
  });
}

export function markTests(tests: LoadedTest[], answers: Answers): TestResult & { band: number; byType: Record<string, [number, number]> } {
  const groupsPerTest = combinedGroups(tests);
  const all = groupsPerTest.flat();
  const res = markGroups(all, answers);
  const byType: Record<string, [number, number]> = {};
  for (const g of all) {
    for (const q of g.questions) {
      const r = res.results.find((x) => x.n === q.n)!;
      const v = byType[g.type] ?? [0, 0];
      byType[g.type] = [v[0] + (r.correct ? 1 : 0), v[1] + 1];
    }
  }
  const skill = tests[0]?.skill ?? "reading";
  return { ...res, band: rawToBand(skill, res.raw, Math.max(res.total, 1)), byType };
}
