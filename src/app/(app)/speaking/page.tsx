import Link from "next/link";
import { ArrowLeft, Clock, Shuffle } from "lucide-react";
import { getSession } from "@/lib/data/queries";
import { getDict, makeT } from "@/lib/i18n";
import { formatBand } from "@/lib/ielts/bands";
import { dateInTz } from "@/lib/dates";
import { buildScript, type SpeakingPart } from "@/lib/speaking/core";
import { newSessionId, pickSets } from "@/lib/speaking/service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SpeakingSession } from "@/components/speaking/session";
import { cn } from "@/lib/utils";

export const maxDuration = 60;

const PARTS: Record<string, SpeakingPart> = { "1": 1, "2": 2, "3": 3, full: 0 };

export default async function SpeakingPage({ searchParams }: PageProps<"/speaking">) {
  const sp = await searchParams;
  const part = typeof sp.part === "string" ? PARTS[sp.part] : undefined;
  const mode = sp.mode === "exam" ? "exam" : "practice";
  const after = typeof sp.after === "string" ? sp.after.split(",") : undefined;
  return part === undefined ? <Hub /> : <Session part={part} mode={mode} after={after} />;
}

const partKey = (p: SpeakingPart) => (p === 0 ? "full" : String(p));
const partLabel = (p: SpeakingPart) => (p === 0 ? "speaking.full" : (`speaking.part${p}` as const));

async function Session({ part, mode, after }: { part: SpeakingPart; mode: "practice" | "exam"; after?: string[] }) {
  const { supabase, profile, user } = await getSession();
  const t = makeT(getDict(profile.locale));
  const { p1, p2 } = await pickSets(supabase, part, after);
  const script = buildScript(part, p1, p2);
  const setIds = [p1?.id, p2?.id].filter(Boolean) as string[];
  const href = (m: string) => `/speaking?part=${partKey(part)}&mode=${m}`;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" aria-label={t("common.back")}>
            <Link href="/speaking"><ArrowLeft /></Link>
          </Button>
          <h1 className="text-xl font-semibold">{t(partLabel(part))}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" className="inline-flex rounded-lg border bg-card p-0.5 text-xs font-medium">
            {(["practice", "exam"] as const).map((m) => (
              <Link key={m} href={href(m)} aria-current={m === mode ? "true" : undefined}
                className={cn("rounded-md px-3 py-1.5 text-muted-foreground", m === mode && "bg-accent text-accent-foreground")}>
                {t(m === "practice" ? "writing.practice" : "writing.exam")}
              </Link>
            ))}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/speaking?part=${partKey(part)}&mode=${mode}&after=${setIds.join(",")}`}><Shuffle /> {t("speaking.newSet")}</Link>
          </Button>
        </div>
      </header>
      <SpeakingSession key={`${setIds.join(",")}:${mode}`} sessionId={newSessionId()} userId={user.id} part={part} mode={mode} setIds={setIds} script={script} />
    </div>
  );
}

type HistoryRow = {
  id: string;
  part: SpeakingPart;
  mode: "practice" | "exam";
  status: "pending" | "scored";
  scores: { overall: number } | null;
  answers: Array<{ part: number; path?: string | null }>;
  duration_sec: number | null;
  created_at: string;
};

async function Hub() {
  const { supabase, profile } = await getSession();
  const t = makeT(getDict(profile.locale));
  const { data } = await supabase
    .from("speaking_sessions")
    .select("id, part, mode, status, scores, answers, duration_sec, created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  const rows = ((data ?? []) as HistoryRow[]).filter((r) => r.status === "scored" || r.answers.some((a) => a.path));

  // Progress: first vs latest scored Part 2 recording
  const withP2 = rows.filter((r) => r.status === "scored" && r.answers.some((a) => a.part === 2 && a.path));
  let compare: { first: { url: string; date: string; band: number }; latest: { url: string; date: string; band: number } } | null = null;
  if (withP2.length >= 2) {
    const latest = withP2[0];
    const first = withP2[withP2.length - 1];
    const paths = [first, latest].map((r) => r.answers.find((a) => a.part === 2)!.path!);
    const { data: signed } = await supabase.storage.from("recordings").createSignedUrls(paths, 3600);
    if (signed?.every((s) => s.signedUrl)) {
      compare = {
        first: { url: signed[0].signedUrl!, date: dateInTz(first.created_at, profile.timezone), band: first.scores!.overall },
        latest: { url: signed[1].signedUrl!, date: dateInTz(latest.created_at, profile.timezone), band: latest.scores!.overall },
      };
    }
  }

  const cards: Array<{ p: SpeakingPart; desc: string }> = [
    { p: 1, desc: "speaking.part1Desc" }, { p: 2, desc: "speaking.part2Desc" }, { p: 3, desc: "speaking.part3Desc" }, { p: 0, desc: "speaking.fullDesc" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.speaking")}</h1>
        <p className="text-sm text-muted-foreground">{t("speaking.subtitle")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(({ p, desc }) => (
          <Card key={p}>
            <CardHeader>
              <CardTitle>{t(partLabel(p))}</CardTitle>
              <CardDescription>{t(desc as "speaking.part1Desc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" className="h-auto flex-col items-start gap-0.5 whitespace-normal py-2 text-left">
                <Link href={`/speaking?part=${partKey(p)}&mode=practice`}>
                  <span>{t("writing.practice")}</span>
                  <span className="text-xs font-normal text-muted-foreground">{t("speaking.practiceDesc")}</span>
                </Link>
              </Button>
              <Button asChild className="h-auto flex-col items-start gap-0.5 whitespace-normal py-2 text-left">
                <Link href={`/speaking?part=${partKey(p)}&mode=exam`}>
                  <span>{t("writing.exam")}</span>
                  <span className="text-xs font-normal opacity-80">{t("speaking.examDesc")}</span>
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {compare && (
        <Card>
          <CardHeader><CardTitle>{t("speaking.compare")}</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {(["first", "latest"] as const).map((k) => (
              <div key={k} className="flex flex-col gap-1.5 rounded-lg border p-3">
                <span className="flex items-center justify-between text-xs text-muted-foreground">
                  {t(k === "first" ? "speaking.first" : "speaking.latest")} · {compare[k].date}
                  <b className="text-base text-foreground">{formatBand(compare[k].band)}</b>
                </span>
                <audio controls src={compare[k].url} className="w-full" preload="none" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t("speaking.history")}</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("speaking.historyEmpty")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/speaking/${r.id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                    <span className="flex w-12 shrink-0 justify-center rounded-lg bg-accent py-1.5 text-base font-semibold tabular-nums text-accent-foreground">
                      {r.scores ? formatBand(r.scores.overall) : "…"}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-medium">
                        {t(partLabel(r.part))}
                        {r.mode === "exam" && <Clock className="ml-1.5 inline size-3.5 text-muted-foreground" />}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {dateInTz(r.created_at, profile.timezone)}
                        {r.duration_sec ? ` · ${Math.round(r.duration_sec / 60)} min` : ""}
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
