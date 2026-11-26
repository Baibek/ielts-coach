import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { I18nProvider } from "@/components/app/i18n-provider";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const locale = await getLocale();
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const next = typeof sp.next === "string" ? sp.next : "/";
  return (
    <I18nProvider locale={locale} dict={getDict(locale)}>
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
        <LoginForm urlError={error} next={next} />
      </main>
    </I18nProvider>
  );
}
