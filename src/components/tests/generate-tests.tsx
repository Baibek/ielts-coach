"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/app/i18n-provider";
import { AiErrorMessage } from "@/components/writing/ai-error";
import { generateObjective } from "@/app/(app)/objective-actions";

/** Creates the missing passages/parts one by one, then reloads the page. */
export function GenerateTests({ skill, parts, label }: { skill: "reading" | "listening"; parts: number[]; label?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<{ code?: string; detail?: string } | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button
        disabled={pending}
        className="self-start"
        variant={label ? "outline" : "default"}
        onClick={() =>
          start(async () => {
            setError(null);
            for (let i = 0; i < parts.length; i++) {
              setStep(i + 1);
              let res;
              try {
                res = await generateObjective(skill, parts[i]);
              } catch {
                res = { error: "down" as const };
              }
              if (res.error) {
                setError({ code: res.error, detail: "detail" in res ? res.detail : undefined });
                router.refresh();
                return;
              }
            }
            router.refresh();
          })
        }
      >
        <Sparkles />
        {pending ? t("obj.generating", { n: step, total: parts.length }) : label ?? t("obj.generate")}
      </Button>
      {error && <AiErrorMessage code={error.code} detail={error.detail} />}
    </div>
  );
}
