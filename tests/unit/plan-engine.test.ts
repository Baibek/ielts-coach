import { describe, expect, it } from "vitest";
import { buildPlan, type PlanInput } from "@/lib/plan/engine";
import { addDays, daysBetween } from "@/lib/dates";

const base: PlanInput = {
  start: "2026-11-26",
  exam: "2027-01-07", // 42 days later
  bands: { listening: null, reading: null, writing: null, speaking: null },
  target: 7,
  fallbackBand: 5.5,
  diagnosticDone: false,
};

describe("buildPlan", () => {
  const plan = buildPlan(base);

  it("covers every day from start until the day before the exam", () => {
    expect(plan).toHaveLength(42);
    expect(plan[0].date).toBe("2026-11-26");
    expect(plan.at(-1)!.date).toBe("2027-01-06");
    plan.forEach((d, i) => expect(d.date).toBe(addDays(base.start, i)));
  });

  it("splits 6 weeks into foundation → practice → mocks → light taper", () => {
    const count = (p: string) => plan.filter((d) => d.phase === p).length;
    expect(count("foundation")).toBe(12);
    expect(count("practice")).toBe(14);
    expect(count("mock")).toBe(14);
    expect(count("taper")).toBe(2);
    expect(plan.at(-1)!.phase).toBe("taper");
    expect(plan.at(-2)!.phase).toBe("taper");
  });

  it("schedules at least one mock per mock week and two in the final week", () => {
    const mockDays = plan.filter((d) => d.tasks.some((t) => t.kind === "mock_full"));
    expect(mockDays.length).toBe(3);
    const finalWeek = mockDays.filter((d) => {
      const left = daysBetween(d.date, base.exam);
      return left >= 3 && left <= 9;
    });
    expect(finalWeek.length).toBe(2);
    mockDays.forEach((d) => expect(d.phase).toBe("mock"));
  });

  it("keeps the last two days light: no mocks, no full tests", () => {
    for (const d of plan.slice(-2)) {
      expect(d.light).toBe(true);
      expect(d.tasks.map((t) => t.kind)).not.toContain("mock_full");
      expect(d.tasks.some((t) => t.kind.endsWith("_full"))).toBe(false);
    }
  });

  it("gives every day 3–5 tasks with unique keys", () => {
    const keys = new Set<string>();
    for (const d of plan) {
      expect(d.tasks.length).toBeGreaterThanOrEqual(3);
      expect(d.tasks.length).toBeLessThanOrEqual(5);
      for (const t of d.tasks) {
        expect(keys.has(t.key)).toBe(false);
        keys.add(t.key);
        expect(t.key.startsWith(d.date)).toBe(true);
      }
    }
  });

  it("starts with the four-part diagnostic when it has not been done", () => {
    expect(plan[0].tasks.map((t) => t.kind)).toEqual([
      "diag_listening", "diag_reading", "diag_writing", "diag_speaking",
    ]);
    const done = buildPlan({ ...base, diagnosticDone: true });
    expect(done.flatMap((d) => d.tasks).some((t) => t.kind.startsWith("diag_"))).toBe(false);
  });

  it("gives the weakest skill the most practice", () => {
    const p = buildPlan({
      ...base,
      diagnosticDone: true,
      bands: { listening: 7, reading: 7, writing: 5, speaking: 6.5 },
    });
    const n = (s: string) => p.flatMap((d) => d.tasks).filter((t) => t.skill === s).length;
    expect(n("writing")).toBeGreaterThan(n("speaking"));
    expect(n("speaking")).toBeGreaterThan(n("listening"));
  });

  it("phases depend on days left, so a mid-course rebuild does not restart from foundation", () => {
    const p = buildPlan({ ...base, start: addDays(base.exam, -10), diagnosticDone: true });
    expect(p).toHaveLength(10);
    expect(p.some((d) => d.phase === "foundation" || d.phase === "practice")).toBe(false);
  });

  it("returns an empty plan when the exam is today or in the past", () => {
    expect(buildPlan({ ...base, exam: base.start })).toEqual([]);
    expect(buildPlan({ ...base, exam: addDays(base.start, -3) })).toEqual([]);
  });

  it("is deterministic", () => {
    expect(buildPlan(base)).toEqual(plan);
  });
});
