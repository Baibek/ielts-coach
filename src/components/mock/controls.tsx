"use client";

import { useEffect, useRef, useTransition } from "react";
import { Loader2, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/app/i18n-provider";
import { abandonMock, finishMock, startMock } from "@/app/(app)/mock/actions";

export function StartMockButton() {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return <Button size="lg" disabled={pending} onClick={() => start(() => startMock())}><Play /> {t("mock.start")}</Button>;
}

export function AbandonMockButton({ id }: { id: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => window.confirm(t("mock.abandon") + "?") && start(() => abandonMock(id))}>
      <X /> {t("mock.abandon")}
    </Button>
  );
}

/** When every section is done, build the report automatically. */
export function AutoFinish({ id }: { id: string }) {
  const { t } = useI18n();
  const [, start] = useTransition();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    start(() => finishMock(id));
  }, [id]);
  return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> {t("mock.preparing")}</p>;
}
