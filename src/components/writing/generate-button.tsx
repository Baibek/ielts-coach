"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useI18n } from "@/components/app/i18n-provider";
import { generateWritingPrompt } from "@/app/(app)/writing/actions";
import { AiErrorMessage } from "./ai-error";

export function GenerateButton({ task, mode, variant = "outline" }: { task: "task1" | "task2"; mode: "practice" | "exam"; variant?: ButtonProps["variant"] }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={variant}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(undefined);
            const res = await generateWritingPrompt(task, mode);
            if (res?.error) setError(res.error);
          })
        }
      >
        <Sparkles />
        {pending ? t("writing.generating") : t("writing.generate")}
      </Button>
      <AiErrorMessage code={error} />
    </div>
  );
}
