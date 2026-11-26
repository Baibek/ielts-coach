"use client";

import { createContext, useContext, useMemo } from "react";
import { makeT, type Dict, type Locale, type TFunction } from "@/lib/i18n";

type Ctx = { locale: Locale; t: TFunction };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dict; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: makeT(dict) }), [locale, dict]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
