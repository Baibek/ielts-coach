// SM-2 spaced repetition (SuperMemo 2) with four buttons.
import { addDays } from "@/lib/dates";

export type Grade = "again" | "hard" | "good" | "easy";
export type CardState = { ease: number; interval: number; reps: number };

const QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 };

export function sm2(card: CardState, grade: Grade, today: string): CardState & { due_date: string } {
  const q = QUALITY[grade];
  let { ease, interval, reps } = card;
  if (q < 3) {
    reps = 0;
    interval = 1;
  } else {
    reps += 1;
    if (reps === 1) interval = grade === "easy" ? 3 : 1;
    else if (reps === 2) interval = grade === "hard" ? 3 : 6;
    else interval = Math.round(interval * (grade === "hard" ? 1.2 : ease) * (grade === "easy" ? 1.3 : 1));
  }
  ease = Math.max(1.3, Math.round((ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))) * 100) / 100);
  // A forgotten card stays due today, so it comes back until it is remembered.
  return { ease, interval, reps, due_date: q < 3 ? today : addDays(today, interval) };
}
