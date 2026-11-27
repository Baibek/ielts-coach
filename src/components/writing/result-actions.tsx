"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/app/i18n-provider";
import { deleteSubmission, rescoreWriting } from "@/app/(app)/writing/actions";
import { AiErrorMessage } from "./ai-error";

export function RescoreButton({ id, initialError }: { id: string; initialError?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(initialError);
  return (
    <div className="flex flex-col gap-3">
      <AiErrorMessage code={error} />
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await rescoreWriting(id);
            setError(res.error);
            if (!res.error) router.replace(`/writing/${id}`);
          })
        }
      >
        <RefreshCw className={pending ? "animate-spin" : ""} />
        {pending ? t("writing.submitting") : t("writing.scoreNow")}
      </Button>
    </div>
  );
}

export function DeleteButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (window.confirm(label + "?")) start(() => deleteSubmission(id));
      }}
    >
      <Trash2 /> {label}
    </Button>
  );
}
