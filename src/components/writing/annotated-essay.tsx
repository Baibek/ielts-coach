"use client";

import { useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { useI18n } from "@/components/app/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LocatedCorrection } from "@/lib/writing/scoring";

export function AnnotatedEssay({ text, corrections }: { text: string; corrections: LocatedCorrection[] }) {
  const { t } = useI18n();
  const [active, setActive] = useState<number | null>(null);
  const [top, setTop] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  function open(i: number, el?: HTMLElement | null) {
    const target = el ?? boxRef.current?.querySelector<HTMLElement>(`[data-mark="${i}"]`);
    if (target && boxRef.current) {
      const box = boxRef.current.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      setTop(r.bottom - box.top + 6);
      if (!el) target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    setActive(i);
  }

  const parts: React.ReactNode[] = [];
  let pos = 0;
  corrections.forEach((c, i) => {
    if (c.start > pos) parts.push(text.slice(pos, c.start));
    parts.push(
      <button
        key={i}
        type="button"
        data-mark={i}
        onClick={(e) => open(i, e.currentTarget)}
        aria-pressed={active === i}
        className={cn(
          "rounded-sm bg-danger/10 text-left underline decoration-danger decoration-wavy decoration-1 underline-offset-4",
          active === i && "bg-danger/20 outline outline-1 outline-danger",
        )}
      >
        {text.slice(c.start, c.end)}
        <sup className="ml-0.5 text-[10px] font-semibold text-danger no-underline">{i + 1}</sup>
      </button>,
    );
    pos = c.end;
  });
  if (pos < text.length) parts.push(text.slice(pos));

  const current = active !== null ? corrections[active] : null;

  return (
    <div className="flex flex-col gap-3">
      {corrections.length > 0 && <p className="text-xs text-muted-foreground">{t("writing.tapHint")}</p>}
      <div ref={boxRef} className="relative">
        <div lang="en" className="whitespace-pre-wrap rounded-lg border bg-card p-4 text-[15px] leading-8" data-testid="annotated-essay">
          {parts}
        </div>
        {current && (
          <div
            role="dialog"
            className="absolute inset-x-2 z-10 rounded-xl border border-danger/40 bg-card p-4 shadow-lg"
            style={{ top }}
            data-testid="correction-detail"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-danger">#{active! + 1}</span>
              <Badge>{t(`cat.${current.category}`)}</Badge>
              {current.pattern && <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{current.pattern}</span>}
              <button type="button" onClick={() => setActive(null)} aria-label={t("common.cancel")} className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>
            <p lang="en" className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-danger line-through">{current.original}</span>
              <ArrowRight className="size-4 text-muted-foreground" />
              <span className="font-medium text-success">{current.fix}</span>
            </p>
            {current.rule && <p className="mt-1.5 text-sm text-muted-foreground">{current.rule}</p>}
          </div>
        )}
      </div>

      <details className="rounded-lg border bg-card">
        <summary className="cursor-pointer p-3 text-sm font-medium">{t("writing.corrections", { n: corrections.length })}</summary>
        {corrections.length === 0 ? (
          <p className="px-3 pb-3 text-sm text-muted-foreground">{t("writing.noCorrections")}</p>
        ) : (
          <ol className="flex flex-col divide-y px-3 pb-2">
            {corrections.map((c, i) => (
              <li key={i}>
                <button type="button" onClick={() => open(i)} className="flex w-full flex-col gap-0.5 py-2 text-left">
                  <span lang="en" className="text-sm">
                    <span className="mr-1.5 text-xs font-semibold text-danger">{i + 1}.</span>
                    <span className="line-through decoration-danger">{c.original}</span> → <b>{c.fix}</b>
                  </span>
                  {c.rule && <span className="text-xs text-muted-foreground">{c.rule}</span>}
                </button>
              </li>
            ))}
          </ol>
        )}
      </details>
    </div>
  );
}
