import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { getSession } from "@/lib/data/queries";
import { getDict, makeT } from "@/lib/i18n";
import { dateInTz } from "@/lib/dates";
import { formatBand } from "@/lib/ielts/bands";
import { mockProgress, MOCK_STEPS, STEP_HREF, type MockRow } from "@/lib/mock/service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AbandonMockButton, AutoFinish, StartMockButton } from "@/components/mock/controls";

export const maxDuration = 60;

export default async function MockPage() {
  const { supabase, profile } = await getSession();
  const t = makeT(getDict(profile.locale));
  const { data } = await supabase.from("mock_exams").select("id, status, report, started_at, finished_at").neq("status", "abandoned").order("started_at", { ascending: false }).limit(30);
  const mocks = (data ?? []) as MockRow[];
  const active = mocks.find((m) => m.status === "in_progress");
  const finished = mocks.filter((m) => m.status === "finished");
  const progress = active ? await mockProgress(supabase, active.id) : null;
  const next = progress ? MOCK_STEPS.find((s) => !progress.done[s]) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.mock")}</h1>
        <p className="text-sm text-muted-foreground">{t("mock.subtitle")}</p>
      </div>

      {active && progress ? (
        <Card data-testid="mock-active">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("mock.inProgress")}</CardTitle>
            <AbandonMockButton id={active.id} />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <ol className="flex flex-col gap-2">
              {MOCK_STEPS.map((s) => (
                <li key={s} className="flex items-center gap-3 rounded-lg border px-3 py-2.5" data-step={s} data-done={progress.done[s] ? "1" : "0"}>
                  {progress.done[s] ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5 text-muted-foreground" />}
                  <span className="flex-1 text-sm">{t(`mock.step.${s}`)}</span>
                  {!progress.done[s] && s === next && (
                    <Button asChild size="sm"><Link href={STEP_HREF[s](active.id)}>{t("mock.go")}</Link></Button>
                  )}
                </li>
              ))}
            </ol>
            {!next && <AutoFinish id={active.id} />}
          </CardContent>
        </Card>
      ) : (
        <StartMockButton />
      )}

      <Card>
        <CardHeader><CardTitle>{t("mock.history")}</CardTitle></CardHeader>
        <CardContent>
          {finished.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("mock.none")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {finished.map((m) => (
                <li key={m.id}>
                  <Link href={`/mock/${m.id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                    <span className="flex w-12 justify-center rounded-lg bg-accent py-1.5 font-semibold tabular-nums text-accent-foreground">{formatBand(m.report?.overall)}</span>
                    <span className="flex-1 text-sm">{dateInTz(m.finished_at ?? m.started_at, profile.timezone)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      L {formatBand(m.report?.bands.listening)} · R {formatBand(m.report?.bands.reading)} · W {formatBand(m.report?.bands.writing)} · S {formatBand(m.report?.bands.speaking)}
                    </span>
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
