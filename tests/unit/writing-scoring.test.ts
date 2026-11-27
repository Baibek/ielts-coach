import { describe, expect, it } from "vitest";
import { applyRules, countWords, locateCorrections, taskBand, MIN_WORDS } from "@/lib/writing/scoring";
import type { WritingScore } from "@/lib/writing/schemas";

function score(bands: [number, number, number, number], onTopic = true): WritingScore {
  const c = (band: number) => ({ band, comment: "c", evidence: [], next_step: "" });
  return {
    on_topic: onTopic,
    criteria: { task: c(bands[0]), coherence: c(bands[1]), lexical: c(bands[2]), grammar: c(bands[3]) },
    summary: "s",
    strengths: [],
    priorities: [],
    corrections: [],
    rewrites: [],
  };
}

describe("countWords", () => {
  it("counts words like the computer-delivered test", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("  Hello   world \n\n new-line  ")).toBe(3);
    expect(countWords("In 2020, 45% of people (aged 18-25) said: yes.")).toBe(9);
  });
  it("does not count lone punctuation", () => {
    expect(countWords("Hello - world , !")).toBe(2);
  });
});

describe("taskBand", () => {
  it("averages the four criteria and rounds DOWN to a half band", () => {
    expect(taskBand([6, 6, 7, 6])).toBe(6); // 6.25 -> 6.0
    expect(taskBand([6, 7, 7, 6])).toBe(6.5);
    expect(taskBand([7, 7, 7, 6])).toBe(6.5); // 6.75 -> 6.5
    expect(taskBand([7, 7, 7, 7])).toBe(7);
  });
});

describe("applyRules", () => {
  it("keeps whole-number criterion bands (floors halves)", () => {
    const r = applyRules(score([6.5, 7, 6, 6]), "task2", 300);
    expect(r.criteria).toEqual({ task: 6, coherence: 7, lexical: 6, grammar: 6 });
    expect(r.overall).toBe(6);
    expect(r.penalties).toEqual([]);
  });

  it("penalises slightly under-length answers in Task Response only", () => {
    const r = applyRules(score([7, 7, 7, 7]), "task2", 240); // >= 90% of 250
    expect(r.criteria.task).toBe(6);
    expect(r.criteria.lexical).toBe(7);
    expect(r.penalties).toContain("under_length");
  });

  it("caps clearly under-length answers harder", () => {
    const r = applyRules(score([7, 7, 7, 7]), "task1", 90); // < 2/3 of 150
    expect(r.criteria.task).toBe(4);
    expect(r.criteria.coherence).toBe(5);
    expect(r.criteria.grammar).toBe(5);
  });

  it("caps very short answers severely", () => {
    const r = applyRules(score([6, 6, 6, 6]), "task2", 60);
    expect(r.criteria.task).toBe(2);
    expect(r.criteria.lexical).toBe(4);
  });

  it("caps off-topic answers at 4 for Task Response", () => {
    const r = applyRules(score([6, 6, 6, 6], false), "task2", 280);
    expect(r.criteria.task).toBe(4);
    expect(r.penalties).toContain("off_topic");
  });

  it("never raises a band the examiner gave", () => {
    const r = applyRules(score([3, 3, 3, 3]), "task2", 100);
    expect(r.criteria).toEqual({ task: 3, coherence: 3, lexical: 3, grammar: 3 });
  });

  it("uses 150 / 250 as minimum words", () => {
    expect(MIN_WORDS).toEqual({ task1: 150, task2: 250 });
  });
});

describe("locateCorrections", () => {
  const text = "Nowadays many people thinks that  technology make life easier. However the goverment should act.";

  it("finds exact substrings and their positions, sorted", () => {
    const r = locateCorrections(text, [
      { original: "goverment", fix: "government", rule: "", category: "spelling", pattern: "spelling" },
      { original: "many people thinks", fix: "many people think", rule: "", category: "grammar", pattern: "sv" },
    ]);
    expect(r.map((c) => c.original)).toEqual(["many people thinks", "goverment"]);
    expect(text.slice(r[0].start, r[0].end)).toBe("many people thinks");
    expect(text.slice(r[1].start, r[1].end)).toBe("goverment");
  });

  it("tolerates whitespace and case differences", () => {
    const r = locateCorrections(text, [
      { original: "thinks that technology", fix: "think that technology", rule: "", category: "grammar", pattern: "sv" },
      { original: "HOWEVER THE", fix: "However, the", rule: "", category: "punctuation", pattern: "comma" },
    ]);
    expect(r).toHaveLength(2);
    expect(text.slice(r[0].start, r[0].end)).toBe("thinks that  technology");
    expect(text.slice(r[1].start, r[1].end)).toBe("However the");
  });

  it("drops corrections that are not in the text, are no-ops, or overlap", () => {
    const r = locateCorrections(text, [
      { original: "invented phrase", fix: "x", rule: "", category: "grammar", pattern: "" },
      { original: "life easier", fix: "life easier", rule: "", category: "grammar", pattern: "" },
      { original: "technology make", fix: "technology makes", rule: "", category: "grammar", pattern: "sv" },
      { original: "make life", fix: "makes life", rule: "", category: "grammar", pattern: "sv" },
    ]);
    expect(r.map((c) => c.original)).toEqual(["technology make"]);
  });
});

import { TASK1_BANK, TASK2_BANK } from "@/lib/writing/bank";
import { Task1Prompt, Task2Prompt } from "@/lib/writing/schemas";
import { mockTask1 } from "@/lib/writing/mock";
import { z } from "zod";
import { Task1Visual } from "@/lib/writing/schemas";

describe("prompt bank", () => {
  it("every built-in prompt is valid and ids are unique", () => {
    TASK1_BANK.forEach((p) => expect(Task1Prompt.safeParse(p).success, p.id).toBe(true));
    TASK2_BANK.forEach((p) => expect(Task2Prompt.safeParse(p).success, p.id).toBe(true));
    const ids = [...TASK1_BANK, ...TASK2_BANK].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("covers every Task 1 visual kind", () => {
    const kinds = new Set(TASK1_BANK.map((p) => p.visual.kind));
    expect([...kinds].sort()).toEqual(["bar", "line", "map", "pie", "process", "table"]);
  });
  it("mock generator output matches the AI schema", () => {
    for (const k of ["bar", "line", "pie", "table", "process", "map"] as const) {
      expect(z.object({ prompt: z.string(), visual: Task1Visual }).safeParse(mockTask1(k)).success).toBe(true);
    }
  });
  it("rejects a bar chart whose series length does not match the categories", () => {
    const bad = { ...TASK1_BANK[0].visual, series: [{ name: "x", values: [1, 2] }] };
    expect(Task1Visual.safeParse(bad).success).toBe(false);
  });
});
