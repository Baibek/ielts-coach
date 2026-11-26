import { describe, expect, it } from "vitest";
import { addDays, daysBetween, dateInTz } from "@/lib/dates";
import { computeStreak } from "@/lib/ielts/streak";
import { currentBands } from "@/lib/ielts/skill-bands";

describe("dates", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("counts whole days between two dates", () => {
    expect(daysBetween("2026-11-26", "2027-01-07")).toBe(42);
    expect(daysBetween("2026-11-26", "2026-11-26")).toBe(0);
    expect(daysBetween("2026-11-27", "2026-11-26")).toBe(-1);
  });
  it("converts a timestamp to the user's local date (Almaty, UTC+5)", () => {
    expect(dateInTz("2026-11-26T20:30:00Z", "Asia/Almaty")).toBe("2026-11-27");
    expect(dateInTz("2026-11-26T18:59:00Z", "Asia/Almaty")).toBe("2026-11-26");
  });
});

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-11-24", "2026-11-25", "2026-11-26"], "2026-11-26")).toBe(3);
  });
  it("keeps the streak alive if today is not done yet but yesterday was", () => {
    expect(computeStreak(["2026-11-24", "2026-11-25"], "2026-11-26")).toBe(2);
  });
  it("breaks on a gap", () => {
    expect(computeStreak(["2026-11-22", "2026-11-23", "2026-11-25", "2026-11-26"], "2026-11-26")).toBe(2);
    expect(computeStreak(["2026-11-23"], "2026-11-26")).toBe(0);
  });
  it("ignores duplicates and order", () => {
    expect(computeStreak(["2026-11-26", "2026-11-25", "2026-11-26"], "2026-11-26")).toBe(2);
  });
  it("is 0 with no activity", () => {
    expect(computeStreak([], "2026-11-26")).toBe(0);
  });
});

describe("currentBands", () => {
  it("averages the last three bands per skill (newest first input)", () => {
    const res = currentBands([
      { skill: "writing", band: 6.5, created_at: "2026-11-26T10:00:00Z" },
      { skill: "writing", band: 6.0, created_at: "2026-11-25T10:00:00Z" },
      { skill: "writing", band: 6.0, created_at: "2026-11-24T10:00:00Z" },
      { skill: "writing", band: 4.0, created_at: "2026-11-20T10:00:00Z" },
      { skill: "reading", band: 7.0, created_at: "2026-11-26T10:00:00Z" },
      { skill: "reading", band: null, created_at: "2026-11-26T11:00:00Z" },
    ]);
    expect(res.writing).toBe(6.0); // mean 6.17 -> 6.0
    expect(res.reading).toBe(7.0);
    expect(res.listening).toBeNull();
    expect(res.speaking).toBeNull();
  });
});
