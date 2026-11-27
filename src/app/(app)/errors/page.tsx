import Link from "next/link";
import { getSession } from "@/lib/data/queries";
import { getDict, makeT, type MessageKey } from "@/lib/i18n";
import { dateInTz } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorActions, ReviewedButton } from "@/components/errors/error-actions";
import { cn } from "@/lib/utils";

type Row = {
  id: string; category: string; pattern: string | null; example: string; correction: string; rule: string | null;
  source: string | null; count: number; resolved: boolean; last_seen: string;
};

export default async function ErrorsPage({ searchParams }: PageProps<"/errors">) {
  const sp = await searchParams;
  const { supabase, profile } = await getSession();
  const t = makeT(getDict(profile.locale));
  const { data } = await supabase
    .from("error_log")
    .select("id, category, pattern, example, correction, rule, source, count, resolved, last_seen")
    .order("count", { ascending: false })
    .order("last_seen", { ascending: false })
    .limit(500);
  const all = (data ?? []) as Row[];
  const showResolved = sp.resolved === "1";
  const cat = typeof sp.cat === "string" ? sp.cat : null;
  const open = all.filter((r) => !r.resolved);
  const rows = all.filter((r) => (showResolved ? r.resolved : !r.resolved) && (!cat || r.category === cat));
  const cats = [...new Set(open.map((r) => r.category))];
  const countBy = (c: string) => open.filter((r) => r.category === c).reduce((s, r) => s + r.count, 0);
  const link = (q: Record<string, string | null>) => {
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]);
    return `/errors${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.errors")}</h1>
          <p className="text-sm text-muted-foreground">{t("errors.subtitle")}</p>
        </div>
        {open.length > 0 && <ReviewedButton />}
      </div>

      {all.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{t("errors.empty")}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Link href={link({ cat: null, resolved: showResolved ? "1" : null })} className={cn("rounded-full border px-3 py-1 text-xs", !cat && "border-primary bg-accent text-accent-foreground")}>
              {t("errors.all")}
            </Link>
            {cats.map((c) => (
              <Link key={c} href={link({ cat: c, resolved: showResolved ? "1" : null })} className={cn("rounded-full border px-3 py-1 text-xs", cat === c && "border-primary bg-accent text-accent-foreground")}>
                {t(`cat.${c}` as MessageKey)} · {countBy(c)}
              </Link>
            ))}
            <Link href={link({ cat, resolved: showResolved ? null : "1" })} className="ml-auto text-xs text-muted-foreground underline">
              {showResolved ? t("errors.all") : t("errors.showResolved", { n: all.length - open.length })}
            </Link>
          </div>
          <ul className="flex flex-col gap-2" data-testid="error-list">
            {rows.map((r) => (
              <li key={r.id}>
                <Card>
                  <CardContent className="flex flex-col gap-2 pt-4 sm:pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-danger/10 px-2 py-0.5 text-sm font-semibold tabular-nums text-danger">{t("errors.times", { n: r.count })}</span>
                      <span lang="en" className="font-medium">{r.pattern || r.category}</span>
                      <Badge>{t(`cat.${r.category}` as MessageKey)}</Badge>
                      {r.source && <Badge>{t(`nav.${r.source}` as MessageKey)}</Badge>}
                      <span className="ml-auto text-xs text-muted-foreground">{t("errors.lastSeen", { date: dateInTz(r.last_seen, profile.timezone) })}</span>
                    </div>
                    <p lang="en" className="text-sm">
                      <span className="text-danger line-through">{r.example}</span> → <b className="text-success">{r.correction}</b>
                    </p>
                    {r.rule && <p className="text-xs text-muted-foreground">{r.rule}</p>}
                    <ErrorActions id={r.id} resolved={r.resolved} pattern={r.pattern || r.category} />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
