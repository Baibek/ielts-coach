import { getSession } from "@/lib/data/queries";
import { getDict, makeT } from "@/lib/i18n";
import { TutorChat } from "@/components/tutor/chat";
import type { ChatMessage } from "./actions";

export const maxDuration = 60;

export default async function TutorPage({ searchParams }: PageProps<"/tutor">) {
  const sp = await searchParams;
  const { supabase, profile } = await getSession();
  const t = makeT(getDict(profile.locale));
  const { data } = await supabase.from("tutor_messages").select("id, role, content, created_at").order("created_at").limit(200);
  const ask = typeof sp.ask === "string" ? sp.ask.slice(0, 120) : undefined;
  const prefill = ask ? `${ask}: ${profile.locale === "kk" ? "осы қатемді түсіндіріп, жаттығу беріңізші" : profile.locale === "ru" ? "объясни эту мою ошибку и дай упражнение" : "please explain this mistake of mine and give me an exercise"}` : undefined;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.tutor")}</h1>
        <p className="text-sm text-muted-foreground">{t("tutor.subtitle")}</p>
      </div>
      <TutorChat initial={(data ?? []) as ChatMessage[]} prefill={prefill} />
    </div>
  );
}
