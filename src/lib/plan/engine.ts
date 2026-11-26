// Rule-based 6-week study plan. No AI tokens are spent here: the plan is a
// pure function of the dates and the current band per skill, so rebuilding it
// every week (or on demand) is free and predictable.

import { addDays, daysBetween, weekday } from "@/lib/dates";
import { SKILLS, type Skill } from "@/lib/ielts/bands";
import type { SkillBands } from "@/lib/ielts/skill-bands";

export type TaskKind =
  | "diag_listening" | "diag_reading" | "diag_writing" | "diag_speaking"
  | "vocab_review" | "error_review"
  | "writing_task1" | "writing_task2" | "writing_task1_timed" | "writing_task2_timed"
  | "speaking_p1" | "speaking_p2" | "speaking_p3" | "speaking_full"
  | "reading_passage" | "reading_passage_timed" | "reading_full"
  | "listening_part" | "listening_part_timed" | "listening_full"
  | "mock_full";

export type Phase = "foundation" | "practice" | "mock" | "taper";
export type PlanTask = { key: string; kind: TaskKind; skill: Skill | null; minutes: number };
export type PlanDay = { date: string; week: number; phase: Phase; light: boolean; tasks: PlanTask[] };

export type PlanInput = {
  start: string;          // first plan day (usually today)
  exam: string;           // exam date (not included in the plan)
  bands: SkillBands;      // current estimate per skill (null = unknown)
  target: number;         // target band, e.g. 7
  fallbackBand: number;   // used for unknown skills (self-reported level)
  diagnosticDone: boolean;
};

export const TASK_MINUTES: Record<TaskKind, number> = {
  diag_listening: 15, diag_reading: 20, diag_writing: 40, diag_speaking: 10,
  vocab_review: 10, error_review: 15,
  writing_task1: 25, writing_task2: 45, writing_task1_timed: 20, writing_task2_timed: 40,
  speaking_p1: 10, speaking_p2: 10, speaking_p3: 10, speaking_full: 15,
  reading_passage: 25, reading_passage_timed: 20, reading_full: 60,
  listening_part: 15, listening_part_timed: 10, listening_full: 30,
  mock_full: 170,
};

const SKILL_OF: Partial<Record<TaskKind, Skill>> = {
  diag_listening: "listening", diag_reading: "reading", diag_writing: "writing", diag_speaking: "speaking",
  writing_task1: "writing", writing_task2: "writing", writing_task1_timed: "writing", writing_task2_timed: "writing",
  speaking_p1: "speaking", speaking_p2: "speaking", speaking_p3: "speaking", speaking_full: "speaking",
  reading_passage: "reading", reading_passage_timed: "reading", reading_full: "reading",
  listening_part: "listening", listening_part_timed: "listening", listening_full: "listening",
};

// Rotation of task kinds per skill: skills & strategies first, then timed work.
const ROTATION: Record<"foundation" | "timed", Record<Skill, TaskKind[]>> = {
  foundation: {
    writing: ["writing_task2", "writing_task1", "writing_task2"],
    speaking: ["speaking_p1", "speaking_p2", "speaking_p3"],
    reading: ["reading_passage"],
    listening: ["listening_part"],
  },
  timed: {
    writing: ["writing_task2_timed", "writing_task1_timed", "writing_task2_timed"],
    speaking: ["speaking_p2", "speaking_p3", "speaking_full"],
    reading: ["reading_passage_timed", "reading_passage_timed", "reading_full"],
    listening: ["listening_part_timed", "listening_part_timed", "listening_full"],
  },
};

/** Phase is decided by days left until the exam, not days since start. */
export function phaseFor(daysLeft: number): Phase {
  if (daysLeft <= 2) return "taper";
  if (daysLeft <= 16) return "mock";
  if (daysLeft <= 30) return "practice";
  return "foundation";
}

// Mock days (counted in days left): one in the first mock week, two in the last.
const MOCK_DAYS_LEFT = new Set([13, 8, 4]);

function skillWeights(input: PlanInput): Record<Skill, number> {
  const w = {} as Record<Skill, number>;
  for (const s of SKILLS) {
    const band = input.bands[s] ?? input.fallbackBand;
    const gap = Math.max(0, input.target - band);
    w[s] = (1 + 2 * gap) * (s === "writing" ? 1.3 : 1); // Writing is top priority
  }
  return w;
}

export function buildPlan(input: PlanInput): PlanDay[] {
  const total = daysBetween(input.start, input.exam);
  if (total <= 0) return [];

  const weights = skillWeights(input);
  const weightSum = SKILLS.reduce((a, s) => a + weights[s], 0);
  const credit = Object.fromEntries(SKILLS.map((s) => [s, 0])) as Record<Skill, number>;
  const rotationIdx = Object.fromEntries(SKILLS.map((s) => [s, 0])) as Record<Skill, number>;

  // Smooth weighted round-robin: deterministic and proportional to weights.
  // A weak skill may get two different tasks on the same day.
  function pickTasks(n: number, phase: Phase, taken: TaskKind[]): TaskKind[] {
    const out: TaskKind[] = [];
    for (let i = 0; i < n; i++) {
      for (const s of SKILLS) credit[s] += weights[s];
      const order = [...SKILLS].sort(
        (a, b) => credit[b] - credit[a] || SKILLS.indexOf(a) - SKILLS.indexOf(b),
      );
      for (const skill of order) {
        const list = ROTATION[phase === "foundation" ? "foundation" : "timed"][skill];
        const offset = [0, 1, 2].find(
          (k) => k < list.length && ![...taken, ...out].includes(list[(rotationIdx[skill] + k) % list.length]),
        );
        if (offset === undefined) continue;
        out.push(list[(rotationIdx[skill] + offset) % list.length]);
        rotationIdx[skill] += offset + 1;
        credit[skill] -= weightSum;
        break;
      }
    }
    return out;
  }

  const days: PlanDay[] = [];
  for (let i = 0; i < total; i++) {
    const date = addDays(input.start, i);
    const daysLeft = total - i;
    const phase = phaseFor(daysLeft);
    let kinds: TaskKind[];
    let light = false;

    if (i === 0 && !input.diagnosticDone) {
      kinds = ["diag_listening", "diag_reading", "diag_writing", "diag_speaking"];
    } else if (phase === "taper") {
      light = true;
      kinds = ["vocab_review", "error_review", "speaking_p1"];
    } else if (phase === "mock" && MOCK_DAYS_LEFT.has(daysLeft)) {
      kinds = ["mock_full", "vocab_review", "error_review"];
    } else if (phase === "mock" && MOCK_DAYS_LEFT.has(daysLeft + 1)) {
      // Day after a mock: review its mistakes, one focused task on the weakest area.
      kinds = ["error_review", "vocab_review"];
      kinds.push(...pickTasks(1, phase, kinds));
    } else if (weekday(date) === 6) {
      // Sunday: lighter day
      light = true;
      kinds = ["vocab_review", "error_review", "speaking_p1"];
    } else {
      kinds = ["vocab_review"];
      kinds.push(...pickTasks(3, phase, kinds));
    }

    days.push({
      date,
      week: Math.floor(i / 7) + 1,
      phase,
      light,
      tasks: kinds.map((kind) => ({
        key: `${date}:${kind}`,
        kind,
        skill: SKILL_OF[kind] ?? null,
        minutes: TASK_MINUTES[kind],
      })),
    });
  }
  return days;
}
