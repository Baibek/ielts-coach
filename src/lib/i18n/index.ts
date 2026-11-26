import { en, type Dict, type MessageKey } from "./en";
import { kk } from "./kk";
import { ru } from "./ru";

export type Locale = "kk" | "ru" | "en";
export const LOCALES: Locale[] = ["kk", "ru", "en"];
export const DEFAULT_LOCALE: Locale = "kk";
export const LOCALE_COOKIE = "locale";
export const LOCALE_LABELS: Record<Locale, string> = { kk: "Қазақша", ru: "Русский", en: "English" };

const DICTS: Record<Locale, Dict> = { kk, ru, en };

export function isLocale(v: unknown): v is Locale {
  return v === "kk" || v === "ru" || v === "en";
}

export function getDict(locale: Locale): Dict {
  return DICTS[locale] ?? DICTS[DEFAULT_LOCALE];
}

export type TFunction = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function makeT(dict: Dict): TFunction {
  return (key, vars) => {
    let s = dict[key] ?? en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

export type { Dict, MessageKey };
