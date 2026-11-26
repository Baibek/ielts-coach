import Link from "next/link";
import { CalendarClock, Flame, Stethoscope } from "lucide-react";
import { getAttempts, getOnboardedSession, ensurePlan, diagnosticDone } from "@/lib/data/queries";
import { getDict, makeT } from "@/lib/i18n";
import { dateInTz, daysBetween, todayIn } from "@/lib/dates";
import { SKILLS, formatBand, overallBand } from "@/lib/ielts/bands";
import { currentBands } from "@/lib/ielts/skill-bands";
import { computeStreak } from "@/lib/ielts/streak";
import { buildTrend } from "@/lib/ielts/trend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TaskList } from "@/components/dashboard/today-tasks";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const { supabase, profile } = await getOnboardedSession();
  const t = makeT(getDict(profile.locale));
  const attempts = await getAttempts(supabase);
  const plan = await ensurePlan(supabase, profile, attempts);

  const today = todayIn(profile.timezone);
  const daysLeft = daysBetween(today, profile.exam_date);
  const bands = currentBands(attempts);
  const overall = overallBand(SKILLS.map((s) => bands[s]));
  const activity = [
    ...attempts.map((a) => dateInTz(a.created_at, profile.timezone)),
    ...plan.done_keys.map((k) => k.slice(0, 10)),
  ];
  const streak = computeStreak(activity, today);
  const todayPlan = plan.days.find((d) => d.date === today);
  const todayTasks = todayPlan?.tasks ?? [];
  const allDone = todayTasks.length > 0 && todayTasks.every((task) => plan.done_keys.includes(task.key));
  const trend = buildTrend(attempts, profile.timezone);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("dash.hello")}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge className="gap-1.5 bg-accent px-3 py-1 text-sm text-accent-foreground">
            <CalendarClock className="size-4" />
            {daysLeft > 0 ? t("dash.daysLeft", { n: daysLeft }) : daysLeft === 0 ? t("dash.examToday") : t("dash.examPassed")}
          </Badge>
          <Badge className="gap-1.5 px-3 py-1 text-sm">
            <Flame className={cn("size-4", streak > 0 && "text-[#e76624]")} />
            {streak > 0 ? t("dash.streak", { n: streak }) : t("dash.streakZero")}
          </Badge>
        </div>
      </header>

      {!diagnosticDone(attempts) && (
        <Link href="/diagnostic" className="flex items-center gap-3 rounded-xl border border-primary/30 bg-accent p-4 text-sm text-accent-foreground hover:opacity-90">
          <Stethoscope className="size-5 shrink-0" />
          {t("dash.diagnosticCta")}
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>{t("dash.today")}</CardTitle>
              {todayPlan && (
                <CardDescription>
                  {t("dash.week", { n: todayPlan.week })} · {t(`phase.${todayPlan.phase}`)}
                </CardDescription>
              )}
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/plan">{t("dash.openPlan")}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {todayTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dash.todayEmpty")}</p>
            ) : (
              <>
                <TaskList tasks={todayTasks} doneKeys={plan.done_keys} />
                {allDone && <p className="mt-3 text-sm font-medium text-success">{t("dash.allDone")}</p>}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("dash.bands")}</CardTitle>
            <CardDescription>{t("dash.bandsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <div className="col-span-2 flex items-baseline justify-between rounded-lg bg-accent px-4 py-3 text-accent-foreground">
              <span className="text-sm font-medium">{t("skill.overall")}</span>
              <span className="text-3xl font-semibold tabular-nums">{formatBand(overall)}</span>
              <span className="text-xs">{t("dash.target", { band: profile.target_band.toFixed(1) })}</span>
            </div>
            {SKILLS.map((s) => (
              <div key={s} className="flex flex-col gap-0.5 rounded-lg border px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ background: `var(--series-${s})` }} />
                  {t(`skill.${s}`)}
                </span>
                <span className="text-xl font-semibold tabular-nums">{formatBand(bands[s])}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dash.trend")}</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart rows={trend} target={profile.target_band} />
        </CardContent>
      </Card>
    </div>
  );
}
