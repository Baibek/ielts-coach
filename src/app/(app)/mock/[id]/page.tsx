import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Minus } from "lucide-react";
import { getSession } from "@/lib/data/queries";
import { getDict, makeT } from "@/lib/i18n";
import { dateInTz } from "@/lib/dates";
import { formatBand, SKILLS } from "@/lib/ielts/bands";
import type { MockRow } from "@/lib/mock/service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Delta({ now, before }: { now: number | null; before: number | null | undefined }) {
  if (now == null || before == null) return null;
  const d = now - before;
  const Icon = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : Minus;
  return (
    <span className={`flex items-center text-xs ${d > 0 ? "text-success" : d < 0 ? "text-danger" : "text-muted-foreground"}`}>
      <Icon className="size-3.5" /> {d > 0 ? "+" : ""}{d.toFixed(1)}
    </span>
  );
}

export default async function MockReportPage({ params }: PageProps<"/mock/[id]">) {
  const { id } = await params;
  const { supabase, profile } = await getSession();
  const t = makeT(getDict(profile.locale));
  const { data } = await supabase.from("mock_exams").select("id, status, report, started_at, finished_at").eq("id", id).maybeSingle<MockRow>();
  if (!data?.report) notFound();
  const r = data.report;
  const [{ data: attempts }, { data: subs }, { data: sp }] = await Promise.all([
    supabase.from("attempts").select("id, skill").eq("mock_id", id),
    supabase.from("writing_submissions").select("id, task").eq("mock_id", id),
    supabase.from("speaking_sessions").select("id").eq("mock_id", id),
  ]);
  const links: Record<string, string | undefined> = {
    listening: attempts?.find((a) => a.skill === "listening") && `/listening/attempt/${attempts.find((a) => a.skill === "listening")!.id}`,
    reading: attempts?.find((a) => a.skill === "reading") && `/reading/attempt/${attempts.find((a) => a.skill === "reading")!.id}`,
    writing: subs?.find((s) => s.task === "task2") && `/writing/${subs.find((s) => s.task === "task2")!.id}`,
    speaking: sp?.[0] && `/speaking/${sp[0].id}`,
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label={t("common.back")}><Link href="/mock"><ArrowLeft /></Link></Button>
        <div>
          <h1 className="text-xl font-semibold">{t("mock.report")}</h1>
          <p className="text-xs text-muted-foreground">{dateInTz(data.finished_at ?? data.started_at, profile.timezone)}</p>
        </div>
      </header>

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-5 sm:pt-5">
          <div className="col-span-2 flex flex-col items-center justify-center rounded-xl bg-accent py-4 text-accent-foreground sm:col-span-1">
            <span className="text-xs">{t("skill.overall")}</span>
            <span className="text-4xl font-semibold tabular-nums" data-testid="mock-overall">{formatBand(r.overall)}</span>
            <Delta now={r.overall} before={r.previous?.overall} />
          </div>
          {SKILLS.map((s) => (
            <Link key={s} href={links[s] ?? "#"} className="flex flex-col gap-1 rounded-lg border px-3 py-2 hover:border-primary">
              <span className="text-xs text-muted-foreground">{t(`skill.${s}`)}</span>
              <span className="text-2xl font-semibold tabular-nums">{formatBand(r.bands[s])}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {s === "listening" && r.raw.listening}
                {s === "reading" && r.raw.reading}
                <Delta now={r.bands[s]} before={r.previous?.bands[s]} />
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
      {r.previous && <p className="text-xs text-muted-foreground">↗↘ {t("mock.vsPrev")}</p>}

      <Card>
        <CardHeader><CardTitle>{t("mock.top3")}</CardTitle></CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3" data-testid="mock-top3">
            {r.top3.map((x, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
                <div className="flex flex-col gap-0.5 text-sm">
                  <b>{x.title}</b>
                  <span className="text-muted-foreground">{x.why}</span>
                  <span>→ {x.action}</span>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
