"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen, Bot, CalendarDays, ClipboardCheck, Headphones, House, Layers, ListChecks,
  Mic, NotebookPen, PenLine, Settings, Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { useI18n } from "./i18n-provider";
import type { MessageKey } from "@/lib/i18n";

type Item = { href: string; label: MessageKey; icon: React.ComponentType<{ className?: string }> };

const MAIN: Item[] = [
  { href: "/", label: "nav.home", icon: House },
  { href: "/plan", label: "nav.plan", icon: CalendarDays },
];
const SKILLS: Item[] = [
  { href: "/writing", label: "nav.writing", icon: PenLine },
  { href: "/speaking", label: "nav.speaking", icon: Mic },
  { href: "/reading", label: "nav.reading", icon: BookOpen },
  { href: "/listening", label: "nav.listening", icon: Headphones },
];
const MORE: Item[] = [
  { href: "/errors", label: "nav.errors", icon: ListChecks },
  { href: "/vocab", label: "nav.vocab", icon: NotebookPen },
  { href: "/tutor", label: "nav.tutor", icon: Bot },
  { href: "/mock", label: "nav.mock", icon: ClipboardCheck },
  { href: "/diagnostic", label: "nav.diagnostic", icon: Stethoscope },
];
const BOTTOM: Item[] = [
  { href: "/", label: "nav.home", icon: House },
  { href: "/plan", label: "nav.plan", icon: CalendarDays },
  { href: "/practice", label: "nav.practice", icon: PenLine },
  { href: "/review", label: "nav.review", icon: Layers },
  { href: "/settings", label: "nav.settings", icon: Settings },
];

const PRACTICE_PATHS = ["/practice", "/writing", "/speaking", "/reading", "/listening", "/mock", "/diagnostic", "/tutor"];
const REVIEW_PATHS = ["/review", "/errors", "/vocab"];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/practice") return PRACTICE_PATHS.some((p) => pathname.startsWith(p));
  if (href === "/review") return REVIEW_PATHS.some((p) => pathname.startsWith(p));
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const group = (items: Item[]) =>
    items.map(({ href, label, icon: Icon }) => (
      <Link
        key={href}
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
          isActive(pathname, href) && "bg-accent font-medium text-accent-foreground hover:bg-accent",
        )}
      >
        <Icon className="size-4" />
        {t(label)}
      </Link>
    ));
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r bg-card px-3 py-5 md:flex">
      <Link href="/" className="flex items-center gap-2 px-3 text-base font-semibold">
        <Logo className="size-7" />
        {t("app.name")}
      </Link>
      <nav className="flex flex-col gap-1">{group(MAIN)}</nav>
      <nav className="flex flex-col gap-1">{group(SKILLS)}</nav>
      <nav className="flex flex-col gap-1">{group(MORE)}</nav>
      <nav className="mt-auto flex flex-col gap-1">
        {group([{ href: "/settings", label: "nav.settings", icon: Settings }])}
      </nav>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {BOTTOM.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-[11px] leading-none text-muted-foreground",
                  active && "font-semibold text-primary",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-5" />
                <span className="max-w-full truncate px-1">{t(label)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export { SKILLS as SKILL_ITEMS, MORE as MORE_ITEMS };
