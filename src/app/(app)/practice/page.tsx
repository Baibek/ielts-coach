import { getSession } from "@/lib/data/queries";
import { getDict, makeT } from "@/lib/i18n";
import { HubGrid } from "@/components/app/hub-grid";

export default async function PracticePage() {
  const { profile } = await getSession();
  const t = makeT(getDict(profile.locale));
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("practice.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("practice.subtitle")}</p>
      </div>
      <HubGrid hrefs={["/writing", "/speaking", "/reading", "/listening", "/mock", "/diagnostic", "/tutor"]} />
    </div>
  );
}
