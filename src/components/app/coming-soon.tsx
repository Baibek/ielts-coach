import { getSession } from "@/lib/data/queries";
import { getDict, makeT, type MessageKey } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Temporary page for modules that are scheduled for a later build day.
export async function ComingSoon({ title }: { title: MessageKey }) {
  const { profile } = await getSession();
  const t = makeT(getDict(profile.locale));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t(title)}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t("soon.title")}</CardTitle>
          <CardDescription>{t("soon.body")}</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
