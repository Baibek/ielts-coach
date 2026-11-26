"use client";

import { useTransition } from "react";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n-provider";

export function LanguageSwitch({ onChange }: { onChange: (locale: string) => Promise<void> }) {
  const { locale } = useI18n();
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label="Language" className={cn("inline-flex rounded-lg border bg-card p-0.5", pending && "opacity-60")}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          onClick={() => start(() => onChange(l))}
          aria-pressed={l === locale}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground",
            l === locale && "bg-accent text-accent-foreground",
          )}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
