"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { useI18n } from "./i18n-provider";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n";
import type { ExamFormState } from "@/app/(app)/actions";

const TARGETS = [5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];
const LEVELS = [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8];

type Props = {
  action: (prev: ExamFormState, form: FormData) => Promise<ExamFormState>;
  defaults: { exam_date: string | null; target_band: number; start_level: number | null };
  minDate: string;
  withLanguage?: boolean;
  submitLabel: string;
  savedLabel?: string;
};

export function ExamForm({ action, defaults, minDate, withLanguage, submitLabel, savedLabel }: Props) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <p role="alert" data-testid="form-error" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error === "date" ? t("onb.err.date") : t("common.error")}
        </p>
      )}
      {state.ok && savedLabel && (
        <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          {savedLabel}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="exam_date">{t("onb.examDate")}</Label>
        <Input id="exam_date" name="exam_date" type="date" required min={minDate} defaultValue={defaults.exam_date ?? ""} />
        <p className="text-xs text-muted-foreground">{t("onb.examDateHint")}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="target_band">{t("onb.target")}</Label>
          <Select id="target_band" name="target_band" defaultValue={String(defaults.target_band)}>
            {TARGETS.map((b) => (
              <option key={b} value={b}>{b.toFixed(1)}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="start_level">{t("onb.level")}</Label>
          <Select id="start_level" name="start_level" defaultValue={defaults.start_level == null ? "" : String(defaults.start_level)}>
            <option value="">{t("onb.levelUnknown")}</option>
            {LEVELS.map((b) => (
              <option key={b} value={b}>{b.toFixed(1)}</option>
            ))}
          </Select>
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{t("onb.levelHint")}</p>
      {withLanguage && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="locale">{t("onb.language")}</Label>
          <Select id="locale" name="locale" defaultValue={locale}>
            {LOCALES.map((l) => (
              <option key={l} value={l}>{LOCALE_LABELS[l]}</option>
            ))}
          </Select>
        </div>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("common.saving") : submitLabel}
      </Button>
    </form>
  );
}
