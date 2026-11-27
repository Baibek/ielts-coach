import Link from "next/link";
import { BookOpen, CheckCircle2, Headphones, Mic, PenLine } from "lucide-react";
import { getAttempts, getSession } from "@/lib/data/queries";
import { getDict, makeT } from "@/lib/i18n";
import { formatBand, SKILLS, type Skill } from "@/lib/ielts/bands";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ITEMS: Record<Skill, { href: string; label: "diag.listening" | "diag.reading" | "diag.writing" | "diag.speaking"; icon: typeof Mic }> = {
  listening: { href: "/listening?diag=1", label: "diag.listening", icon: Headphones },
  reading: { href: "/reading?diag=1", label: "diag.reading", icon: BookOpen },
  writing: { href: "/writing?task=task2&mode=exam&diag=1", label: "diag.writing", icon: PenLine },
  speaking: { href: "/speaking?part=diag", label: "diag.speaking", icon: Mic },
};

export default async function DiagnosticPage() {
  const { supabase, profile } = await getSession();
  const t = makeT(getDict(profile.locale));
  const attempts = await getAttempts(supabase);
  const latest = (s: Skill) => attempts.find((a) => a.type === "diagnostic" && a.skill === s);
  const doneCount = SKILLS.filter((s) => latest(s)).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("diag.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("diag.subtitle")}</p>
      </div>
      {doneCount === 4 && <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{t("diag.allDone")}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {SKILLS.map((s) => {
          const a = latest(s);
          const { href, label, icon: Icon } = ITEMS[s];
          return (
            <Card key={s} data-testid={`diag-${s}`}>
              <CardHeader className="flex-row items-center gap-3">
                <Icon className="size-6 text-primary" />
                <div className="flex-1">
                  <CardTitle>{t(`skill.${s}`)}</CardTitle>
                  <CardDescription>{t(label)}</CardDescription>
                </div>
                {a && <span className="text-2xl font-semibold tabular-nums">{formatBand(a.band)}</span>}
              </CardHeader>
              <CardContent>
                {a ? (
                  <p className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="size-4" /> {t("diag.done")}</p>
                ) : (
                  <Button asChild><Link href={href}>{t("diag.start")}</Link></Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
