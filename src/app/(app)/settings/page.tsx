import { getSession } from "@/lib/data/queries";
import { getDict, makeT } from "@/lib/i18n";
import { addDays, todayIn } from "@/lib/dates";
import { usageToday } from "@/lib/data/usage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExamForm } from "@/components/app/exam-form";
import { LanguageSwitch } from "@/components/app/language-switch";
import { ThemeSwitch } from "@/components/app/theme-switch";
import { FeedbackLangSelect } from "@/components/app/feedback-lang-select";
import { setLocale, updateExamSettings } from "../actions";
import { signOut } from "@/app/login/actions";

export default async function SettingsPage() {
  const { supabase, profile, user } = await getSession();
  const t = makeT(getDict(profile.locale));
  const today = todayIn(profile.timezone);

  const usage = await usageToday(supabase, profile.timezone, today);
  const providers = ["groq", "gemini", ...(usage.has("mock") ? ["mock"] : [])];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-4 sm:pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{t("settings.language")}</span>
            <LanguageSwitch onChange={setLocale} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{t("settings.theme")}</span>
            <ThemeSwitch />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{t("settings.feedbackLang")}</span>
              <span className="text-xs text-muted-foreground">{t("settings.feedbackLangHint")}</span>
            </div>
            <FeedbackLangSelect value={profile.feedback_lang} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.exam")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ExamForm
            action={updateExamSettings}
            defaults={{ exam_date: profile.exam_date, target_band: profile.target_band, start_level: profile.start_level }}
            minDate={addDays(today, 1)}
            submitLabel={t("common.save")}
            savedLabel={t("settings.examSaved")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.usage")}</CardTitle>
          <CardDescription>{t("settings.usageHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {usage.size === 0 && <p className="mb-2 text-sm text-muted-foreground">{t("settings.noUsage")}</p>}
          <table className="w-full text-sm [&_td]:px-2 [&_td:first-child]:pl-0 [&_td:last-child]:pr-0 [&_th]:px-2 [&_th:first-child]:pl-0 [&_th:last-child]:pr-0 [&_th]:align-bottom [&_th]:text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 font-medium">{t("settings.provider")}</th>
                <th className="py-1 text-right font-medium">{t("settings.calls")}</th>
                <th className="py-1 text-right font-medium">{t("settings.failed")}</th>
                <th className="py-1 text-right font-medium">{t("settings.tokens")}</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => {
                const u = usage.get(p) ?? { calls: 0, failed: 0, tin: 0, tout: 0 };
                return (
                  <tr key={p} className="border-t">
                    <td className="py-2 capitalize">{p}</td>
                    <td className="py-2 text-right tabular-nums">{u.calls}</td>
                    <td className="py-2 text-right tabular-nums">{u.failed}</td>
                    <td className="py-2 text-right tabular-nums">
                      {u.tin.toLocaleString("en")} / {u.tout.toLocaleString("en")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.account")}</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signOut}>
            <Button variant="outline" type="submit">{t("settings.signOut")}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
