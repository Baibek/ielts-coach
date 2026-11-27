import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/data/queries";
import { getDict, makeT, type MessageKey } from "@/lib/i18n";
import { formatBand } from "@/lib/ielts/bands";
import { dateInTz } from "@/lib/dates";
import { combinedGroups, pickTests, type LoadedTest } from "@/lib/tests/service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ObjectiveTest, type TestView } from "./objective-test";
import { GenerateTests } from "./generate-tests";

type Skill = "reading" | "listening";
type SP = Record<string, string | string[] | undefined>;

export type SessionConfig = {
  mode: "practice" | "timed" | "diagnostic";
  variant: "single" | "full";
  count: number;
  parts?: number[];
  timeLimitSec: number | null;
  title: MessageKey;
};

export function sessionConfig(skill: Skill, sp: SP): SessionConfig | null {
  const diag = sp.diag === "1";
  if (skill === "reading") {
    if (diag) return { mode: "diagnostic", variant: "single", count: 1, timeLimitSec: 20 * 60, title: "nav.diagnostic" };
    if (sp.mode === "full") return { mode: "timed", variant: "full", count: 3, timeLimitSec: 60 * 60, title: "obj.fullReading" };
    if (sp.mode === "passage") {
      const timed = sp.timed === "1";
      return { mode: timed ? "timed" : "practice", variant: "single", count: 1, timeLimitSec: timed ? 20 * 60 : null, title: timed ? "obj.onePassageTimed" : "obj.onePassage" };
    }
    return null;
  }
  if (diag) return { mode: "diagnostic", variant: "single", count: 1, timeLimitSec: null, title: "nav.diagnostic" };
  if (sp.mode === "full") return { mode: "timed", variant: "full", count: 4, parts: [1, 2, 3, 4], timeLimitSec: null, title: "obj.fullListening" };
  if (sp.mode === "part") {
    const exam = sp.exam === "1";
    return { mode: exam ? "timed" : "practice", variant: "single", count: 1, timeLimitSec: null, title: exam ? "obj.onePartExam" : "obj.onePart" };
  }
  return null;
}

function toView(tests: LoadedTest[]): TestView[] {
  const groups = combinedGroups(tests);
  return tests.map((x, i) =>
    x.skill === "reading"
      ? { id: x.id, title: x.passage.title, paragraphs: x.passage.paragraphs, groups: groups[i] }
      : { id: x.id, title: `${x.part.title}. ${x.part.context}`, part: x.part.part, speakers: x.part.speakers, lines: x.part.lines, groups: groups[i] },
  );
}

export async function ObjectiveSession({ skill, config }: { skill: Skill; config: SessionConfig }) {
  const { supabase, profile } = await getSession();
  const t = makeT(getDict(profile.locale));
  const tests = await pickTests(supabase, skill, { count: config.count, parts: config.parts });
  const missingParts =
    skill === "listening" && config.parts
      ? config.parts.filter((p) => !tests.some((x) => x.skill === "listening" && x.part.part === p))
      : Array.from({ length: Math.max(0, config.count - tests.length) }, (_, i) => (skill === "listening" ? ((i % 4) + 1) : 1));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label={t("common.back")}>
          <Link href={config.mode === "diagnostic" ? "/diagnostic" : `/${skill}`}><ArrowLeft /></Link>
        </Button>
        <h1 className="text-xl font-semibold">{t(skill === "reading" ? "nav.reading" : "nav.listening")} · {t(config.title)}</h1>
      </header>
      {missingParts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardDescription>{t("obj.notEnough", { have: tests.length, need: config.count })}</CardDescription>
          </CardHeader>
          <CardContent>
            <GenerateTests skill={skill} parts={missingParts} />
          </CardContent>
        </Card>
      ) : (
        <ObjectiveTest key={tests.map((x) => x.id).join("+")} skill={skill} mode={config.mode} variant={config.variant} tests={toView(tests)} timeLimitSec={config.timeLimitSec} />
      )}
    </div>
  );
}

type AttemptRow = { id: string; type: string; raw_score: number | null; max_score: number | null; band: number | null; created_at: string; meta: { variant?: string; errors?: Record<string, number>; by_type?: Record<string, [number, number]> } };

