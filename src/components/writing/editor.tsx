"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/app/i18n-provider";
import { cn } from "@/lib/utils";
import type { WritingPrompt } from "@/lib/writing/schemas";
import { countWords, MIN_WORDS, MINUTES } from "@/lib/writing/scoring";
import { submitWriting } from "@/app/(app)/writing/actions";
import { PromptCard } from "./prompt-card";
import { AiErrorMessage } from "./ai-error";

type Draft = { text: string; startedAt: number };

function readDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function writeDraft(key: string, d: Draft | null) {
  try {
    if (d) localStorage.setItem(key, JSON.stringify(d));
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable: draft simply isn't kept */
  }
}

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function WritingEditor({ prompt, mode, mockId }: { prompt: WritingPrompt; mode: "practice" | "exam" | "diagnostic"; mockId?: string }) {
  const timed = mode !== "practice";
  const { t } = useI18n();
  const router = useRouter();
  const draftKey = `ielts:draft:${prompt.id}:${mode}`;
  const limit = MINUTES[prompt.task] * 60;
  const min = MIN_WORDS[prompt.task];

  const [text, setText] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [detail, setDetail] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const submitted = useRef(false);

  // Restore the draft (and the timer start) after hydration.
  useEffect(() => {
    const d = readDraft(draftKey);
    const started = d?.startedAt ?? Date.now();
    /* eslint-disable react-hooks/set-state-in-effect -- reading browser-only storage after mount */
    if (d) setText(d.text);
    setStartedAt(started);
    setNow(Date.now());
    /* eslint-enable react-hooks/set-state-in-effect */
    if (!d) writeDraft(draftKey, { text: "", startedAt: started });
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [draftKey]);

  const elapsed = startedAt && now ? (now - startedAt) / 1000 : 0;
  const remaining = limit - elapsed;
  const timeUp = timed && startedAt !== null && remaining <= 0;
  const words = countWords(text);

  const submit = useCallback(
    (force: boolean) => {
      if (submitted.current) return;
      if (words < 20) {
        setError("too_short");
        return;
      }
      if (!force && words < min && !window.confirm(t("writing.confirmShort", { n: words, min }))) return;
      submitted.current = true;
      setError(undefined);
      start(async () => {
        let res;
        try {
          res = await submitWriting({ promptId: prompt.id, mode, text, durationSec: Math.round(elapsed), mockId });
        } catch {
          // Network drop or server time-out: the text is still in the draft.
          submitted.current = false;
          setError("down");
          return;
        }
        if (res.id && mockId) {
          writeDraft(draftKey, null);
          router.push("/mock");
        } else if (res.id) {
          writeDraft(draftKey, null);
          const q = res.error ? `?error=${res.error}${res.detail ? `&detail=${encodeURIComponent(res.detail)}` : ""}` : "";
          router.push(`/writing/${res.id}${q}`);
        } else {
          submitted.current = false;
          setError(res.error ?? "generic");
          setDetail(res.detail);
        }
      });
    },
    [words, min, t, prompt.id, mode, text, elapsed, draftKey, router, mockId],
  );

  // Exam mode: like the computer-delivered test, the answer is sent when time runs out.
  useEffect(() => {
    if (timeUp && !submitted.current && words >= 20) submit(true);
  }, [timeUp, words, submit]);

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
      <div className="rounded-xl border bg-card p-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
        <PromptCard prompt={prompt} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
          <span
            className={cn(
              "flex items-center gap-1.5 text-sm font-semibold tabular-nums",
              timed && remaining < 300 && "text-danger",
            )}
            data-testid="timer"
          >
            <Clock className="size-4" />
            {startedAt === null ? "--:--" : timed ? fmt(remaining) : fmt(elapsed)}
          </span>
          <span className={cn("text-sm tabular-nums", words < min ? "text-muted-foreground" : "font-medium text-success")} data-testid="word-count">
            {t("writing.words", { n: words })} · {t("writing.minWords", { n: min })}
          </span>
        </div>

        {timeUp && (
          <p role="status" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{t("writing.timeUp")}</p>
        )}
        <AiErrorMessage code={error} detail={detail} />

        <textarea
          lang="en"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (startedAt) writeDraft(draftKey, { text: e.target.value, startedAt });
          }}
          readOnly={timeUp || pending}
          placeholder={t("writing.placeholder")}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
          data-gramm="false"
          data-enable-grammarly="false"
          aria-label={t("writing.placeholder")}
          className="min-h-[55dvh] w-full resize-y rounded-xl border border-input bg-card p-4 text-base leading-7 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-[65dvh]"
        />
        <p className="text-xs text-muted-foreground">{t("writing.draftSaved")}</p>

        <Button size="lg" onClick={() => submit(false)} disabled={pending || startedAt === null}>
          <Send />
          {pending ? t("writing.submitting") : t("writing.submit")}
        </Button>
        {pending && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full w-1/3 animate-[progress_1.6s_ease-in-out_infinite] rounded-full bg-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
