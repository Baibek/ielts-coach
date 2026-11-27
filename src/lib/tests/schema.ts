// Shared model for objective tests (Reading and Listening).
import { z } from "zod";
import { MapVisual } from "@/lib/writing/schemas";

export const GROUP_TYPES = ["tfng", "ynng", "mcq", "headings", "match", "completion", "map"] as const;
export type GroupType = (typeof GROUP_TYPES)[number];

const Option = z.object({ key: z.string().min(1).max(6), text: z.string().default("") });

export const Question = z.object({
  n: z.coerce.number().int().min(1),
  text: z.string().default(""),
  options: z.array(Option).optional(),                  // MCQ options for this question
  answer: z.union([z.string(), z.array(z.string())]).transform((a) => (Array.isArray(a) ? a : [a]).map((x) => x.trim()).filter(Boolean)),
  distractors: z.array(z.string()).default([]),         // tempting wrong options mentioned in the text
  explain: z
    .object({ evidence: z.string().default(""), paraphrase: z.string().default(""), trap: z.string().default("") })
    .default({ evidence: "", paraphrase: "", trap: "" }),
});
export type Question = z.infer<typeof Question>;

export const Group = z.object({
  type: z.enum(GROUP_TYPES),
  instructions: z.string().min(3),
  options: z.array(Option).default([]),                 // headings list, matching options, map letters
  wordLimit: z.coerce.number().int().min(1).max(4).optional(),
  context: z.string().optional(),                       // summary / notes / form with [[n]] gaps
  map: MapVisual.optional(),
  questions: z.array(Question).min(1),
});
export type Group = z.infer<typeof Group>;

export const ReadingPassage = z.object({
  title: z.string().min(3),
  paragraphs: z.array(z.object({ label: z.string().min(1).max(2), text: z.string().min(40) })).min(3).max(9),
  groups: z.array(Group).min(1).max(5),
});
export type ReadingPassage = z.infer<typeof ReadingPassage>;

export const ListeningPart = z.object({
  part: z.coerce.number().int().min(1).max(4),
  title: z.string().min(3),
  context: z.string().default(""),
  speakers: z.array(z.object({ name: z.string().min(1), gender: z.enum(["male", "female"]), accent: z.enum(["GB", "US", "AU"]).catch("GB") })).min(1).max(4),
  lines: z.array(z.object({ speaker: z.string().min(1), text: z.string().min(1) })).min(4),
  groups: z.array(Group).min(1).max(4),
});
export type ListeningPart = z.infer<typeof ListeningPart>;

/** Answers the student gave, keyed by question number within the test. */
export type Answers = Record<number, string>;
