import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";
import { getSession } from "@/lib/data/queries";
import { getDict, makeT, type MessageKey } from "@/lib/i18n";
import { formatBand } from "@/lib/ielts/bands";
import { dateInTz } from "@/lib/dates";
import { findQuote } from "@/lib/writing/scoring";
import { combinedGroups, loadTest, markTests, type LoadedTest } from "@/lib/tests/service";
import type { Answers, Group } from "@/lib/tests/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Text with the evidence for each question highlighted and numbered. */
function Highlighted({ text, quotes }: { text: string; quotes: Array<{ n: number; quote: string; ok: boolean }> }) {
  const marks = quotes
    .map((q) => ({ ...q, pos: findQuote(text, q.quote) }))
    .filter((q) => q.pos)
    .sort((a, b) => a.pos!.start - b.pos!.start)
    .filter((q, i, all) => i === 0 || q.pos!.start >= all[i - 1].pos!.end);
  const out: React.ReactNode[] = [];
  let at = 0;
  for (const m of marks) {
    out.push(text.slice(at, m.pos!.start));
    out.push(
      <mark key={m.n} id={`ev-${m.n}`} className={cn("rounded px-0.5", m.ok ? "bg-success/15" : "bg-danger/15")}>
        <sup className="mr-0.5 font-semibold">{m.n}</sup>
        {text.slice(m.pos!.start, m.pos!.end)}
      </mark>,
    );
    at = m.pos!.end;
  }
  out.push(text.slice(at));
  return <>{out}</>;
}

export async function ObjectiveReview({ skill, id }: { skill: "reading" | "listening"; id: string }) {
  const { supabase, profile } = await getSession();
  const t = makeT(getDict(profile.locale));
  const { data: attempt } = await supabase
    .from("attempts")
    .select("id, type, raw_score, max_score, band, duration_sec, created_at, meta")
    .eq("id", id)
    .eq("skill", skill)
    .maybeSingle();
  if (!attempt) notFound();
  const meta = attempt.meta as { test_ids: string[]; answers: Record<string, string>; estimate?: boolean };
  const tests = (await Promise.all(meta.test_ids.map((x) => loadTest(supabase, x)))).filter(Boolean) as LoadedTest[];
  const answers: Answers = Object.fromEntries(Object.entries(meta.answers ?? {}).map(([k, v]) => [Number(k), v]));
  const result = markTests(tests, answers);
  const groups = combinedGroups(tests);
  const byN = new Map(result.results.map((r) => [r.n, r]));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label={t("common.back")}>
          <Link href={attempt.type === "diagnostic" ? "/diagnostic" : `/${skill}`}><ArrowLeft /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{t(skill === "reading" ? "nav.reading" : "nav.listening")} · {t("obj.review")}</h1>
          <p className="text-xs text-muted-foreground">{dateInTz(attempt.created_at, profile.timezone)}{attempt.duration_sec ? ` · ${Math.round(attempt.duration_sec / 60)} min` : ""}</p>
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-4 sm:pt-5">
          <div className="flex flex-col items-center rounded-xl bg-accent px-6 py-3 text-accent-foreground">
            <span className="text-xs">{t("obj.band")}</span>
            <span className="text-4xl font-semibold tabular-nums" data-testid="obj-band">{formatBand(attempt.band)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{t("obj.score")}</span>
            <span className="text-2xl font-semibold tabular-nums" data-testid="obj-score">{result.raw}/{result.total}</span>
            {meta.estimate && <span className="text-xs text-muted-foreground">{t("obj.estimate", { total: result.total })}</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(result.errors).map(([k, n]) => (
              <Badge key={k} className={k === "wrong" || k === "blank" ? "" : "text-danger"}>{t(`obj.err.${k}` as MessageKey)}: {n}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {tests.map((test, ti) => {
        const gs: Group[] = groups[ti];
        const qs = gs.flatMap((g) => g.questions.map((q) => ({ g, q })));
        const quotes = qs.filter(({ q }) => q.explain.evidence).map(({ q }) => ({ n: q.n, quote: q.explain.evidence, ok: !!byN.get(q.n)?.correct }));
        return (
          <div key={test.id} className="grid gap-4 lg:grid-cols-2">
            <Card className="lg:max-h-[80dvh] lg:overflow-y-auto">
              <CardHeader>
                <CardTitle lang="en">{test.skill === "reading" ? test.passage.title : `${t("obj.partN", { n: test.part.part })}: ${test.part.title}`}</CardTitle>
              </CardHeader>
              <CardContent lang="en" className="text-[15px] leading-7">
                {test.skill === "reading"
                  ? test.passage.paragraphs.map((p) => (
                      <p key={p.label} className="mb-3"><b className="mr-2 text-muted-foreground">{p.label}</b><Highlighted text={p.text} quotes={quotes} /></p>
                    ))
                  : (
                    <>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">{t("obj.script")}</p>
                      {test.part.lines.map((l, i) => (
                        <p key={i} className="mb-1.5"><b className="mr-1.5 text-muted-foreground">{l.speaker}:</b><Highlighted text={l.text} quotes={quotes} /></p>
                      ))}
                    </>
                  )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{t("obj.questions")}</CardTitle></CardHeader>
              <CardContent>
                <ol className="flex flex-col divide-y" data-testid="review-list">
                  {qs.map(({ g, q }) => {
                    const r = byN.get(q.n)!;
                    const optText = (key: string) => (q.options ?? g.options).find((o) => o.key.toUpperCase() === key.toUpperCase())?.text;
                    return (
                      <li key={q.n} className="flex flex-col gap-1 py-3 text-sm">
                        <div className="flex items-start gap-2">
                          <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white", r.correct ? "bg-success" : "bg-danger")}>
                            {r.correct ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                          </span>
                          <span lang="en"><b className="mr-1">{q.n}.</b>{q.text || t(`obj.type.${g.type}` as MessageKey)}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 pl-7 text-xs" lang="en">
                          <span>{t("obj.yourAnswer")}: <b className={r.correct ? "text-success" : "text-danger"}>{r.given || t("obj.blank")}</b></span>
                          {!r.correct && <span>{t("obj.correctAnswer")}: <b>{q.answer.join(" / ")}</b>{optText(q.answer[0]) ? ` (${optText(q.answer[0])})` : ""}</span>}
                          {r.error && r.error !== "wrong" && r.error !== "blank" && <Badge className="text-danger">{t(`obj.err.${r.error}` as MessageKey)}</Badge>}
                        </div>
                        {(q.explain.evidence || q.explain.paraphrase || q.explain.trap) && (
                          <div className="ml-7 flex flex-col gap-0.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs" lang="en">
                            {q.explain.evidence && <span><b>{t("obj.evidence")}:</b> “{q.explain.evidence}”</span>}
                            {q.explain.paraphrase && <span><b>{t("obj.paraphrase")}:</b> {q.explain.paraphrase}</span>}
                            {q.explain.trap && <span><b>{t("obj.trap")}:</b> {q.explain.trap}</span>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
