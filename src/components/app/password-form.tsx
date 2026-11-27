"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { setPassword, type PasswordFormState } from "@/app/(app)/actions";
import { useI18n } from "./i18n-provider";

export function PasswordForm({ email }: { email: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(setPassword, {} as PasswordFormState);
  return (
    <form action={action} className="flex flex-col gap-3" key={state.ok ? "saved" : "form"}>
      {/* Hidden username so password managers save the right account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      {state.ok && <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{t("settings.passwordSaved")}</p>}
      {state.error && (
        <p role="alert" data-testid="form-error" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {t(state.error === "short" ? "settings.err.short" : state.error === "mismatch" ? "settings.err.mismatch" : state.error === "reauth" ? "settings.err.reauth" : "common.error")}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-password">{t("settings.newPassword")}</Label>
        <Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="repeat-password">{t("settings.repeatPassword")}</Label>
        <Input id="repeat-password" name="repeat" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </div>
      <Button type="submit" disabled={pending} className="self-start">{pending ? t("common.saving") : t("settings.savePassword")}</Button>
    </form>
  );
}
