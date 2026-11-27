import Link from "next/link";
import { ArrowLeft, Clock, Shuffle } from "lucide-react";
import { getSession } from "@/lib/data/queries";
import { getDict, makeT } from "@/lib/i18n";
import { formatBand } from "@/lib/ielts/bands";
import { dateInTz } from "@/lib/dates";
import { getPromptById, nextPrompt } from "@/lib/writing/service";
import { MINUTES, type WritingTask } from "@/lib/writing/scoring";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WritingEditor } from "@/components/writing/editor";
import { GenerateButton } from "@/components/writing/generate-button";
import { cn } from "@/lib/utils";

export const maxDuration = 60;

export default async function WritingPage({ searchParams }: PageProps<"/writing">) {
  const sp = await searchParams;
  const task = sp.task === "task1" || sp.task === "task2" ? (sp.task as WritingTask) : null;
  const mode = sp.diag === "1" ? "diagnostic" : sp.mode === "exam" ? "exam" : "practice";
  const pid = typeof sp.pid === "string" ? sp.pid : undefined;
  const after = typeof sp.after === "string" ? sp.after : undefined;
  const mockId = typeof sp.mock === "string" && /^[0-9a-f-]{36}$/.test(sp.mock) ? sp.mock : undefined;
  return task ? <Session task={task} mode={mockId ? "exam" : mode} pid={pid} after={after} mockId={mockId} /> : <Hub />;
}

async function Session({ task, mode, pid, after, mockId }: { task: WritingTask; mode: "practice" | "exam" | "diagnostic"; pid?: string; after?: string; mockId?: string }) {
  const { supabase, profile } = await getSession();
  const t = makeT(getDict(profile.locale));
  const prompt = pid ? await getPromptById(supabase, pid) : await nextPrompt(supabase, task, after);
  const href = (m: string) => `/writing?task=${task}&mode=${m}${prompt ? `&pid=${encodeURIComponent(prompt.id)}` : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" aria-label={t("common.back")}>
            <Link href={mockId ? "/mock" : "/writing"}><ArrowLeft /></Link>
          </Button>
          <h1 className="text-xl font-semibold">{t(task === "task1" ? "writing.task1" : "writing.task2")}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mockId ? <Badge>{t("mock.badge")}</Badge> : mode === "diagnostic" ? <Badge>{t("nav.diagnostic")}</Badge> : <div role="group" className="inline-flex rounded-lg border bg-card p-0.5 text-xs font-medium">
            {(["practice", "exam"] as const).map((m) => (
              <Link key={m} href={href(m)} aria-current={m === mode ? "true" : undefined}
                className={cn("rounded-md px-3 py-1.5 text-muted-foreground", m === mode && "bg-accent text-accent-foreground")}>
                {t(m === "practice" ? "writing.practice" : "writing.exam")}
              </Link>
            ))}
          </div>}
          {prompt && mode !== "diagnostic" && !mockId && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/writing?task=${task}&mode=${mode}&after=${encodeURIComponent(prompt.id)}`}>
                <Shuffle /> {t("writing.newPrompt")}
              </Link>
            </Button>
          )}
        </div>
      </header>

      {prompt ? (
        <WritingEditor key={`${prompt.id}:${mode}`} prompt={prompt} mode={mode} mockId={mockId} />
      ) : (
        <Card>
          <CardHeader>
            <CardDescription>{t("writing.noPrompts")}</CardDescription>
          </CardHeader>
          <CardContent>
            <GenerateButton task={task} mode={mode === "exam" ? "exam" : "practice"} variant="default" />
          </CardContent>
        </Card>
      )}
      {prompt && mode === "practice" && !mockId && (
        <div className="max-w-xs">
          <GenerateButton task={task} mode={mode} />
        </div>
      )}
    </div>
  );
}

type HistoryRow = {
  id: string;
  task: WritingTask;
  mode: "practice" | "exam";
  word_count: number;
  status: "pending" | "scored";
  scores: { overall: number } | null;
  created_at: string;
};

async function Hub() {
  const { supabase, profile } = await getSession();
  const t = makeT(getDict(profile.locale));
  const { data } = await supabase
    .from("writing_submissions")
    .select("id, task, mode, word_count, status, scores, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = (data ?? []) as HistoryRow[];
  const scored = rows.filter((r) => r.scores).slice(0, 5);
  const avg = scored.length ? scored.reduce((a, r) => a + r.scores!.overall, 0) / scored.length : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.writing")}</h1>
        <p className="text-sm text-muted-foreground">{t("writing.subtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(["task2", "task1"] as const).map((task) => (
          <Card key={task}>
            <CardHeader>
              <CardTitle>{t(task === "task1" ? "writing.task1" : "writing.task2")}</CardTitle>
              <CardDescription>{t(task === "task1" ? "writing.task1Desc" : "writing.task2Desc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" className="h-auto flex-col items-start gap-0.5 whitespace-normal py-2 text-left">
                <Link href={`/writing?task=${task}&mode=practice`}>
                  <span>{t("writing.practice")}</span>
                  <span className="text-xs font-normal text-muted-foreground">{t("writing.practiceDesc")}</span>
                </Link>
              </Button>
              <Button asChild className="h-auto flex-col items-start gap-0.5 whitespace-normal py-2 text-left">
                <Link href={`/writing?task=${task}&mode=exam`}>
                  <span>{t("writing.exam")}</span>
                  <span className="text-xs font-normal opacity-80">{t("writing.examDesc", { n: MINUTES[task] })}</span>
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t("writing.history")}</CardTitle>
          {avg !== null && (
            <span className="text-sm text-muted-foreground">
              {t("writing.avg")}: <b className="text-foreground tabular-nums">{avg.toFixed(1)}</b>
            </span>
          )}
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("writing.historyEmpty")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/writing/${r.id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                    <span className="flex w-12 shrink-0 justify-center rounded-lg bg-accent py-1.5 text-base font-semibold tabular-nums text-accent-foreground">
                      {r.scores ? formatBand(r.scores.overall) : "…"}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-medium">
                        {t(r.task === "task1" ? "writing.task1" : "writing.task2")}
                        {r.mode === "exam" && <Clock className="ml-1.5 inline size-3.5 text-muted-foreground" />}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {dateInTz(r.created_at, profile.timezone)} · {t("writing.words", { n: r.word_count })}
                      </span>
                    </span>
                    {r.status === "pending" && <Badge>{t("writing.pending")}</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
