"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bot, Check, CheckCheck, Layers, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/app/i18n-provider";
import { errorToCard, markErrorsReviewed, setResolved } from "@/app/(app)/errors/actions";

export function ErrorActions({ id, resolved, pattern }: { id: string; resolved: boolean; pattern: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [carded, setCarded] = useState(false);
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => setResolved(id, !resolved))}>
        {resolved ? <><RotateCcw /> {t("errors.unresolve")}</> : <><Check /> {t("errors.resolve")}</>}
      </Button>
      <Button size="sm" variant="ghost" disabled={pending || carded} onClick={() => start(async () => setCarded((await errorToCard(id)).ok))}>
        <Layers /> {carded ? t("errors.carded") : t("errors.toCard")}
      </Button>
      <Button asChild size="sm" variant="ghost">
        <Link href={`/tutor?ask=${encodeURIComponent(pattern)}`}><Bot /> {t("errors.askTutor")}</Link>
      </Button>
    </div>
  );
}

export function ReviewedButton() {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  return (
    <Button variant="outline" disabled={pending || done} onClick={() => start(async () => { await markErrorsReviewed(); setDone(true); })}>
      <CheckCheck /> {t("errors.reviewed")}
    </Button>
  );
}
