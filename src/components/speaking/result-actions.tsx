"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/app/i18n-provider";
import { AiErrorMessage } from "@/components/writing/ai-error";
import { deleteSpeaking, finishSpeaking } from "@/app/(app)/speaking/actions";

export function SpeakingRetry({ id, initialError, initialDetail }: { id: string; initialError?: string; initialDetail?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(initialError);
  const [detail, setDetail] = useState(initialDetail);
  return (
    <div className="flex flex-col gap-3">
      <AiErrorMessage code={error} detail={detail} />
      <Button
        disabled={pending}
        className="self-start"
        onClick={() =>
          start(async () => {
            try {
              const res = await finishSpeaking(id);
              setError(res.error);
              setDetail(res.detail);
              if (res.ok) router.replace(`/speaking/${id}`);
            } catch {
              setError("down");
            }
          })
        }
      >
        <RefreshCw className={pending ? "animate-spin" : ""} />
        {pending ? t("speaking.analysing") : t("writing.scoreNow")}
      </Button>
    </div>
  );
}

export function DeleteSpeaking({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => window.confirm(label + "?") && start(() => deleteSpeaking(id))}>
      <Trash2 /> {label}
    </Button>
  );
}
