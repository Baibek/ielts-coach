import { describe, expect, it } from "vitest";
import { buildTrend } from "@/lib/ielts/trend";

describe("buildTrend", () => {
  it("groups by local day, averages per skill, sorts oldest first", () => {
    const rows = buildTrend(
      [
        { skill: "writing", band: 6, created_at: "2026-11-27T04:00:00Z" },
        { skill: "writing", band: 6.5, created_at: "2026-11-27T10:00:00Z" },
        { skill: "reading", band: 7, created_at: "2026-11-26T20:00:00Z" }, // 01:00 on 27th in Almaty
        { skill: "listening", band: 5.5, created_at: "2026-11-25T10:00:00Z" },
        { skill: "speaking", band: null, created_at: "2026-11-25T10:00:00Z" },
      ],
      "Asia/Almaty",
    );
    expect(rows).toEqual([
      { date: "2026-11-25", listening: 5.5 },
      { date: "2026-11-27", writing: 6.5, reading: 7 }, // 6.25 -> 6.5
    ]);
  });
});
