"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, CircleAlert, CircleX, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runAiCheck } from "@/app/(app)/actions";
import type { AiCheckResult } from "@/lib/ai/check";
import { useI18n } from "./i18n-provider";

export function AiCheck() {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AiCheckResult | null>(null);
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setFailed(false);
            try {
              setResult(await runAiCheck());
            } catch {
              setFailed(true);
            }
          })
        }
        className="self-start"
      >
        <Activity className={pending ? "animate-pulse" : ""} />
        {pending ? t("settings.aiChecking") : t("settings.aiCheck")}
      </Button>
      {failed && <p className="text-sm text-danger">{t("common.error")}</p>}
      {result && (
        <div className="flex flex-col gap-2 text-sm" data-testid="ai-check">
          {result.mock && <p className="rounded-lg bg-muted px-3 py-2 text-xs">{t("settings.aiMock")}</p>}
          {!result.groqKey && <p className="text-xs text-muted-foreground">Groq: {t("settings.aiNoKey")}</p>}
          {!result.geminiKey && <p className="text-xs text-muted-foreground">Gemini: {t("settings.aiNoKey")}</p>}
          {result.checks.length === 0 && (
            <p className="flex items-center gap-2 text-danger"><CircleX className="size-4" /> {t("ai.config")}</p>
          )}
          {result.checks.map((c, i) => (
            <div key={i} className="rounded-lg border p-3">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {c.ok ? <CheckCircle2 className="size-4 text-success" /> : <CircleX className="size-4 text-danger" />}
                <span className="capitalize">{c.provider}</span>
                <code className="text-xs text-muted-foreground">{c.model}</code>
                {c.ms != null && <span className="text-xs text-muted-foreground">{(c.ms / 1000).toFixed(1)} s</span>}
              </p>
              {c.modelListed === false && (
                <p className="mt-1 flex items-start gap-1.5 text-xs text-danger">
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" /> {t("settings.aiModelMissing")}
                </p>
              )}
              {c.error && <p className="mt-1 break-words font-mono text-xs text-danger">{c.error}</p>}
              {!c.ok && c.available.length > 0 && (
                <details className="mt-1.5 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">{t("settings.aiModels")}</summary>
                  <p className="mt-1 break-words font-mono">{c.available.join(", ")}</p>
                </details>
              )}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            {t("settings.aiStt")}: {result.stt.provider ? `${result.stt.provider} · ${result.stt.model}` : "—"}
            {result.stt.listed === false && <span className="text-danger"> · {t("settings.aiModelMissing")}</span>}
          </p>
        </div>
      )}
    </div>
  );
}
