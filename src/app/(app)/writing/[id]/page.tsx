import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Clock, FlaskConical, RotateCcw, Shuffle } from "lucide-react";
import { getSession } from "@/lib/data/queries";
import { getDict, makeT } from "@/lib/i18n";
import { formatBand } from "@/lib/ielts/bands";
import { dateInTz } from "@/lib/dates";
import { isMockAi } from "@/lib/ai/server";
import { SUBMISSION_COLUMNS, type SubmissionRow } from "@/lib/writing/service";
import { CRITERIA } from "@/lib/writing/schemas";
import { MIN_WORDS } from "@/lib/writing/scoring";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnnotatedEssay } from "@/components/writing/annotated-essay";
import { PromptCard } from "@/components/writing/prompt-card";
import { DeleteButton, RescoreButton } from "@/components/writing/result-actions";

export const maxDuration = 60;

export default async function WritingResultPage({ params, searchParams }: PageProps<"/writing/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, profile } = await getSession();
  const t = makeT(getDict(profile.locale));
  const { data: sub } = await supabase.from("writing_submissions").select(SUBMISSION_COLUMNS).eq("id", id).maybeSingle<SubmissionRow>();
  if (!sub) notFound();

  const taskLabel = t(sub.task === "task1" ? "writing.task1" : "writing.task2");
  const critLabel = (k: (typeof CRITERIA)[number]) =>
    t(k === "task" ? (sub.task === "task1" ? "writing.crit.task1" : "writing.crit.task2") : `writing.crit.${k}`);
  const fb = sub.feedback;
  const sc = sub.scores;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" aria-label={t("common.back")}>
            <Link href="/writing"><ArrowLeft /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{taskLabel}</h1>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {dateInTz(sub.created_at, profile.timezone)} · {t("writing.words", { n: sub.word_count })}
              {sub.duration_sec ? ` · ${t("writing.time", { m: Math.round(sub.duration_sec / 60) })}` : ""}
              {sub.mode === "exam" && <Clock className="size-3.5" />}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/writing?task=${sub.task}&mode=${sub.mode}&pid=${encodeURIComponent(sub.prompt.id)}`}><RotateCcw /> {t("writing.again")}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/writing?task=${sub.task}&mode=${sub.mode}&after=${encodeURIComponent(sub.prompt.id)}`}><Shuffle /> {t("writing.another")}</Link>
          </Button>
        </div>
      </header>

      {isMockAi() && (
        <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          <FlaskConical className="size-4" /> {t("writing.mockNote")}
        </p>
      )}

      {sub.status === "pending" || !fb || !sc ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("writing.pending")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{t("writing.pendingBody")}</p>
            <RescoreButton id={sub.id} initialError={typeof sp.error === "string" ? sp.error : undefined} />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:pt-5">
              <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-accent px-6 py-4 text-accent-foreground">
                <span className="text-xs font-medium">{t("writing.taskBand")}</span>
                <span className="text-5xl font-semibold tabular-nums" data-testid="task-band">{formatBand(sc.overall)}</span>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-2">
                {CRITERIA.map((k) => (
                  <div key={k} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <span className="text-xs leading-tight text-muted-foreground">{critLabel(k)}</span>
                    <span className="text-lg font-semibold tabular-nums">{sc.criteria[k]}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {sc.penalties.map((p) => (
            <p key={p} role="note" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {t(`writing.penalty.${p}`, { words: sc.wordCount, min: MIN_WORDS[sub.task] })}
            </p>
          ))}

          <Card>
            <CardHeader>
              <CardTitle>{t("writing.summary")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <p>{fb.summary}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {fb.priorities.length > 0 && (
                  <div>
                    <h3 className="mb-1.5 font-semibold">{t("writing.priorities")}</h3>
                    <ol className="list-decimal space-y-1 pl-5">{fb.priorities.map((p, i) => <li key={i}>{p}</li>)}</ol>
                  </div>
                )}
                {fb.strengths.length > 0 && (
                  <div>
                    <h3 className="mb-1.5 font-semibold">{t("writing.strengths")}</h3>
                    <ul className="list-disc space-y-1 pl-5">{fb.strengths.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            {CRITERIA.map((k) => {
              const c = fb.criteria[k];
              const band = sc.criteria[k];
              return (
                <Card key={k}>
                  <CardHeader className="flex-row items-start justify-between gap-2">
                    <CardTitle className="text-sm">{critLabel(k)}</CardTitle>
                    <Badge className="bg-accent text-base font-semibold text-accent-foreground">{band}</Badge>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-sm">
                    <p>{c.comment}</p>
                    {c.evidence.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">{t("writing.evidence")}</span>
                        {c.evidence.map((q, i) => (
                          <blockquote key={i} lang="en" className="border-l-2 border-primary/50 pl-2 text-xs italic text-muted-foreground">“{q}”</blockquote>
                        ))}
                      </div>
                    )}
                    {c.next_step && band < 9 && (
                      <p className="rounded-md bg-muted px-2.5 py-1.5 text-xs">
                        <b>{t("writing.nextStep", { n: band + 1 })}:</b> {c.next_step}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("writing.yourText")}</CardTitle>
            </CardHeader>
            <CardContent>
              <AnnotatedEssay text={sub.text} corrections={fb.corrections} />
              {fb.corrections.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("writing.errorLogAdded", { n: fb.corrections.length })}{" "}
                  <Link href="/errors" className="underline">{t("nav.errors")}</Link>
                </p>
              )}
            </CardContent>
          </Card>

          {fb.rewrites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("writing.rewrites")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {fb.rewrites.map((r, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="rounded-lg border p-3">
                        <span className="text-xs font-medium text-muted-foreground">{t("writing.yours")}</span>
                        <p lang="en" className="mt-1 text-sm leading-relaxed">{r.original}</p>
                      </div>
                      <div className="rounded-lg border border-primary/40 bg-accent/50 p-3">
                        <span className="text-xs font-medium text-accent-foreground">{t("writing.band8")}</span>
                        <p lang="en" className="mt-1 text-sm leading-relaxed">{r.improved}</p>
                      </div>
                    </div>
                    {r.why && <p className="text-xs text-muted-foreground">{r.why}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <details className="rounded-xl border bg-card">
        <summary className="cursor-pointer p-4 text-sm font-medium">{t("writing.showTask")}</summary>
        <div className="px-4 pb-4">
          <PromptCard prompt={sub.prompt} />
        </div>
      </details>

      <div className="flex justify-end">
        <DeleteButton id={sub.id} label={t("common.delete")} />
      </div>
    </div>
  );
}
