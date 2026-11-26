import type { TaskKind } from "./engine";

/** Where each plan task opens in the app. */
export const TASK_HREF: Record<TaskKind, string> = {
  diag_listening: "/diagnostic?part=listening",
  diag_reading: "/diagnostic?part=reading",
  diag_writing: "/diagnostic?part=writing",
  diag_speaking: "/diagnostic?part=speaking",
  vocab_review: "/vocab",
  error_review: "/errors",
  writing_task1: "/writing?task=task1",
  writing_task2: "/writing?task=task2",
  writing_task1_timed: "/writing?task=task1&mode=exam",
  writing_task2_timed: "/writing?task=task2&mode=exam",
  speaking_p1: "/speaking?part=1",
  speaking_p2: "/speaking?part=2",
  speaking_p3: "/speaking?part=3",
  speaking_full: "/speaking?part=full",
  reading_passage: "/reading?mode=passage",
  reading_passage_timed: "/reading?mode=passage&timed=1",
  reading_full: "/reading?mode=full",
  listening_part: "/listening?mode=part",
  listening_part_timed: "/listening?mode=part&exam=1",
  listening_full: "/listening?mode=full",
  mock_full: "/mock",
};
