import { describe, expect, it } from "vitest";
import { applySpeakingRules, buildScript, computeMetrics, countFillers, type SpeakingScore } from "@/lib/speaking/core";
import { PART1_BANK, PART2_BANK } from "@/lib/speaking/bank";

const score = (b: number): SpeakingScore => {
  const c = () => ({ band: b, comment: "c", next_step: "" });
  return { criteria: { fluency: c(), lexical: c(), grammar: c(), pronunciation: c() }, summary: "s", strengths: [], priorities: [], corrections: [], better_phrases: [], model_answers: [] };
};
const m = (words: number, durationSec: number) => computeMetrics(Array(words).fill("word").join(" "), durationSec, null);

describe("buildScript", () => {
  it("builds Part 1 from all questions of a set with one intro", () => {
    const s = buildScript(1, PART1_BANK[0], null);
    expect(s).toHaveLength(4);
    expect(s[0].intro).toContain("your home town");
    expect(s.filter((i) => i.intro)).toHaveLength(1);
    expect(s.every((i) => i.part === 1 && i.maxSec === 45)).toBe(true);
  });
  it("Part 2 has a cue card, 60 s preparation and 2 minutes to speak", () => {
    const [item] = buildScript(2, null, PART2_BANK[0]);
    expect(item.cue?.bullets).toHaveLength(3);
    expect(item.prepSec).toBe(60);
    expect(item.maxSec).toBe(120);
  });
  it("full test = Part 1 (4) + Part 2 (1) + Part 3 linked to the cue card", () => {
    const s = buildScript(0, PART1_BANK[1], PART2_BANK[1]);
    expect(s.map((i) => i.part)).toEqual([1, 1, 1, 1, 2, 3, 3, 3, 3]);
    expect(s[5].intro).toContain(PART2_BANK[1].p3Theme);
  });
  it("bank ids are unique and complete", () => {
    const ids = [...PART1_BANK, ...PART2_BANK].map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    PART2_BANK.forEach((s) => expect(s.p3.length).toBeGreaterThanOrEqual(4));
  });
});

describe("computeMetrics", () => {
  it("counts fillers but not normal words", () => {
    expect(countFillers("Um, I think, uh, it's ermm good. You know, hmm.")).toBe(5);
    expect(countFillers("The umbrella is under the hermit's car.")).toBe(0);
  });
  it("computes words per minute, pauses, start delay and clarity from segments", () => {
    const r = computeMetrics("one two three four five six", 30, [
      { start: 2.0, end: 5.0, avg_logprob: -0.1 },
      { start: 5.5, end: 9.0, avg_logprob: -0.3 },
      { start: 12.0, end: 14.0, avg_logprob: -0.2 },
    ]);
    expect(r.words).toBe(6);
    expect(r.wpm).toBe(12);
    expect(r.longPauses).toBe(1);
    expect(r.maxPauseSec).toBe(3);
    expect(r.startDelaySec).toBe(2);
    expect(r.clarity).toBeCloseTo(0.82, 2);
  });
  it("leaves pause data unknown without timestamps", () => {
    const r = computeMetrics("hello there", 5, null);
    expect(r.longPauses).toBeNull();
    expect(r.clarity).toBeNull();
  });
});

describe("applySpeakingRules", () => {
  it("averages criteria and rounds down to a half band", () => {
    const s = score(6);
    s.criteria.lexical.band = 7;
    const r = applySpeakingRules(s, [{ part: 1, metrics: m(40, 20) }, { part: 1, metrics: m(40, 20) }]);
    expect(r.overall).toBe(6); // 6.25 -> 6
  });
  it("caps fluency when the Part 2 long turn is under a minute", () => {
    const r = applySpeakingRules(score(7), [{ part: 2, metrics: m(90, 45) }]);
    expect(r.criteria.fluency).toBe(5);
    expect(r.criteria.lexical).toBe(7);
    expect(r.penalties).toContain("short_long_turn");
  });
  it("caps harder when the long turn is under 30 seconds", () => {
    const r = applySpeakingRules(score(7), [{ part: 2, metrics: m(60, 25) }]);
    expect(r.criteria.fluency).toBe(4);
  });
  it("penalises mostly one-word answers in Parts 1 and 3", () => {
    const r = applySpeakingRules(score(7), [
      { part: 1, metrics: m(3, 4) }, { part: 1, metrics: m(5, 4) }, { part: 1, metrics: m(30, 15) }, { part: 1, metrics: m(4, 3) },
    ]);
    expect(r.criteria.fluency).toBe(5);
    expect(r.penalties).toContain("short_answers");
  });
  it("caps everything at 4 when there is almost no speech", () => {
    const r = applySpeakingRules(score(7), [{ part: 1, metrics: m(10, 10) }, { part: 1, metrics: m(10, 10) }]);
    expect(Object.values(r.criteria)).toEqual([4, 4, 4, 4]);
  });
});
