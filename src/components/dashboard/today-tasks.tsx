"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/app/i18n-provider";
import { toggleTask } from "@/app/(app)/actions";
import { TASK_HREF } from "@/lib/plan/links";
import type { PlanTask } from "@/lib/plan/engine";

export function TaskList({ tasks, doneKeys }: { tasks: PlanTask[]; doneKeys: string[] }) {
  const { t } = useI18n();
  const [, start] = useTransition();
  const [done, setDone] = useOptimistic(new Set(doneKeys), (state, { key, value }: { key: string; value: boolean }) => {
    const next = new Set(state);
    if (value) next.add(key);
    else next.delete(key);
    return next;
  });

  return (
    <ul className="flex flex-col divide-y">
      {tasks.map((task) => {
        const isDone = done.has(task.key);
        return (
          <li key={task.key} className="flex items-center gap-3 py-2.5">
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  setDone({ key: task.key, value: !isDone });
                  await toggleTask(task.key, !isDone);
                })
              }
              aria-pressed={isDone}
              aria-label={isDone ? t("common.markUndone") : t("common.markDone")}
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-input transition-colors",
                isDone && "border-primary bg-primary text-primary-foreground",
              )}
            >
              {isDone && <Check className="size-4" strokeWidth={3} />}
            </button>
            <Link href={TASK_HREF[task.kind]} className="group flex min-w-0 flex-1 items-center gap-2">
              <span className={cn("min-w-0 flex-1 text-sm", isDone && "text-muted-foreground line-through")}>
                {t(`task.${task.kind}`)}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{t("common.minutes", { n: task.minutes })}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
