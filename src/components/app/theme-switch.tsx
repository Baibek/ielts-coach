"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n-provider";

const OPTIONS = [
  { value: "light", icon: Sun, label: "settings.theme.light" },
  { value: "dark", icon: Moon, label: "settings.theme.dark" },
  { value: "system", icon: Monitor, label: "settings.theme.system" },
] as const;

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- theme is only known after hydration
  useEffect(() => setMounted(true), []);
  return (
    <div role="group" aria-label={t("settings.theme")} className="inline-flex rounded-lg border bg-card p-0.5">
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground",
              active && "bg-accent text-accent-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {t(label)}
          </button>
        );
      })}
    </div>
  );
}
