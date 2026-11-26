import { getSession } from "@/lib/data/queries";
import { getDict, makeT } from "@/lib/i18n";
import { HubGrid } from "@/components/app/hub-grid";

export default async function ReviewPage() {
  const { profile } = await getSession();
  const t = makeT(getDict(profile.locale));
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("review.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("review.subtitle")}</p>
      </div>
      <HubGrid hrefs={["/errors", "/vocab"]} />
    </div>
  );
}
