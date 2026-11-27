import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, FlaskConical, Info, Shuffle } from "lucide-react";
import { getSession } from "@/lib/data/queries";
import { getDict, makeT } from "@/lib/i18n";
import { formatBand } from "@/lib/ielts/bands";
import { dateInTz } from "@/lib/dates";
import { isMockAi } from "@/lib/ai/server";
import { SPEAKING_CRITERIA } from "@/lib/speaking/core";
import { SPEAKING_COLUMNS, type SpeakingRow } from "@/lib/speaking/service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnnotatedEssay } from "@/components/writing/annotated-essay";
import { DeleteSpeaking, SpeakingRetry } from "@/components/speaking/result-actions";

export const maxDuration = 60;

export default async function SpeakingResultPage({ params, searchParams }: PageProps<"/speaking/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, profile } = await getSession();
  const t = makeT(getDict(profile.locale));
  const { data: row } = await supabase.from("speaking_sessions").select(SPEAKING_COLUMNS).eq("id", id).maybeSingle<SpeakingRow>();
  if (!row) notFound();

  const paths = row.answers.map((a) => a.path).filter(Boolean) as string[];
  const { data: signed } = paths.length ? await supabase.storage.from("recordings").createSignedUrls(paths, 3600) : { data: [] };
  const urlOf = (p?: string | null) => (p ? signed?.find((s) => s.path === p)?.signedUrl ?? null : null);
  const fb = row.feedback;
  const sc = row.scores;
  const partLabel = row.part === 0 ? t("speaking.full") : row.part === 4 ? t("nav.diagnostic") : t("speaking.partN", { n: row.part });
  const partKey = row.part === 0 ? "full" : row.part === 4 ? "diag" : String(row.part);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" aria-label={t("common.back")}>
            <Link href="/speaking"><ArrowLeft /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{t("nav.speaking")} · {partLabel}</h1>
            <p className="text-xs text-muted-foreground">
              {dateInTz(row.created_at, profile.timezone)}
              {row.duration_sec ? ` · ${Math.round(row.duration_sec)} s` : ""}
            </p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link href={`/speaking?part=${partKey}&mode=${row.mode}&after=${row.set_ids.join(",")}`}><Shuffle /> {t("writing.another")}</Link>
        </Button>
      </header>

      {isMockAi() && (
        <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          <FlaskConical className="size-4" /> {t("writing.mockNote")}
        </p>
      )}

      {row.status !== "scored" || !fb || !sc ? (
        <Card>
          <CardHeader><CardTitle>{t("writing.pending")}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{t("speaking.pendingBody")}</p>
            <SpeakingRetry id={row.id} initialError={typeof sp.error === "string" ? sp.error : undefined} initialDetail={typeof sp.detail === "string" ? sp.detail : undefined} />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:pt-5">
              <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-accent px-6 py-4 text-accent-foreground">
                <span className="text-xs font-medium">{t("speaking.overall")}</span>
                <span className="text-5xl font-semibold tabular-nums" data-testid="speaking-band">{formatBand(sc.overall)}</span>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-2">
                {SPEAKING_CRITERIA.map((k) => (
                  <div key={k} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <span className="text-xs leading-tight text-muted-foreground">{t(`speaking.crit.${k}`)}</span>
                    <span className="text-lg font-semibold tabular-nums">{sc.criteria[k]}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" /> {t("speaking.pronNote")}
          </p>
          {sc.penalties.map((p) => (
            <p key={p} role="note" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {t(`speaking.penalty.${p}`)}
            </p>
          ))}

          <Card>
            <CardHeader><CardTitle>{t("writing.summary")}</CardTitle></CardHeader>
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
            {SPEAKING_CRITERIA.map((k) => {
              const c = fb.criteria[k];
              const band = sc.criteria[k];
              return (
                <Card key={k}>
                  <CardHeader className="flex-row items-start justify-between gap-2">
                    <CardTitle className="text-sm">{t(`speaking.crit.${k}`)}</CardTitle>
                    <Badge className="bg-accent text-base font-semibold text-accent-foreground">{band}</Badge>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-sm">
                    <p>{c.comment}</p>
                    {c.next_step && band < 9 && (
                      <p className="rounded-md bg-muted px-2.5 py-1.5 text-xs"><b>{t("writing.nextStep", { n: band + 1 })}:</b> {c.next_step}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {row.answers.map((a, i) => {
        if (!a.path) return null;
        const m = a.metrics;
        const corrections = fb?.corrections.filter((c) => c.answer === i) ?? [];
        const phrases = fb?.better_phrases.filter((b) => b.answer === i) ?? [];
        const model = fb?.model_answers.find((x) => x.answer === i);
        const url = urlOf(a.path);
        return (
          <Card key={i} data-testid="answer-card">
            <CardHeader>
              <span className="text-xs text-muted-foreground">{t("speaking.answerN", { n: i + 1 })} · {t("speaking.partN", { n: a.part })}</span>
              <CardTitle lang="en" className="text-sm">{a.question}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {url && <audio controls src={url} preload="none" className="w-full" />}
              {m && (
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <Badge>{t("speaking.m.duration", { n: m.durationSec })}</Badge>
                  <Badge>{t("writing.words", { n: m.words })}</Badge>
                  <Badge>{t("speaking.m.wpm", { n: m.wpm })}</Badge>
                  <Badge className={m.fillers > 3 ? "text-danger" : ""}>{t("speaking.m.fillers", { n: m.fillers })}</Badge>
                  {m.longPauses != null && <Badge className={m.longPauses > 2 ? "text-danger" : ""}>{t("speaking.m.pauses", { n: m.longPauses })}</Badge>}
                </div>
              )}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">{t("speaking.transcript")}</span>
                {a.transcript ? <AnnotatedEssay text={a.transcript} corrections={corrections} /> : <p className="text-sm text-muted-foreground">{t("speaking.noSpeech")}</p>}
              </div>
              {phrases.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">{t("speaking.betterPhrases")}</span>
                  <ul className="flex flex-col gap-1.5 text-sm" lang="en">
                    {phrases.map((p, k) => (
                      <li key={k} className="rounded-md bg-muted/60 px-3 py-2">
                        <span className="text-muted-foreground">{p.original}</span> → <b>{p.better}</b>
                        {p.why && <span lang={profile.locale} className="block text-xs text-muted-foreground">{p.why}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {model && (
                <details className="rounded-lg border border-primary/30 bg-accent/40">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-accent-foreground">{t("speaking.modelAnswer")}</summary>
                  <p lang="en" className="px-3 pb-3 text-sm leading-relaxed">{model.text}</p>
                </details>
              )}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-end">
        <DeleteSpeaking id={row.id} label={t("common.delete")} />
      </div>
    </div>
  );
}
