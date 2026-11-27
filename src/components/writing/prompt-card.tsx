"use client";

import type { WritingPrompt } from "@/lib/writing/schemas";
import { MIN_WORDS, MINUTES } from "@/lib/writing/scoring";
import { Task1Visual } from "./task1-visual";

// Exam content stays in English, like the real test.
export function PromptCard({ prompt }: { prompt: WritingPrompt }) {
  const n = prompt.task === "task1" ? 1 : 2;
  return (
    <section lang="en" className="flex flex-col gap-3 text-sm leading-relaxed">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Writing Task {n} · about {MINUTES[prompt.task]} minutes
      </p>
      {prompt.task === "task1" ? (
        <>
          <p className="font-medium">{prompt.prompt}</p>
          <p>Summarise the information by selecting and reporting the main features, and make comparisons where relevant.</p>
          <p className="font-medium">Write at least {MIN_WORDS.task1} words.</p>
          <Task1Visual visual={prompt.visual} />
        </>
      ) : (
        <>
          <p>Write about the following topic:</p>
          <blockquote className="rounded-lg border-l-4 border-primary bg-muted/60 px-4 py-3 font-medium">
            {prompt.statement}
            <br />
            {prompt.question}
          </blockquote>
          <p>Give reasons for your answer and include any relevant examples from your own knowledge or experience.</p>
          <p className="font-medium">Write at least {MIN_WORDS.task2} words.</p>
        </>
      )}
    </section>
  );
}
