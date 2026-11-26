import { getSession } from "@/lib/data/queries";
import { getDict, makeT } from "@/lib/i18n";
import { addDays, todayIn } from "@/lib/dates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExamForm } from "@/components/app/exam-form";
import { completeOnboarding } from "../actions";

export default async function OnboardingPage() {
  const { profile } = await getSession();
  const t = makeT(getDict(profile.locale));
  const today = todayIn(profile.timezone);
  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("onb.title")}</CardTitle>
          <CardDescription>{t("onb.intro")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ExamForm
            action={completeOnboarding}
            defaults={{
              exam_date: profile.exam_date ?? addDays(today, 42),
              target_band: profile.target_band,
              start_level: profile.start_level,
            }}
            minDate={addDays(today, 1)}
            withLanguage
            submitLabel={t("onb.submit")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
