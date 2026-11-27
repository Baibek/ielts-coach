"use client";

import { useState, useTransition } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/app/i18n-provider";
import { sm2, type Grade } from "@/lib/ielts/sm2";
import { finishReview, reviewCard } from "@/app/(app)/vocab/actions";
import { speak } from "@/components/speaking/examiner-voice";

export type ReviewCard = {
  id: string; word: string; meaning: string | null; example: string | null;
  translation_kk: string | null; translation_ru: string | null; ease: number; interval: number; reps: number;
};

const GRADES: Grade[] = ["again", "hard", "good", "easy"];

export function VocabReview({ cards, today }: { cards: ReviewCard[]; today: string }) {
  const { t } = useI18n();
  const [queue, setQueue] = useState(cards);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(0);
  const [, start] = useTransition();
  const card = queue[0];

  if (!card) {
    return <p className="rounded-lg bg-success/10 px-3 py-3 text-sm text-success" data-testid="review-done">{t("vocab.sessionDone", { n: done })}</p>;
  }

  function grade(g: Grade) {
    const c = queue[0];
    start(async () => {
      await reviewCard(c.id, g);
    });
    const rest = queue.slice(1);
    // "Again" cards come back at the end of this session too.
    const next = g === "again" ? [...rest, c] : rest;
    setQueue(next);
    setShown(false);
    const reviewed = done + 1;
    setDone(reviewed);
    if (next.length === 0) start(() => finishReview());
  }

  const highlight = (example: string, word: string) => {
    const i = example.toLowerCase().indexOf(word.toLowerCase().split(" ")[0]);
    if (i < 0) return example;
    return (
      <>
        {example.slice(0, i)}
        <b>{example.slice(i, i + word.length)}</b>
        {example.slice(i + word.length)}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5" data-testid="vocab-review">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{queue.length}</span>
        <button type="button" onClick={() => void speak(card.word)} className="flex items-center gap-1 hover:text-foreground" aria-label={t("vocab.listen")}>
          <Volume2 className="size-4" /> {t("vocab.listen")}
        </button>
      </div>
      <p lang="en" className="text-center text-2xl font-semibold" data-testid="card-word">{card.word}</p>
      {!shown ? (
        <Button size="lg" onClick={() => setShown(true)}>{t("vocab.show")}</Button>
      ) : (
        <>
          <div className="flex flex-col gap-2 text-sm">
            {card.meaning && <p lang="en">{card.meaning}</p>}
            {card.example && <p lang="en" className="italic text-muted-foreground">“{highlight(card.example, card.word)}”</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {card.translation_kk && <span lang="kk">🇰🇿 {card.translation_kk}</span>}
              {card.translation_ru && <span lang="ru">🇷🇺 {card.translation_ru}</span>}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {GRADES.map((g) => {
              const n = sm2({ ease: Number(card.ease), interval: card.interval, reps: card.reps }, g, today).interval;
              return (
                <Button key={g} variant={g === "again" ? "outline" : g === "good" ? "default" : "subtle"} onClick={() => grade(g)} className="h-auto flex-col gap-0 py-2">
                  <span>{t(`vocab.${g}`)}</span>
                  <span className="text-[10px] font-normal opacity-80">{g === "again" ? t("plan.today") : t("vocab.inDays", { n })}</span>
                </Button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
