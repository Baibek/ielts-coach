import { describe, expect, it } from "vitest";
import { sm2 } from "@/lib/ielts/sm2";

const fresh = { ease: 2.5, interval: 0, reps: 0 };
const today = "2026-11-28";

describe("sm2", () => {
  it("first good review: tomorrow, then 6 days, then interval × ease", () => {
    const a = sm2(fresh, "good", today);
    expect([a.interval, a.reps, a.due_date]).toEqual([1, 1, "2026-11-29"]);
    const b = sm2(a, "good", "2026-11-29");
    expect([b.interval, b.due_date]).toEqual([6, "2026-12-05"]);
    const c = sm2(b, "good", "2026-12-05");
    expect(c.interval).toBe(15); // 6 × 2.5
  });
  it("'again' resets repetitions and lowers ease (not below 1.3)", () => {
    const r = sm2({ ease: 2.5, interval: 15, reps: 3 }, "again", today);
    expect([r.reps, r.interval, r.due_date]).toEqual([0, 1, today]);
    expect(r.ease).toBeCloseTo(1.96, 2);
    let low = { ease: 1.3, interval: 1, reps: 0 };
    low = sm2(low, "again", today);
    expect(low.ease).toBe(1.3);
  });
  it("'easy' grows faster and raises ease; 'hard' grows slower", () => {
    const easy = sm2({ ease: 2.5, interval: 6, reps: 2 }, "easy", today);
    const hard = sm2({ ease: 2.5, interval: 6, reps: 2 }, "hard", today);
    expect(easy.interval).toBeGreaterThan(15);
    expect(easy.ease).toBeCloseTo(2.6, 2);
    expect(hard.interval).toBe(7);
    expect(hard.ease).toBeCloseTo(2.36, 2);
  });
});