export async function ObjectiveHub({ skill }: { skill: Skill }) {
  const { supabase, profile } = await getSession();
  const t = makeT(getDict(profile.locale));
  const { data } = await supabase
    .from("attempts")
    .select("id, type, raw_score, max_score, band, created_at, meta")
    .eq("skill", skill)
    .order("created_at", { ascending: false })
    .limit(40);
  const rows = (data ?? []) as AttemptRow[];

  const byType: Record<string, [number, number]> = {};
  const errors: Record<string, number> = {};
  for (const r of rows.slice(0, 15)) {
    for (const [k, [c, n]] of Object.entries(r.meta?.by_type ?? {})) byType[k] = [(byType[k]?.[0] ?? 0) + c, (byType[k]?.[1] ?? 0) + n];
    for (const [k, n] of Object.entries(r.meta?.errors ?? {})) errors[k] = (errors[k] ?? 0) + n;
  }

  const modes =
    skill === "reading"
      ? [
          { href: "/reading?mode=passage", title: "obj.onePassage", desc: "obj.onePassageDesc" },
          { href: "/reading?mode=passage&timed=1", title: "obj.onePassageTimed", desc: "obj.onePassageTimedDesc" },
          { href: "/reading?mode=full", title: "obj.fullReading", desc: "obj.fullReadingDesc" },
        ]
      : [
          { href: "/listening?mode=part", title: "obj.onePart", desc: "obj.onePartDesc" },
          { href: "/listening?mode=part&exam=1", title: "obj.onePartExam", desc: "obj.onePartExamDesc" },
          { href: "/listening?mode=full", title: "obj.fullListening", desc: "obj.fullListeningDesc" },
        ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t(skill === "reading" ? "nav.reading" : "nav.listening")}</h1>
        <p className="text-sm text-muted-foreground">{t(skill === "reading" ? "obj.subtitleReading" : "obj.subtitleListening")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {modes.map((m) => (
          <Link key={m.href} href={m.href} className="flex flex-col gap-1 rounded-xl border bg-card p-4 hover:border-primary">
            <span className="font-medium">{t(m.title as MessageKey)}</span>
            <span className="text-xs text-muted-foreground">{t(m.desc as MessageKey)}</span>
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <GenerateTests skill={skill} parts={skill === "reading" ? [1] : [((rows.length % 4) + 1)]} label={t("obj.newTest")} />
      </div>

      {(Object.keys(byType).length > 0 || Object.keys(errors).length > 0) && (
        <Card>
          <CardHeader><CardTitle>{t(skill === "reading" ? "obj.byType" : "obj.errorTypes")}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {skill === "reading"
              ? Object.entries(byType).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]).map(([k, [c, n]]) => (
                  <div key={k} className="flex items-center gap-3 text-sm">
                    <span className="w-48 shrink-0 text-xs">{t(`obj.type.${k}` as MessageKey)}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((c / n) * 100)}%` }} />
                    </div>
                    <span className="w-14 text-right text-xs tabular-nums">{c}/{n}</span>
                  </div>
                ))
              : Object.entries(errors).filter(([k]) => k !== "wrong").sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                  <Badge key={k} className="mr-1 self-start">{t(`obj.err.${k}` as MessageKey)}: {n}</Badge>
                ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t("obj.history")}</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("obj.historyEmpty")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/${skill}/attempt/${r.id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                    <span className="flex w-12 shrink-0 justify-center rounded-lg bg-accent py-1.5 font-semibold tabular-nums text-accent-foreground">{formatBand(r.band)}</span>
                    <span className="flex flex-1 flex-col">
                      <span className="text-sm font-medium tabular-nums">{r.raw_score}/{r.max_score}</span>
                      <span className="text-xs text-muted-foreground">{dateInTz(r.created_at, profile.timezone)}</span>
                    </span>
                    {r.type !== "practice" && <Badge>{r.type === "diagnostic" ? t("nav.diagnostic") : r.meta?.variant === "full" ? t(skill === "reading" ? "obj.fullReading" : "obj.fullListening") : t("writing.exam")}</Badge>}
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
