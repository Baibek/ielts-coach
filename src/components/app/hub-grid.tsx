"use client";

import Link from "next/link";
import { useI18n } from "./i18n-provider";
import { MORE_ITEMS, SKILL_ITEMS } from "./nav";

export function HubGrid({ hrefs }: { hrefs: string[] }) {
  const { t } = useI18n();
  const items = [...SKILL_ITEMS, ...MORE_ITEMS].filter((i) => hrefs.includes(i.href));
  items.sort((a, b) => hrefs.indexOf(a.href) - hrefs.indexOf(b.href));
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className="flex flex-col gap-3 rounded-xl border bg-card p-4 hover:border-primary">
          <Icon className="size-6 text-primary" />
          <span className="text-sm font-medium">{t(label)}</span>
        </Link>
      ))}
    </div>
  );
}
