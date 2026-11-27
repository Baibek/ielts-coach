"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bot, Send, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/app/i18n-provider";
import { AiErrorMessage } from "@/components/writing/ai-error";
import { cn } from "@/lib/utils";
import { clearTutor, sendTutorMessage, type ChatMessage } from "@/app/(app)/tutor/actions";

function Rich({ text }: { text: string }) {
  // Minimal formatting: **bold** and line breaks.
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : <span key={i}>{part}</span>,
      )}
    </>
  );
}

export function TutorChat({ initial, prefill }: { initial: ChatMessage[]; prefill?: string }) {
  const { t } = useI18n();
  const [messages, setMessages] = useState(initial);
  const [input, setInput] = useState(prefill ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ code?: string; detail?: string } | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { id: `tmp-${m.length}`, role: "user", content, created_at: new Date().toISOString() }]);
    start(async () => {
      try {
        const r = await sendTutorMessage(content);
        if (r.messages) setMessages(r.messages);
        if (r.error) setError({ code: r.error, detail: r.detail });
      } catch {
        setError({ code: "down" });
      }
    });
  }

  const quick = ["tutor.q1", "tutor.q2", "tutor.q3", "tutor.q4"] as const;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-[40dvh] flex-col gap-3 rounded-xl border bg-card p-4" data-testid="chat">
        {messages.length === 0 && <p className="text-sm text-muted-foreground">{t("tutor.empty")}</p>}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex gap-2", m.role === "user" && "flex-row-reverse")}>
            <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", m.role === "user" ? "bg-muted" : "bg-accent text-accent-foreground")}>
              {m.role === "user" ? <UserRound className="size-4" /> : <Bot className="size-4" />}
            </span>
            <div className={cn("max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")} data-role={m.role}>
              <Rich text={m.content} />
            </div>
          </div>
        ))}
        {pending && <p className="text-xs text-muted-foreground">{t("tutor.thinking")}</p>}
        <div ref={end} />
      </div>
      {error && <AiErrorMessage code={error.code} detail={error.detail} />}
      <div className="flex flex-wrap gap-1.5">
        {quick.map((k) => (
          <button key={k} type="button" onClick={() => send(t(k))} disabled={pending} className="rounded-full border bg-card px-3 py-1 text-xs hover:bg-muted">
            {t(k)}
          </button>
        ))}
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={2}
          placeholder={t("tutor.placeholder")}
          aria-label={t("tutor.placeholder")}
          className="min-h-11 flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2 text-base sm:text-sm"
        />
        <Button type="submit" disabled={pending || !input.trim()} aria-label={t("tutor.send")}><Send /></Button>
      </form>
      {messages.length > 0 && (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => start(async () => { await clearTutor(); setMessages([]); })}>
          <Trash2 /> {t("tutor.clear")}
        </Button>
      )}
    </div>
  );
}
