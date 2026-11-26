import { getSession } from "@/lib/data/queries";
import { getDict } from "@/lib/i18n";
import { I18nProvider } from "@/components/app/i18n-provider";
import { BottomNav, Sidebar } from "@/components/app/nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { profile } = await getSession();
  return (
    <I18nProvider locale={profile.locale} dict={getDict(profile.locale)}>
      <div className="flex min-h-dvh">
        <Sidebar />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-10 md:pt-8">{children}</main>
      </div>
      <BottomNav />
    </I18nProvider>
  );
}
