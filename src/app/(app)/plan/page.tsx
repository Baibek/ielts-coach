import { RefreshCw } from "lucide-react";
import { getAttempts, getOnboardedSession, ensurePlan } from "@/lib/data/queries";
import { getDict, makeT } from "@/lib/i18n";
import { todayIn } from "@/lib/dates";
import { SKILLS, formatBand } from "@/lib/ielts/bands";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TaskList } from "@/components/dashboard/today-tasks";
import { rebuildPlanAction } from "../actions";
import { cn } from "@/lib/utils";
import type { PlanDay } from "@/lib/plan/engine";

const DATE_LOCALE = { kk: "kk-KZ", ru: "ru-RU", en: "en-GB" } as const;

export default async function PlanPage() {
  const { supabase, profile } = await getOnboardedSession();
  const t = makeT(getDict(profile.locale));
  const attempts = await getAttempts(supabase);
  const plan = await ensurePlan(supabase, profile, attempts);
  const today = todayIn(profile.timezone);

  const fmt = new Intl.DateTimeFormat(DATE_LOCALE[profile.locale], { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const dayLabel = (d: string) => fmt.format(new Date(d + "T00:00:00Z"));

  const weeks = new Map<number, PlanDay[]>();
  for (const d of plan.days) weeks.set(d.week, [...(weeks.get(d.week) ?? []), d]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("plan.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("plan.subtitle")}</p>
        </div>
        <form action={rebuildPlanAction}>
          <Button variant="outline" type="submit">
            <RefreshCw /> {t("plan.rebuild")}
          </Button>
        </form>
      </header>

      <p className="text-xs text-muted-foreground">
        {t("plan.basis", { date: dayLabel(plan.start_date) })}{" "}
        {SKILLS.map((s) => `${t(`skill.${s}`)} ${formatBand(plan.basis.bands?.[s])}`).join(" · ")}
      </p>

      {[...weeks.entries()].map(([week, days]) => {
        const current = days.some((d) => d.date === today);
        return (
          <details key={week} open={current} className="group rounded-xl border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 sm:p-5">
              <span className="font-semibold">{t("dash.week", { n: week })}</span>
              <span className="text-xs text-muted-foreground">
                {dayLabel(days[0].date)} – {dayLabel(days.at(-1)!.date)} · {t(`phase.${days[0].phase}`)}
              </span>
            </summary>
            <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5">
              {days.map((d) => (
                <Card key={d.date} className={cn("shadow-none", d.date === today && "border-primary")}>
                  <CardHeader className="flex-row flex-wrap items-center gap-2 pb-0">
                    <CardTitle className="text-sm">{dayLabel(d.date)}</CardTitle>
                    {d.date === today && <Badge className="bg-primary text-primary-foreground">{t("plan.today")}</Badge>}
                    <Badge>{t(`phase.${d.phase}`)}</Badge>
                    {d.light && <Badge>{t("plan.light")}</Badge>}
                  </CardHeader>
                  <CardContent className="pt-1">
                    <TaskList tasks={d.tasks} doneKeys={plan.done_keys} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </details>
        );
      })}
      <p className="text-center text-sm font-medium text-muted-foreground">
        {t("plan.examDay")}: {dayLabel(plan.exam_date)}
      </p>
    </div>
  );
}
