import { getSession } from "@/lib/data/queries";
import { getDict, makeT } from "@/lib/i18n";
import { todayIn } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VocabReview, type ReviewCard } from "@/components/vocab/review";
import { AddCardForm, DeleteCardButton, PackForm, StarterButton } from "@/components/vocab/forms";

export const maxDuration = 60;

type Row = ReviewCard & { due_date: string; topic: string | null };

export default async function VocabPage() {
  const { supabase, profile } = await getSession();
  const t = makeT(getDict(profile.locale));
  const today = todayIn(profile.timezone);
  const { data } = await supabase
    .from("vocab_cards")
    .select("id, word, meaning, example, translation_kk, translation_ru, ease, interval, reps, due_date, topic")
    .order("due_date")
    .limit(1000);
  const cards = (data ?? []) as Row[];
  const due = cards.filter((c) => c.due_date <= today).slice(0, 50);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.vocab")}</h1>
        <p className="text-sm text-muted-foreground">{t("vocab.subtitle")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge className="bg-accent px-3 py-1 text-sm text-accent-foreground" data-testid="due-count">{t("vocab.due", { n: due.length })}</Badge>
        <Badge className="px-3 py-1 text-sm">{t("vocab.total", { n: cards.length })}</Badge>
      </div>

      {due.length > 0 ? (
        <VocabReview key={due.map((c) => c.id).join(",")} cards={due} today={today} />
      ) : (
        <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{t("vocab.noneDue")}</p>
      )}
      {cards.length < 10 && <StarterButton />}

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("vocab.add")}</CardTitle></CardHeader>
          <CardContent><AddCardForm /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("vocab.pack")}</CardTitle></CardHeader>
          <CardContent><PackForm /></CardContent>
        </Card>
      </div>

      {cards.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("vocab.all")}</CardTitle></CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {cards.map((c) => (
                <li key={c.id} className="flex items-start gap-3 py-2 text-sm">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span lang="en" className="font-medium">{c.word}</span>
                    <span className="truncate text-xs text-muted-foreground">{[c.translation_kk, c.translation_ru].filter(Boolean).join(" · ") || c.meaning}</span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{t("vocab.next", { date: c.due_date.slice(5).split("-").reverse().join(".") })}</span>
                  <DeleteCardButton id={c.id} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
