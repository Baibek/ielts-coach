"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";
import type { Answers, Group, Question } from "@/lib/tests/schema";
import { Task1Visual } from "@/components/writing/task1-visual";

type Props = {
  groups: Group[];
  answers: Answers;
  onChange: (n: number, value: string) => void;
  disabled?: boolean;
};

const CHOICES: Record<string, string[]> = { tfng: ["TRUE", "FALSE", "NOT GIVEN"], ynng: ["YES", "NO", "NOT GIVEN"] };

function range(g: Group) {
  const ns = g.questions.map((q) => q.n);
  return ns.length > 1 ? `Questions ${Math.min(...ns)}–${Math.max(...ns)}` : `Question ${ns[0]}`;
}

function Num({ n }: { n: number }) {
  return <span className="mr-2 inline-flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold">{n}</span>;
}

function Choice({ q, options, value, onChange, disabled }: { q: Question; options: string[]; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Question ${q.n}`}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          disabled={disabled}
          onClick={() => onChange(o)}
          className={cn(
            "rounded-md border px-2.5 py-1 text-xs font-medium",
            value === o ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function GapInput({ n, value, onChange, disabled }: { n: number; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 align-baseline">
      <span className="text-xs font-semibold text-muted-foreground">{n}</span>
      <input
        id={`q-${n}`}
        data-q={n}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label={`Question ${n}`}
        className="h-8 w-36 rounded-md border border-input bg-card px-2 text-base sm:text-sm"
      />
    </span>
  );
}

function ContextWithGaps({ g, answers, onChange, disabled }: { g: Group } & Omit<Props, "groups">) {
  const lines = (g.context ?? "").split("\n");
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm leading-8">
      {lines.map((line, li) => (
        <p key={li}>
          {line.split(/(\[\[\d+\]\])/).map((part, i) => {
            const m = part.match(/^\[\[(\d+)\]\]$/);
            if (!m) return <Fragment key={i}>{part}</Fragment>;
            const n = Number(m[1]);
            return <GapInput key={i} n={n} value={answers[n] ?? ""} onChange={(v) => onChange(n, v)} disabled={disabled} />;
          })}
        </p>
      ))}
    </div>
  );
}

export function QuestionGroups({ groups, answers, onChange, disabled }: Props) {
  return (
    <div className="flex flex-col gap-6" lang="en">
      {groups.map((g, gi) => (
        <section key={gi} className="flex flex-col gap-3" data-group={g.type}>
          <div>
            <h3 className="text-sm font-semibold">{range(g)}</h3>
            <p className="text-sm text-muted-foreground">{g.instructions}</p>
          </div>

          {(g.type === "headings" || g.type === "match") && g.options.length > 0 && (
            <ul className="rounded-lg border bg-muted/30 p-3 text-sm">
              {g.options.map((o) => (
                <li key={o.key}><b className="mr-2">{o.key}</b>{o.text}</li>
              ))}
            </ul>
          )}
          {g.type === "map" && g.map && <Task1Visual visual={g.map} />}
          {g.type === "completion" && g.context && <ContextWithGaps g={g} answers={answers} onChange={onChange} disabled={disabled} />}

          {!(g.type === "completion" && g.context) &&
            g.questions.map((q) => (
              <div key={q.n} id={`q-${q.n}`} data-q={q.n} className="flex flex-col gap-2 scroll-mt-24">
                <p className="flex items-start text-sm"><Num n={q.n} /> <span className="pt-0.5">{q.text}</span></p>
                <div className="pl-8">
                  {CHOICES[g.type] && <Choice q={q} options={CHOICES[g.type]} value={answers[q.n] ?? ""} onChange={(v) => onChange(q.n, v)} disabled={disabled} />}
                  {g.type === "mcq" && (
                    <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={`Question ${q.n}`}>
                      {(q.options ?? []).map((o) => (
                        <label key={o.key} className={cn("flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm", answers[q.n] === o.key ? "border-primary bg-accent" : "bg-card")}>
                          <input type="radio" name={`q${q.n}`} value={o.key} checked={answers[q.n] === o.key} disabled={disabled} onChange={() => onChange(q.n, o.key)} className="mt-1" />
                          <span><b className="mr-1.5">{o.key}</b>{o.text}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {(g.type === "headings" || g.type === "match" || g.type === "map") && (
                    <select
                      value={answers[q.n] ?? ""}
                      disabled={disabled}
                      onChange={(e) => onChange(q.n, e.target.value)}
                      aria-label={`Question ${q.n}`}
                      className="h-9 rounded-md border border-input bg-card px-2 text-base sm:text-sm"
                    >
                      <option value="">—</option>
                      {g.options.map((o) => <option key={o.key} value={o.key}>{o.key}</option>)}
                    </select>
                  )}
                  {g.type === "completion" && (
                    <GapInput n={q.n} value={answers[q.n] ?? ""} onChange={(v) => onChange(q.n, v)} disabled={disabled} />
                  )}
                </div>
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}
