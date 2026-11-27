"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/components/app/i18n-provider";
import { LanguageSwitch } from "@/components/app/language-switch";
import { Logo } from "@/components/app/logo";
import { setLocalePublic } from "@/app/(app)/actions";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { sendCode, signInPassword, verifyCode, type LoginState, type PasswordState } from "./actions";

const ERRORS: Record<string, MessageKey> = {
  notAllowed: "login.err.notAllowed",
  not_allowed: "login.err.notAllowed",
  link: "login.err.link",
  code: "login.err.code",
  rate: "login.err.rate",
  email: "login.err.email",
  password: "login.err.password",
  generic: "common.error",
};

export function LoginForm({ urlError, next }: { urlError?: string; next: string }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"password" | "code">("password");
  const [pwState, pwAction, pwPending] = useActionState(signInPassword, { email: "" } as PasswordState);
  const [sendState, sendAction, sending] = useActionState(sendCode, { step: "email", email: "" } as LoginState);
  const [verifyState, verifyAction, verifying] = useActionState(verifyCode, { step: "code", email: "" } as LoginState);

  // The verify form takes over once a code was sent; "other email" resets via reload.
  const step = sendState.step === "code" && verifyState.step !== "email" ? "code" : "email";
  const email = sendState.email;
  const errorKey =
    tab === "password"
      ? pwState.error ?? urlError
      : (step === "code" ? verifyState.error : sendState.error) ?? (sendState.step === "email" && !sendState.error ? urlError : undefined);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <Logo className="size-8" />
          {t("app.name")}
        </div>
        <LanguageSwitch onChange={setLocalePublic} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("login.title")}</CardTitle>
          {tab === "code" && <CardDescription>{step === "email" ? t("login.subtitle") : t("login.sent", { email })}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div role="tablist" className="mb-4 grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-0.5 text-sm font-medium">
            {(["password", "code"] as const).map((x) => (
              <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)}
                className={cn("rounded-md py-1.5", tab === x ? "bg-card shadow-sm" : "text-muted-foreground")}>
                {t(x === "password" ? "login.tabPassword" : "login.tabCode")}
              </button>
            ))}
          </div>
          {errorKey && ERRORS[errorKey] && (
            <p role="alert" data-testid="form-error" className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {t(ERRORS[errorKey])}
            </p>
          )}
          {tab === "password" ? (
            <form action={pwAction} className="flex flex-col gap-3">
              <input type="hidden" name="next" value={next} />
              <Label htmlFor="pw-email">{t("login.email")}</Label>
              <Input id="pw-email" name="email" type="email" autoComplete="username" inputMode="email" required defaultValue={pwState.email} />
              <Label htmlFor="password">{t("login.password")}</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
              <Button type="submit" disabled={pwPending} size="lg">
                {pwPending ? t("login.signingIn") : t("login.signIn")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("login.passwordHint")}</p>
            </form>
          ) : step === "email" ? (
            <form action={sendAction} className="flex flex-col gap-3">
              <Label htmlFor="email">{t("login.email")}</Label>
              <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={email} />
              <Button type="submit" disabled={sending} size="lg">
                {sending ? t("login.sending") : t("login.send")}
              </Button>
            </form>
          ) : (
            <form action={verifyAction} className="flex flex-col gap-3">
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="next" value={next} />
              <Label htmlFor="code">{t("login.code")}</Label>
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]*"
                maxLength={12}
                required
                autoFocus
                className="text-center text-2xl tracking-[0.4em]"
              />
              <Button type="submit" disabled={verifying} size="lg">
                {verifying ? t("login.verifying") : t("login.verify")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => window.location.reload()}>
                {t("login.otherEmail")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
