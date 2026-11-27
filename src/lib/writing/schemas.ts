import { z } from "zod";

// ---------- Task 1 visuals ----------
const num = z.coerce.number().finite();

export const BarLineVisual = z
  .object({
    kind: z.enum(["bar", "line"]),
    title: z.string().min(3),
    xLabel: z.string().optional(),
    yLabel: z.string().min(1),
    unit: z.string().default(""),
    categories: z.array(z.string().min(1)).min(3).max(12),
    series: z.array(z.object({ name: z.string().min(1), values: z.array(num) })).min(1).max(4),
  })
  .refine((v) => v.series.every((s) => s.values.length === v.categories.length), {
    message: "each series needs one value per category",
  });

export const PieVisual = z.object({
  kind: z.literal("pie"),
  title: z.string().min(3),
  charts: z
    .array(
      z.object({
        label: z.string().min(1),
        slices: z.array(z.object({ name: z.string().min(1), value: num })).min(3).max(6),
      }),
    )
    .min(1)
    .max(2),
});

export const TableVisual = z
  .object({
    kind: z.literal("table"),
    title: z.string().min(3),
    unit: z.string().default(""),
    columns: z.array(z.string().min(1)).min(2).max(6),
    rows: z.array(z.object({ label: z.string().min(1), values: z.array(z.union([num, z.string()])) })).min(3).max(8),
  })
  .refine((v) => v.rows.every((r) => r.values.length === v.columns.length), {
    message: "each row needs one value per column",
  });

export const ProcessVisual = z.object({
  kind: z.literal("process"),
  title: z.string().min(3),
  cyclic: z.boolean().default(false),
  steps: z.array(z.object({ label: z.string().min(1), detail: z.string().optional() })).min(5).max(12),
});

export const MAP_FEATURES = ["building", "road", "park", "water", "car_park", "field", "trees", "other"] as const;

export const MapVisual = z.object({
  kind: z.literal("map"),
  title: z.string().min(3),
  maps: z
    .array(
      z.object({
        label: z.string().min(1),
        features: z
          .array(
            z.object({
              name: z.string().min(1),
              type: z.enum(MAP_FEATURES),
              x: num.min(0).max(100),
              y: num.min(0).max(70),
              w: num.min(1).max(100),
              h: num.min(1).max(70),
            }),
          )
          .min(3)
          .max(14),
      }),
    )
    .min(1)
    .max(2),
});

export const Task1Visual = z.union([BarLineVisual, PieVisual, TableVisual, ProcessVisual, MapVisual]);
export type Task1Visual = z.infer<typeof Task1Visual>;
export type Task1Kind = "bar" | "line" | "pie" | "table" | "process" | "map";

export const Task1Prompt = z.object({
  task: z.literal("task1"),
  id: z.string(),
  prompt: z.string().min(10), // "The chart below shows ..."
  visual: Task1Visual,
});
export type Task1Prompt = z.infer<typeof Task1Prompt>;

export const ESSAY_TYPES = ["opinion", "discussion", "advantages_disadvantages", "problem_solution", "two_part"] as const;
export type EssayType = (typeof ESSAY_TYPES)[number];

export const Task2Prompt = z.object({
  task: z.literal("task2"),
  id: z.string(),
  essay_type: z.enum(ESSAY_TYPES),
  topic: z.string().min(2),
  statement: z.string().min(20), // the situation / opinion
  question: z.string().min(10),  // what the candidate must do
});
export type Task2Prompt = z.infer<typeof Task2Prompt>;

export type WritingPrompt = Task1Prompt | Task2Prompt;

// ---------- AI examiner output ----------
const Criterion = z.object({
  band: z.coerce.number().min(0).max(9),
  comment: z.string().min(1),
  evidence: z.array(z.string()).max(4).default([]),
  next_step: z.string().default(""),
});

export const CORRECTION_CATEGORIES = [
  "grammar", "vocabulary", "collocation", "spelling", "punctuation", "cohesion", "task", "style",
] as const;

export const WritingScore = z.object({
  on_topic: z.boolean(),
  criteria: z.object({
    task: Criterion,
    coherence: Criterion,
    lexical: Criterion,
    grammar: Criterion,
  }),
  summary: z.string().min(1),
  strengths: z.array(z.string()).max(4).default([]),
  priorities: z.array(z.string()).max(3).default([]),
  corrections: z
    .array(
      z.object({
        original: z.string().min(1),
        fix: z.string(),
        rule: z.string().default(""),
        category: z.enum(CORRECTION_CATEGORIES).catch("grammar"),
        pattern: z.string().default(""),
      }),
    )
    .max(25)
    .default([]),
  rewrites: z
    .array(z.object({ original: z.string().min(1), improved: z.string().min(1), why: z.string().default("") }))
    .max(2)
    .default([]),
});
export type WritingScore = z.infer<typeof WritingScore>;
export type CriterionKey = keyof WritingScore["criteria"];
export const CRITERIA: CriterionKey[] = ["task", "coherence", "lexical", "grammar"];
