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
  const [detail, setDetail] = useState<string>();
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={variant}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(undefined);
            try {
              const res = await generateWritingPrompt(task, mode);
              if (res?.error) {
                setError(res.error);
                setDetail(res.detail);
              }
            } catch (e) {
              // redirect() after success is delivered as navigation, not an error
              if (!String(e).includes("NEXT_REDIRECT")) setError("down");
            }
          })
        }
      >
        <Sparkles />
        {pending ? t("writing.generating") : t("writing.generate")}
      </Button>
      <AiErrorMessage code={error} detail={detail} />
    </div>
  );
}
