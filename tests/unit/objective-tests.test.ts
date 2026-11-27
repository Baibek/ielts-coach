import { describe, expect, it } from "vitest";
import { cleanGroups, levenshtein, markGroups, markQuestion, renumber } from "@/lib/tests/scoring";
import { Group, type Group as G } from "@/lib/tests/schema";

const g = (x: unknown): G => Group.parse(x);
const tf = g({ type: "tfng", instructions: "Do the statements agree?", questions: [{ n: 1, text: "s", answer: "NOT GIVEN" }] });
const comp = g({ type: "completion", instructions: "NO MORE THAN TWO WORDS", wordLimit: 2, questions: [{ n: 1, text: "x", answer: ["ice factories", "ice factory"] }] });
const num = g({ type: "completion", instructions: "ONE WORD AND/OR A NUMBER", wordLimit: 1, questions: [{ n: 1, answer: "1987" }] });
const mcq = g({ type: "mcq", instructions: "Choose A-D", questions: [{ n: 1, text: "q", options: [{ key: "A" }, { key: "B" }, { key: "C" }], answer: "B", distractors: ["C"] }] });

describe("markQuestion", () => {
  it("accepts T/F/NG abbreviations and any case", () => {
    expect(markQuestion(tf, tf.questions[0], "ng").correct).toBe(true);
    expect(markQuestion(tf, tf.questions[0], "Not given").correct).toBe(true);
    expect(markQuestion(tf, tf.questions[0], "FALSE").correct).toBe(false);
  });
  it("marks blanks", () => {
    expect(markQuestion(tf, tf.questions[0], "  ").error).toBe("blank");
  });
  it("completion: alternatives accepted, case and final full stop ignored", () => {
    expect(markQuestion(comp, comp.questions[0], "Ice Factory.").correct).toBe(true);
  });
  it("completion: over the word limit is wrong even if it contains the answer", () => {
    const r = markQuestion(comp, comp.questions[0], "the ice factories");
    expect(r.correct).toBe(false);
    expect(r.error).toBe("word_limit");
  });
  it("classifies spelling, plural and number mistakes", () => {
    expect(markQuestion(comp, comp.questions[0], "ice factries").error).toBe("spelling");
    expect(markQuestion(num, num.questions[0], "1978").error).toBe("number");
    const pl = g({ type: "completion", instructions: "ONE WORD", wordLimit: 1, questions: [{ n: 1, answer: "bicycle" }] });
    expect(markQuestion(pl, pl.questions[0], "bicycles").error).toBe("plural");
  });
  it("MCQ: a wrong option that the text mentions is a distractor", () => {
    expect(markQuestion(mcq, mcq.questions[0], "c").error).toBe("distractor");
    expect(markQuestion(mcq, mcq.questions[0], "A").error).toBe("wrong");
    expect(markQuestion(mcq, mcq.questions[0], "b").correct).toBe(true);
  });
});

describe("markGroups", () => {
  it("totals the raw score and error types", () => {
    const r = markGroups([tf, mcq], { 1: "C" });
    expect(r.total).toBe(2);
  });
});

describe("cleanGroups", () => {
  const source = "The first ice factories opened in 1851. Workers cut blocks from frozen lakes.";
  it("drops completion keys that are not in the text and renumbers the rest", () => {
    const groups = [g({
      type: "completion", instructions: "ONE WORD", wordLimit: 2, context: "Ice was made in [[3]] and cut from [[4]] and moved by [[5]].",
      questions: [
        { n: 3, answer: "ice factories", explain: { evidence: "The first ice factories opened in 1851." } },
        { n: 4, answer: "rivers" },
        { n: 5, answer: "frozen lakes", explain: { evidence: "invented quote" } },
      ],
    })];
    const out = cleanGroups(groups, source);
    expect(out[0].questions.map((q) => [q.n, q.answer[0]])).toEqual([[1, "ice factories"], [2, "frozen lakes"]]);
    expect(out[0].context).toBe("Ice was made in [[1]] and cut from … and moved by [[2]].");
    expect(out[0].questions[0].explain.evidence).toContain("1851");
    expect(out[0].questions[1].explain.evidence).toBe(""); // not a real quote
  });
  it("drops choice questions with impossible keys", () => {
    const out = cleanGroups([g({ type: "tfng", instructions: "xxx", questions: [{ n: 1, answer: "MAYBE" }, { n: 2, answer: "TRUE" }] })], source);
    expect(out[0].questions).toHaveLength(1);
    const m = cleanGroups([g({ type: "match", instructions: "xxx", options: [{ key: "A" }, { key: "B" }], questions: [{ n: 1, answer: "D" }] })], source);
    expect(m).toHaveLength(0);
  });
  it("renumber shifts questions and gaps", () => {
    const out = renumber([g({ type: "completion", instructions: "xxx", context: "a [[1]] b [[2]]", questions: [{ n: 1, answer: "a" }, { n: 2, answer: "b" }] })], 13);
    expect(out[0].context).toBe("a [[14]] b [[15]]");
    expect(out[0].questions.map((q) => q.n)).toEqual([14, 15]);
  });
  it("levenshtein", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
});

import { LISTENING_BANK, READING_BANK } from "@/lib/tests/bank";
import { ListeningPart, ReadingPassage } from "@/lib/tests/schema";
import { countQuestions, passageText, scriptText } from "@/lib/tests/scoring";

describe("built-in tests", () => {
  it("every reading key and quote survives validation", () => {
    for (const { passage } of READING_BANK) {
      const p = ReadingPassage.parse(passage);
      const cleaned = cleanGroups(p.groups, passageText(p));
      expect(countQuestions(cleaned)).toBe(countQuestions(p.groups));
      cleaned.flatMap((g) => g.questions).forEach((q) => expect(q.explain.evidence, `Q${q.n}`).not.toBe(""));
    }
  });
  it("every listening key and quote is in the script", () => {
    for (const { part } of LISTENING_BANK) {
      const p = ListeningPart.parse(part);
      const cleaned = cleanGroups(p.groups, scriptText(p));
      expect(countQuestions(cleaned)).toBe(10);
      cleaned.flatMap((g) => g.questions).forEach((q) => expect(q.explain.evidence, `Q${q.n}`).not.toBe(""));
      expect(p.lines.every((l) => p.speakers.some((s) => s.name === l.speaker))).toBe(true);
    }
  });
  it("marks a realistic listening attempt", () => {
    const p = ListeningPart.parse(LISTENING_BANK[0].part);
    const r = markGroups(p.groups, { 1: "Harpor", 2: "14th June", 3: "5", 4: "castle", 5: "child seats", 6: "station", 7: "9:30", 8: "35", 9: "raincoat", 10: "bank transfer" });
    expect(r.raw).toBe(6);
    expect(r.errors).toEqual({ spelling: 1, plural: 1, number: 1, wrong: 1 });
  });
});
