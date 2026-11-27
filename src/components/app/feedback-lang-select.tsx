"use client";

import { useTransition } from "react";
import { Select } from "@/components/ui/input";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";
import { setFeedbackLang } from "@/app/(app)/actions";
import { useI18n } from "./i18n-provider";

export function FeedbackLangSelect({ value }: { value: Locale | null }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Select
      id="feedback_lang"
      aria-label={t("settings.feedbackLang")}
      className="w-auto"
      disabled={pending}
      defaultValue={value ?? ""}
      onChange={(e) => start(() => setFeedbackLang(e.target.value))}
    >
      <option value="">{t("settings.sameAsUi")}</option>
      {LOCALES.map((l) => (
        <option key={l} value={l}>{LOCALE_LABELS[l]}</option>
      ))}
    </Select>
  );
}
